import { isIP } from "node:net";

import { PublicRuntimeError } from "./errors.js";
import { getPointer } from "./json.js";

const WEBHOOK_OPERATIONS = new Set(["createWebhookEndpoint", "updateWebhookEndpoint"]);

function privateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) return true;
  const [first = -1, second = -1, third = -1] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && (third === 0 || third === 2)) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function privateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("::ffff:") ||
    /^f[cd]/u.test(normalized) ||
    /^fe[89a-f]/u.test(normalized) ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("2002:") ||
    normalized.startsWith("ff")
  );
}

function publicWebhookUrl(value: string): boolean {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    return false;
  }
  if (target.protocol !== "https:" || target.username !== "" || target.password !== "")
    return false;
  const hostname = target.hostname
    .replace(/^\[|\]$/gu, "")
    .replace(/\.+$/u, "")
    .toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".home.arpa")
  ) {
    return false;
  }
  const version = isIP(hostname);
  if (version === 4) return !privateIpv4(hostname);
  if (version === 6) return !privateIpv6(hostname);
  return hostname.includes(".");
}

export function validateNetworkBoundary(
  operationId: string,
  request: Readonly<Record<string, unknown>>
): void {
  if (!WEBHOOK_OPERATIONS.has(operationId)) return;
  const target = getPointer(request, "/body/url");
  if (typeof target !== "string" || !publicWebhookUrl(target)) {
    // 该检查只做客户端纵深防护；服务端仍需在解析 DNS 后重新验证目标地址。
    throw new PublicRuntimeError(
      "WEBHOOK_TARGET_DENIED",
      "Webhook target must be a public HTTPS URL"
    );
  }
}
