import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dev-dist", "build", "coverage", "e2e/**", "supabase/functions/**", "scripts/**", "audit/**", "*.config.{js,ts,cjs,mjs}", "cloudflare/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // === Type-aware hardening (warn — baseline, não bloqueia build) ===
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "react-hooks/exhaustive-deps": "warn",

      // Regras type-aware do preset recommendedTypeChecked que geram muito ruído
      // no baseline atual — manter desligadas nesta passada, ativar gradualmente.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",

      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-duplicate-type-constituents": "off",
      "@typescript-eslint/no-implied-eval": "off",
      "@typescript-eslint/prefer-promise-reject-errors": "off",
      "@typescript-eslint/only-throw-error": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unnecessary-type-arguments": "off",
      "@typescript-eslint/no-for-in-array": "off",
      "@typescript-eslint/prefer-regexp-exec": "off",
      "@typescript-eslint/dot-notation": "off",
      "@typescript-eslint/no-meaningless-void-operator": "off",
      "@typescript-eslint/consistent-type-assertions": "off",
      "@typescript-eslint/non-nullable-type-assertion-style": "off",

      // Baseline: rebaixar para warn regras pré-existentes que estavam como error
      // nos presets js/ts. Serão promovidas gradualmente em PRs futuros.
      "prefer-const": "warn",
      "no-empty": "warn",
      "no-case-declarations": "warn",
      "no-useless-escape": "warn",
      "no-async-promise-executor": "warn",
      "no-control-regex": "warn",
      "no-constant-binary-expression": "warn",
      "prefer-rest-params": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-unsafe-enum-comparison": "warn",
      
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "react-hooks/rules-of-hooks": "warn",




      // === Quality gates (warning level — não quebra build atual) ===
      "no-console": ["warn", { allow: ["error"] }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": ["warn", {
        "ts-ignore": true,
        "ts-expect-error": "allow-with-description",
      }],
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "no-debugger": "error",

      // Força uso do barrel oficial @/hooks/itemHistorico em vez do arquivo interno.
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@/hooks/useItemHistorico",
          message: "Importe sempre de '@/hooks/itemHistorico' (barrel oficial). Veja src/hooks/itemHistorico/README.md.",
        }],
        patterns: [{
          group: ["**/hooks/useItemHistorico", "**/hooks/useItemHistorico.ts"],
          message: "Importe sempre de '@/hooks/itemHistorico' (barrel oficial). Veja src/hooks/itemHistorico/README.md.",
        }],
      }],
    },
  },
  {
    // O próprio barrel precisa reexportar do arquivo interno.
    files: ["src/hooks/itemHistorico/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);

