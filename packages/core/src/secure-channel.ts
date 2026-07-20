import { open, unlink, type FileHandle } from "node:fs/promises";

import { PublicRuntimeError } from "./errors.js";
import type {
  SecretResolver,
  SecureOutputReservation,
  SecureReceipt,
  SecureSink
} from "./types.js";

const SECRET_ENVIRONMENT_NAME = /^UNIFYPORT_SECRET_[A-Z0-9_]+$/u;

export class EnvironmentSecretResolver implements SecretResolver {
  readonly #environment: Readonly<Record<string, string | undefined>>;

  public constructor(environment: Readonly<Record<string, string | undefined>> = process.env) {
    this.#environment = environment;
  }

  public resolve(reference: string): Promise<string | undefined> {
    const prefix = "env:";
    if (!reference.startsWith(prefix)) {
      return Promise.reject(
        new PublicRuntimeError(
          "INVALID_SECRET_REF",
          "Only environment secret references are supported"
        )
      );
    }
    const name = reference.slice(prefix.length);
    if (!SECRET_ENVIRONMENT_NAME.test(name)) {
      // API Key 使用独立通道，禁止借业务 secret reference 重新注入请求体。
      return Promise.reject(
        new PublicRuntimeError("INVALID_SECRET_REF", "Secret environment name is not allowed")
      );
    }
    const value = this.#environment[name];
    return Promise.resolve(value === undefined || value === "" ? undefined : value);
  }
}

export class UnavailableSecureSink implements SecureSink {
  public reserve(
    operationId: string,
    pointers: readonly string[]
  ): Promise<SecureOutputReservation> {
    void operationId;
    void pointers;
    // 返回 rejected Promise，保持 direct caller 与 await caller 的失败语义一致。
    return Promise.reject(
      new PublicRuntimeError(
        "SECURE_SINK_REQUIRED",
        "This operation requires a configured secure output sink"
      )
    );
  }
}

class FileReservation implements SecureOutputReservation {
  readonly #handle: FileHandle;
  readonly #path: string;
  readonly #operationId: string;
  #closed = false;

  public constructor(handle: FileHandle, path: string, operationId: string) {
    this.#handle = handle;
    this.#path = path;
    this.#operationId = operationId;
  }

  public async commit(values: Readonly<Record<string, unknown>>): Promise<SecureReceipt> {
    if (this.#closed)
      throw new PublicRuntimeError("SECURE_SINK_STATE", "Secure sink is already closed");
    try {
      await this.#handle.writeFile(
        `${JSON.stringify({ operationId: this.#operationId, values })}\n`,
        {
          encoding: "utf8"
        }
      );
      await this.#handle.sync();
      await this.#handle.close();
      this.#closed = true;
      return { sink: "file", fields: Object.keys(values).length };
    } catch {
      await this.abort();
      throw new PublicRuntimeError("SECURE_SINK_WRITE_FAILED", "Secure output could not be stored");
    }
  }

  public async abort(): Promise<void> {
    if (!this.#closed) {
      await this.#handle.close().catch(() => undefined);
      this.#closed = true;
    }
    // 预留文件只属于本次调用，失败时删除可避免留下空的误导性 secret artifact。
    await unlink(this.#path).catch(() => undefined);
  }
}

export class FileSecureSink implements SecureSink {
  readonly #path: string;

  public constructor(path: string) {
    if (path === "")
      throw new PublicRuntimeError("INVALID_SECURE_SINK", "Secure output path is required");
    this.#path = path;
  }

  public async reserve(
    operationId: string,
    pointers: readonly string[]
  ): Promise<SecureOutputReservation> {
    // sink 由 policy 决定是否需要；文件格式不重复保存 pointer 清单以减少敏感元数据。
    void pointers;
    try {
      // wx 与 0600 同时阻止覆盖已有文件和默认的跨用户读取。
      const handle = await open(this.#path, "wx", 0o600);
      return new FileReservation(handle, this.#path, operationId);
    } catch {
      throw new PublicRuntimeError(
        "SECURE_SINK_RESERVE_FAILED",
        "Secure output path must be a new writable file"
      );
    }
  }
}
