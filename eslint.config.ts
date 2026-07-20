import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// 工具脚本与 package 都执行类型感知 lint，避免生成器和 runtime 的安全策略发生静默漂移。
export default defineConfig(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/src/generated/**"]
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.tooling.json", "./packages/*/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error"
    }
  },
  {
    files: ["scripts/**/*.ts", "eslint.config.ts", "vitest.config.ts"],
    rules: { "no-console": "off" }
  },
  {
    files: ["packages/*/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unsafe-type-assertion": "off",
      "@typescript-eslint/require-await": "off"
    }
  }
);
