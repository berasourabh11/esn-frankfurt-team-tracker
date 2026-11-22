import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Must come last: turns off stylistic rules that conflict with Prettier.
  prettier,
  globalIgnores([
    ".next/**",
    ".next-api/**",
    ".open-next/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    // The API has its own package and type check (backend/).
    "backend/**",
  ]),
]);

export default eslintConfig;
