/**
 * Env fallback — workaround temporário enquanto a injeção automática de
 * VITE_SUPABASE_* no build de produção do Lovable está indisponível
 * (billing pendente / plano degradado).
 *
 * Os valores abaixo são PUBLISHABLE (anon-pública), desenhados para ir no
 * bundle do browser. Não há vazamento de segredo — são as mesmas chaves
 * expostas em qualquer cliente Supabase no front. RLS continua sendo a
 * camada de proteção real.
 *
 * Este módulo é importado em `src/main.tsx` ANTES de qualquer outro código
 * que leia `import.meta.env.VITE_SUPABASE_*`. Se as vars já existirem no
 * build (caso ideal), os valores hardcoded são ignorados.
 *
 * REMOVER assim que o build de produção voltar a injetar as env vars
 * automaticamente. Ver .lovable/plan.md.
 */

const FALLBACK = {
  VITE_SUPABASE_PROJECT_ID: "aokkyrgaqjarhlywhjju",
  VITE_SUPABASE_URL: "https://aokkyrgaqjarhlywhjju.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva2t5cmdhcWphcmhseXdoamp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDA0MjYsImV4cCI6MjA3NDc3NjQyNn0.PlGQQyGUwOZKITqjdWyk-PXo0duk8s2TsKm8uJSZJ7s",
} as const;

// Vite substitui `import.meta.env.VITE_*` em build time por strings literais.
// Se a string for "undefined" (caso em que a var não existia no build), o
// fallback é aplicado em runtime via globalThis.
type EnvKey = keyof typeof FALLBACK;
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

(Object.keys(FALLBACK) as EnvKey[]).forEach((key) => {
  const current = env?.[key];
  if (!current || current === "undefined") {
    try {
      env[key] = FALLBACK[key];
    } catch {
      // import.meta.env pode ser readonly em alguns contextos — ignora.
    }
  }
});

export {};
