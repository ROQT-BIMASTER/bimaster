// ESLint config para edge functions Deno (`supabase/functions/**`).
// Separado do `eslint.config.js` principal porque:
//   - Edge functions são Deno, não React (sem `react-hooks`, sem `react-refresh`).
//   - Usam imports `npm:`/`https://esm.sh/` que o resolver TS do projeto principal não conhece.
//   - `supabase/functions/projeto-*` está explicitamente excluído desta fase
//     (restrição de "não tocar Projetos").
//
// Modo de rollout: rodar em CI sem bloquear (max-warnings alto) por 2 semanas
// antes de promover regras a erro.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      // Não tocar Projetos nesta onda
      "supabase/functions/projeto-*/**",
      // Compartilhados são código genérico — incluir
      // Demais funções de borda
      "supabase/functions/**/*.test.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        Deno: "readonly",
      },
    },
    rules: {
      // Quality gates — todos como warn nesta fase
      "no-console": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": ["warn", {
        "ts-ignore": true,
        "ts-expect-error": "allow-with-description",
      }],
      "no-debugger": "error",
      "no-empty": "warn",
      "no-case-declarations": "warn",
      "no-useless-escape": "warn",
      "prefer-const": "warn",
    },
  },
);
