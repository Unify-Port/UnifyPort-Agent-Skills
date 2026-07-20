import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

export interface PublicFinding {
  readonly file: string;
  readonly rule: string;
}

interface ContentRule {
  readonly label: string;
  readonly pattern: RegExp;
}

const IGNORED_DIRECTORIES = new Set([".git", "coverage", "node_modules"]);

function joined(...parts: readonly string[]): string {
  // 扫描字面量分段存放，避免安全工具因为描述自己的规则而自触发。
  return parts.join("");
}

const CONTENT_RULES: readonly ContentRule[] = [
  { label: "macOS user home path", pattern: new RegExp(joined("/", "Users", "/"), "u") },
  { label: "Linux user home path", pattern: new RegExp(joined("/", "home", "/"), "u") },
  {
    label: "Windows user home path",
    pattern: new RegExp(joined("[A-Za-z]:\\\\", "Users", "\\\\"), "u")
  },
  {
    label: "private network URL",
    pattern: new RegExp(
      joined(
        "https?://(?:10\\.[0-9.]+|192\\.168\\.[0-9.]+|172\\.(?:1[6-9]|2[0-9]|3[01])\\.[0-9.]+|",
        "[A-Za-z0-9.-]+\\.(?:corp|internal|lan|local))(?:[:/]|$)"
      ),
      "iu"
    )
  },
  {
    label: "internal API route",
    pattern: new RegExp(joined("/v1/", "internal/"), "u")
  },
  {
    label: "source provenance metadata",
    pattern: new RegExp(
      joined("(?:source|upstream)", "(?:Repository|Commit|Path|Branch|Workspace|Manifest)"),
      "u"
    )
  },
  {
    label: "private key material",
    pattern: new RegExp(joined("-----BEGIN ", "(?:RSA |EC |OPENSSH )?PRIVATE KEY-----"), "u")
  },
  {
    label: "well-known access token",
    pattern: new RegExp(
      joined(
        "(?:gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|npm_[A-Za-z0-9]{20,}|",
        "glpat-[A-Za-z0-9_-]{20,}|xox(?:a|b|p|r|s)-[A-Za-z0-9-]{20,})"
      ),
      "u"
    )
  },
  {
    label: "JSON Web Token",
    pattern: new RegExp(
      joined("eyJ[A-Za-z0-9_-]{8,}\\.", "[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}"),
      "u"
    )
  },
  {
    label: "hard-coded secret assignment",
    pattern: new RegExp(
      joined(
        "(?:API_KEY|PASSWORD|SECRET|TOKEN)\\s*=\\s*[\"']",
        "(?!<(?:api-key|password|secret|token)>)[A-Za-z0-9_./+=:-]{16,}[\"']"
      ),
      "u"
    )
  }
];

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      files.push(path);
    } else if (stats.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else if (stats.isFile()) {
      files.push(path);
    }
  }
  return files;
}

export function scanText(text: string, file: string): readonly PublicFinding[] {
  const findings: PublicFinding[] = [];
  for (const rule of CONTENT_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(text)) findings.push({ file, rule: rule.label });
  }
  return findings;
}

export async function findPublicSafetyIssues(root: string): Promise<{
  readonly filesChecked: number;
  readonly findings: readonly PublicFinding[];
}> {
  const files = await collectFiles(root);
  const findings: PublicFinding[] = [];
  for (const path of files) {
    const file = relative(root, path).replaceAll("\\", "/");
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      findings.push({ file, rule: "symbolic link in public artifact" });
      continue;
    }
    if (file.endsWith(".mjs")) findings.push({ file, rule: "JavaScript module file" });
    const content = await readFile(path);
    // NUL 是稳定的文本边界；归档和镜像在各自发布检查中展开后再次扫描。
    if (content.includes(0)) continue;
    findings.push(...scanText(content.toString("utf8"), file));
  }
  return { filesChecked: files.length, findings };
}
