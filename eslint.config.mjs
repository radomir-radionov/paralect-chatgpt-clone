import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: ["app/**/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@domains/**/queries/*fetchers", "@domains/**/queries/*-fetchers"],
              message:
                "Components (including Server Components) must fetch via API routes only. Use @domains/**/api/* instead of importing DB fetchers.",
            },
            {
              group: [
                "@shared/lib/supabase/server",
                "@shared/lib/supabase/env",
                "@shared/lib/supabase/getCurrentUser",
              ],
              message:
                "Components must not access Supabase/DB directly. Fetch via API routes and keep service-role access inside route handlers/services.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
