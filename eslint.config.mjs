import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "scripts/**/*.ts",
      "src/**/*.{test,spec}.{ts,tsx}",
      "src/components/visibility-matrix/**/*.tsx",
      "src/components/global-progress-bar.tsx",
      "src/lib/hooks/useActivationCounter.ts",
      "src/app/api/kanban/route.ts",
      "src/app/api/benchmark/scheduled/[stage]/route.ts",
      "src/components/admin/StageList.tsx",
      "src/lib/analysis/types.ts",
      "src/lib/chat/systemPrompt.ts",
      "src/lib/db.ts",
      "src/lib/matrix/db.ts",
      "src/lib/runs/aggregator.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "off",
      "prefer-const": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
