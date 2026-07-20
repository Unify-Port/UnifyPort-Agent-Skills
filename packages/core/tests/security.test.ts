import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { safeRuntimeError } from "../src/errors.js";
import {
  deletePointer,
  getPointer,
  requestDigest,
  serializedSize,
  setPointer
} from "../src/json.js";
import { closeInputSchema, projectInput, projectOutput } from "../src/projection.js";
import {
  EnvironmentSecretResolver,
  FileSecureSink,
  UnavailableSecureSink
} from "../src/secure-channel.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(async (directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("secure channels", () => {
  it("resolves only dedicated secret environment names", async () => {
    const resolver = new EnvironmentSecretResolver({
      UNIFYPORT_SECRET_AUTH_CODE: "654321",
      UNIFYPORT_API_KEY: "not-readable-through-this-channel"
    });
    await expect(resolver.resolve("env:UNIFYPORT_SECRET_AUTH_CODE")).resolves.toBe("654321");
    await expect(resolver.resolve("env:UNIFYPORT_SECRET_MISSING")).resolves.toBeUndefined();
    await expect(resolver.resolve("env:UNIFYPORT_API_KEY")).rejects.toMatchObject({
      code: "INVALID_SECRET_REF"
    });
    await expect(resolver.resolve("file:secret")).rejects.toMatchObject({
      code: "INVALID_SECRET_REF"
    });
  });

  it("pre-reserves a new 0600 file and never overwrites it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "unifyport-secure-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "result.json");
    const sink = new FileSecureSink(path);
    const reservation = await sink.reserve("createApiKey", ["/data/data/api_key"]);
    await expect(reservation.commit({ "/data/data/api_key": "one-time-value" })).resolves.toEqual({
      sink: "file",
      fields: 1
    });
    expect((await stat(path)).mode & 0o077).toBe(0);
    expect(await readFile(path, "utf8")).toContain("one-time-value");
    await expect(sink.reserve("createApiKey", [])).rejects.toMatchObject({
      code: "SECURE_SINK_RESERVE_FAILED"
    });
  });

  it("removes an unused reservation on abort and denies an unavailable sink", async () => {
    const directory = await mkdtemp(join(tmpdir(), "unifyport-secure-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "result.json");
    const reservation = await new FileSecureSink(path).reserve("createApiKey", []);
    await reservation.abort();
    await expect(stat(path)).rejects.toThrow();
    await expect(new UnavailableSecureSink().reserve("createApiKey", [])).rejects.toMatchObject({
      code: "SECURE_SINK_REQUIRED"
    });
  });
});

describe("closed JSON boundary", () => {
  it("canonicalizes approval digests without exposing values", () => {
    const first = requestDigest("getWorkspace", { beta: 2, alpha: 1 });
    const second = requestDigest("getWorkspace", { alpha: 1, beta: 2 });
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("reads, writes, and deletes approved JSON pointers", () => {
    const value: Record<string, unknown> = {};
    setPointer(value, "/body/code", "654321");
    expect(getPointer(value, "/body/code")).toBe("654321");
    expect(deletePointer(value, "/body/code")).toBe("654321");
    expect(getPointer(value, "/body/code")).toBeUndefined();
    expect(() => {
      setPointer({ body: "invalid" }, "/body/code", "654321");
    }).toThrow("Secret pointer conflicts");
  });

  it("rejects non-JSON and oversized values", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    expect(() => {
      serializedSize(cyclic, 10, "Input");
    }).toThrow("JSON serializable");
    expect(() => {
      serializedSize({ value: "long" }, 2, "Input");
    }).toThrow("size limit");
  });

  it("closes schemas, rejects undeclared input, and redacts output fields", () => {
    const schema = {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: { name: { type: "string" }, api_key: { type: "string" } }
        }
      }
    } as const;
    expect(closeInputSchema(schema)).toMatchObject({
      additionalProperties: false,
      properties: { data: { additionalProperties: false } }
    });
    expect(() => projectInput({ data: { name: "Example", extra: true } }, schema)).toThrow(
      "undeclared properties"
    );
    expect(projectOutput({ data: { name: "Example", api_key: "not-returned" } }, schema)).toEqual({
      data: { name: "Example" }
    });
    expect(() => closeInputSchema({ type: "object", patternProperties: {} })).toThrow(
      "requires explicit support"
    );
  });

  it("returns a stable public error without the unknown cause message", () => {
    const error = safeRuntimeError(new Error("credential-value"));
    expect(error.code).toBe("UNEXPECTED_ERROR");
    expect(error.message).not.toContain("credential-value");
  });
});
