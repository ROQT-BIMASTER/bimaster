# Seed determinístico — E2E de Aprovações

## Objetivo

Garantir que cada execução do workflow `e2e-aprovacoes` no CI encontre **o mesmo
projeto, o mesmo lote e o mesmo item de aprovação** ("prospect" do teste), com
uma timeline previsível, independentemente de mudanças feitas por outros usuários
no preview.

## Componentes

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Schema/dados base | `supabase/migrations/2026…_seed_e2e_aprovacoes.sql` | Cria projeto, pipeline, etapa, lote, item e 2 eventos com **UUIDs fixos**. Idempotente (`ON CONFLICT DO NOTHING`). |
| Reset por execução | `scripts/seed/e2e-aprovacoes.ts` | Re-aponta `created_by` / `responsavel_id` para o `E2E_TEST_EMAIL`, garante role + supervisor, limpa comentários de runs anteriores. |
| Orquestração | `.github/workflows/e2e-aprovacoes.yml` (step *Seed determinístico*) | Roda o script com service role antes do Playwright. |

## UUIDs fixos

```text
projeto         00000000-e2e0-0000-0000-000000000001
pipeline (cfg)  00000000-e2e0-0000-0000-000000000002
etapa           00000000-e2e0-0000-0000-000000000003
lote/instancia  00000000-e2e0-0000-0000-000000000004
item            00000000-e2e0-0000-0000-000000000005
evento #1       00000000-e2e0-0000-0000-000000000006
evento #2       00000000-e2e0-0000-0000-000000000007
```

Use esses IDs em qualquer asserção de `data-testid` ou navegação direta
(`/dashboard/central/aprovacoes?item=00000000-e2e0-0000-0000-000000000005`)
para tornar o teste ainda mais robusto.

## Secrets necessários no GitHub

Em **Settings → Secrets and variables → Actions** do repositório:

| Secret | Descrição |
|---|---|
| `E2E_BASE_URL` | URL do preview (ex.: `https://id-preview--…lovable.app`). |
| `E2E_TEST_EMAIL` | E-mail do usuário de teste (login Playwright + dono dos fixtures). |
| `E2E_TEST_PASSWORD` | Senha desse usuário. |
| `E2E_SUPERVISOR_EMAIL` | *(opcional)* E-mail do supervisor; será setado em `profiles.supervisor_id`. |
| `E2E_SUPABASE_URL` | URL do projeto backend (mesmo de `VITE_SUPABASE_URL`). |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | **Service role** — necessária para reescrever `created_by` via SDK. |

> A `service_role` é exclusiva do CI (nunca exposta ao front). O script roda
> server-side com `autoRefreshToken: false` e não persiste sessão.

## Rodar localmente

```bash
export SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="…"
export E2E_TEST_EMAIL="qa@example.com"
export E2E_SUPERVISOR_EMAIL="lider@example.com"  # opcional
bun run scripts/seed/e2e-aprovacoes.ts
```

Saída esperada:

```text
[seed-e2e] Usuário de teste: qa@example.com → <uuid>
[seed-e2e] Comentários de runs anteriores removidos: N
[seed-e2e] OK — ambiente determinístico pronto.
```

## Determinismo da timeline

A migration insere **dois eventos com `entrou_em` fixo** (`2026-01-01` e
`2026-01-02`). O reset apaga apenas eventos cujo `comentario` começa com
`Teste e2e CI ` (padrão usado pelo spec em
`e2e/aprovacoes/aprovacoes-flow.spec.ts`). Assim:

- A timeline sempre começa com os dois eventos seed.
- Cada execução adiciona exatamente **1** novo comentário e o limpa no início
  da próxima execução.

## Manutenção

- **Não** crie novos comentários manualmente nesse lote a partir do app — o
  reset os preserva (filtro pelo prefixo `Teste e2e CI `), mas eles poluem o
  drawer e dificultam debugging visual.
- Se um campo NOT NULL for adicionado às tabelas de fluxo, atualize **a
  migration** (não o script) para que o seed continue idempotente em ambientes
  novos.
