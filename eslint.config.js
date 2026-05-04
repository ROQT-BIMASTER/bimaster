import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
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
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // === Quality gates (warning level — não quebra build atual) ===
      // Previne regressão de console.log em código novo. logger.error pode usar console.error internamente.
      "no-console": ["warn", { allow: ["error"] }],
      // Previne regressão de any
      "@typescript-eslint/no-explicit-any": "warn",
      // Proíbe @ts-ignore; permite @ts-expect-error com descrição
      "@typescript-eslint/ban-ts-comment": ["warn", {
        "ts-ignore": true,
        "ts-expect-error": "allow-with-description",
      }],
      // Previne código morto; permite prefixo _ para args/vars intencionalmente não usados
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      // debugger nunca deve ir para produção
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
