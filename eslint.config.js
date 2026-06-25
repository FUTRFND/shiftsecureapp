import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // shadcn UI primitives and a few context providers intentionally export
    // both components and helpers (variants, hooks, contexts) from a single
    // file. Fast Refresh still works for the component exports in dev; the
    // rule's warning is a stylistic hint that doesn't apply to these files.
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/hooks/use-subscription.tsx",
      "src/lib/auth.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  eslintPluginPrettier,
  {
    // Lovable's publish metadata injector can append preview-image meta tags to
    // the root route after source edits. Keep publish lint focused on app code
    // instead of failing on injected metadata formatting in this shell file.
    files: ["src/routes/__root.tsx"],
    rules: {
      "prettier/prettier": "off",
    },
  },
);
