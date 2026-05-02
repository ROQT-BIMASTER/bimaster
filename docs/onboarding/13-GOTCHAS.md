---
title: Gotchas
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 13 — Gotchas

Lista única de armadilhas conhecidas. **Leia antes do primeiro PR.**

---

## 13.1 Datas `DATE` shiftam um dia (UTC bug)

```ts
// ❌ Mostra 30/04 em America/Sao_Paulo quando o valor é "2026-05-01"
new Date("2026-05-01").toLocaleDateString();

// ✅ Correto
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
parseLocalDate("2026-05-01")!.toLocaleDateString();
```

`new Date("YYYY-MM-DD")` interpreta como **UTC midnight**. Em fuso negativo
(SP = UTC-3), recua para o dia anterior. Quebra `isToday`, `isBefore`,
`isWithinInterval`. Vale para **toda coluna `DATE`** do Postgres.

Para `TIMESTAMPTZ` com offset embutido (`"2026-05-01T10:00:00-03:00"`),
`new Date(s)` é seguro — `parseLocalDate` faz fallback automático.

---

## 13.2 `supabase.functions.invoke` não tem timeout

Se a Edge Function travar, o spinner roda **para sempre**. Use **sempre**
`invokeChat` (`src/lib/ai/invokeChat`) para IA, e considere timeout próprio
em outras chamadas.

---

## 13.3 Anon key legacy vs publishable key

Use **`VITE_SUPABASE_PUBLISHABLE_KEY`** no front. A anon key legacy
(`VITE_SUPABASE_ANON_KEY`) está deprecada para projetos novos do Lovable Cloud
e pode dar 401 em endpoints recentes.

---

## 13.4 `reasoning` em modelos OpenAI dá 400

```ts
// ❌
{ model: "openai/gpt-5.2", reasoning: { effort: "high" } }   // 400!

// ✅
{ model: "google/gemini-2.5-pro", reasoning: { effort: "high" } }
{ model: "openai/gpt-5.2" }   // sem reasoning
```

`callAIGateway` já filtra por segurança, mas ao chamar o gateway direto (não
recomendado) você quebra.

---

## 13.5 Limite default de 1000 linhas no Supabase

Quando você "perdeu dados", verifique se está hitando o limite:

```ts
const { data } = await supabase.from("x").select("*"); // máx 1000!
```

Use paginação (`range`), `useInfiniteQuery`, ou `fetchAllRows`
(`src/lib/utils/fetchAllRows.ts`).

---

## 13.6 `gerente_id` deprecado

Não use `gerente_id` em código novo. Use **`supervisor_id`** (recursivo).
Memória: `mem://architecture/hierarchy-and-supervision-standards`.

---

## 13.7 Cores literais quebram o tema

```tsx
<div className="bg-white text-black">  // ❌ quebra dark mode
<div className="bg-card text-card-foreground">  // ✅
```

Quebra automática em dark mode + impede white-label de marca.

---

## 13.8 `window.open` para arquivos privados

Vaza signed URL no histórico do navegador / referer. Use:

```ts
import { triggerBlobDownload } from "@/lib/utils/storage-download";
await triggerBlobDownload(supabase, "bucket", "path/file.pdf");
```

Memória: `mem://architecture/storage-blob-download-protocol`.

---

## 13.9 Roles em `profiles` = privilege escalation

Sempre `user_roles` + `has_role()` SECURITY DEFINER. Se você ver código antigo
com `profile.is_admin`, refatore.

---

## 13.10 `localStorage` para checar admin = hackeável

```ts
// ❌
if (localStorage.getItem("isAdmin") === "true") { showAdminPanel(); }

// ✅ — UI espelha; decisão final é server-side via RLS
const { data: isAdmin } = useQuery({
  queryKey: ["has-role", "admin"],
  queryFn: () => supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
});
```

---

## 13.11 `CHECK (expire_at > now())` quebra restore

Constraints CHECK precisam ser **imutáveis**. `now()` não é. Use trigger:

```sql
create or replace function public.tg_validate_expire()
returns trigger language plpgsql as $$
begin
  if new.expire_at <= now() then
    raise exception 'expire_at must be in the future';
  end if;
  return new;
end;
$$;

create trigger trg_validate_expire
before insert or update on public.minha_tabela
for each row execute function public.tg_validate_expire();
```

---

## 13.12 Editar `src/integrations/supabase/types.ts` ou `.env`

São **auto-gerados**. Edição manual é sobrescrita no próximo deploy. Para
mudar tipos, rode migration → tipos regeneram.

---

## 13.13 Edge Function sem `Deno.serve`

Lovable Cloud espera `Deno.serve(handler)` no top-level. Sem isso, a função
nem inicia.

```ts
Deno.serve(secureHandler({...}, async (req, ctx) => { ... }));
```

---

## 13.14 Edge Function sem `secureHandler`

Sem o wrapper, você perde: WAF, IP blocklist, JWT validation, quarentena, MFA,
step-up, rate-limit, security headers. **Use sempre.**

---

## 13.15 Zod sem `.strict()` = mass-assignment

```ts
// ❌
z.object({ nome: z.string() })   // aceita { nome, role: "admin" }!

// ✅
z.object({ nome: z.string() }).strict()
```

---

## 13.16 Migration alterando schemas Supabase reservados

**Nunca** mexa em `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
Não anexe triggers a tabelas nesses schemas. Quebra o serviço.

---

## 13.17 `git` no agent Lovable

Não rode `git add/commit/push/pull/merge/rebase/reset/stash/checkout` dentro
do agent — o harness gerencia. Em IDE local, fluxo Git normal.

---

## 13.18 `bun run build` no agent Lovable

O harness compila automaticamente após cada edição. Rodar manualmente é
desperdício de tempo e pode confundir o estado.

---

## 13.19 `find /` ou `find /root`

Nunca. Escopo de busca **sempre** ao projeto:

```bash
rg -l "padrão" src/        # ✅
find src -name "*.ts"      # ✅
find / -name "x"           # ❌
```

---

## 13.20 `sleep N` solto no agent

Sem condição de saída, é cego. Use loop:

```bash
for i in $(seq 1 30); do curl -sf http://localhost:8080 > /dev/null && break || sleep 2; done
```

---

## 13.21 `noscript` com `<img>` no `<head>`

HTML5 não permite. `<noscript>` no `<head>` só aceita metadados (`<link>`,
`<style>`, `<meta>`). Pixels de tracking vão no `<body>`.

---

## 13.22 Mencionar "Supabase" para o usuário final

Sempre "backend" / "Lovable Cloud". White-label. Memória:
`mem://architecture/white-label-technology-masking`.

---

## 13.23 Streaming SSE quebra em chunk parcial

JSON pode chegar partido entre chunks. Re-buffer:

```ts
try {
  const parsed = JSON.parse(jsonStr);
  // ...
} catch {
  // re-anexa ao buffer e espera mais bytes
  textBuffer = line + "\n" + textBuffer;
  break;
}
```

Veja `src/hooks/useQAAgent.ts`.

---

## 13.24 Toast de erro genérico em IA

Use **sempre** `error.userMessage` do `invokeChat` — já vem em PT-BR e
traduz 402/429/timeout.

```ts
if (error) toast.error(error.userMessage);
```

---

## 13.25 AP/AR pagas/canceladas modificadas

São **imutáveis**. Modificação requer reabertura justificada com auditoria.
Se você está editando uma diretamente, está errado.
