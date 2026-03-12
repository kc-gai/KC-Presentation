import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // AI-SDLC 강화 규칙 (Phase 0 — 2026-02-24)
  {
    rules: {
      // ESLint 위임 패턴 10개 중 9개 적용
      // (no-implicit-any-catch는 deprecated → 제외)
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { "argsIgnorePattern": "^_" },
      ],
      "no-unreachable": "error",
      "no-empty": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-nested-ternary": "warn",
      "@typescript-eslint/consistent-type-assertions": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "no-magic-numbers": [
        "warn",
        {
          "ignore": [0, 1, -1],
          "ignoreArrayIndexes": true,
          "ignoreDefaultValues": true,
          "enforceConst": true,
        },
      ],
    },
  },
]);

export default eslintConfig;
