import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/tests/**/*.test.ts", "scripts/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // 远程入口和安装器属于公开攻击面，覆盖率门槛不能只约束 MCP registry。
      include: [
        "packages/core/src/**/*.ts",
        "packages/server/src/{gateway,installer,openapi-adapter,registry,server}.ts"
      ],
      exclude: ["packages/*/src/generated/**", "packages/*/src/index.ts"],
      thresholds: { lines: 80, functions: 80, statements: 75, branches: 60 }
    }
  }
});
