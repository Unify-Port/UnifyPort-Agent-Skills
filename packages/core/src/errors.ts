import { UnifyPortApiError, UnifyPortError } from "@unifyport/sdk-node";

const SAFE_DIAGNOSTIC = /^[A-Za-z0-9_.:/-]+$/u;

function safeDiagnostic(value: string, fallback: string, maximumLength: number): string {
  return value.length <= maximumLength && SAFE_DIAGNOSTIC.test(value) ? value : fallback;
}

export class PublicRuntimeError extends Error {
  public readonly code: string;
  public readonly status: number | undefined;
  public readonly requestId: string | undefined;

  public constructor(
    code: string,
    message: string,
    context: { readonly status?: number; readonly requestId?: string } = {}
  ) {
    super(message);
    this.name = "PublicRuntimeError";
    this.code = safeDiagnostic(code, "UNEXPECTED_ERROR", 64);
    this.status = context.status;
    this.requestId = context.requestId;
  }
}

export function safeRuntimeError(error: unknown): PublicRuntimeError {
  if (error instanceof PublicRuntimeError) return error;
  if (error instanceof UnifyPortApiError) {
    return new PublicRuntimeError(
      safeDiagnostic(error.code, `HTTP_${String(error.status)}`, 64),
      "UnifyPort API request failed",
      {
        status: error.status,
        ...(error.requestId === undefined
          ? {}
          : { requestId: safeDiagnostic(error.requestId, "redacted", 128) })
      }
    );
  }
  // 上游 message/details 可能包含请求内容，公共错误只保留稳定分类。
  if (error instanceof UnifyPortError) {
    return new PublicRuntimeError("SDK_ERROR", "UnifyPort SDK request failed");
  }
  return new PublicRuntimeError("UNEXPECTED_ERROR", "Unexpected UnifyPort runtime error");
}
