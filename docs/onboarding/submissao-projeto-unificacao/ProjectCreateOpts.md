# `ProjectCreateOpts` — formato canônico

> **Status:** Fase 12 da unificação Submissão↔Projeto. Esta é a **única** forma aceita para criar ou vincular um projeto a partir de uma submissão China. Qualquer divergência reintroduz duplicidade de entrypoint e quebra o canary (`scripts/security/canary-submissao-projeto.sh`).

## Estrutura

Definida em [`src/lib/projetos/projectCreateOpts.ts`](../../../src/lib/projetos/projectCreateOpts.ts):

```ts
export interface ProjectCreateOpts {
  projetoNome?: string | null;
  templateB2cId?: string | null;
  secaoNome?: string;                          // default: "Documentos da Submissão"
  dataInicio?: string | null;                  // ISO date (YYYY-MM-DD)
  dataFimAlvo?: string | null;                 // ISO date (YYYY-MM-DD)
  prazoPadraoTarefa?: number | null;           // dias
  alertaAntecipacaoDias?: number | null;       // dias
  regimeCalendario?: "corridos" | "dias_uteis" | "uteis_com_sabado" | null;
  usaFeriados?: boolean | null;
  ufFeriados?: string | null;                  // UF (2 letras)
  substituir?: boolean;                        // default: false
}
```

## Mapeamento RPC

`buildRpcParams(submissaoId, projetoId, opts)` converte o objeto em parâmetros nomeados do `rpc_china_criar_projeto_espelho`. **Nunca chame o RPC sem passar por `buildRpcParams`** — caso contrário a aplicação de defaults diverge entre callers.

| Campo TS                  | Parâmetro RPC               | Default |
|---------------------------|-----------------------------|---------|
| `projetoNome`             | `p_projeto_nome`            | `null`  |
| `templateB2cId`           | `p_template_b2c_id`         | `null`  |
| `secaoNome`               | `p_secao_nome`              | `"Documentos da Submissão"` |
| `dataInicio`              | `p_data_inicio`             | `null`  |
| `dataFimAlvo`             | `p_data_fim_alvo`           | `null`  |
| `prazoPadraoTarefa`       | `p_prazo_padrao_tarefa`     | `null`  |
| `alertaAntecipacaoDias`   | `p_alerta_antecipacao_dias` | `null`  |
| `regimeCalendario`        | `p_regime_calendario`       | `null`  |
| `usaFeriados`             | `p_usa_feriados`            | `null`  |
| `ufFeriados`              | `p_uf_feriados`             | `null`  |
| `substituir`              | `p_substituir`              | `false` |
| (interno) `submissaoId`   | `p_submissao_id`            | obrigatório |
| (interno) `projetoId`     | `p_projeto_id`              | `null` em `create` / id em `linkExisting` |

## Entrypoints autorizados

Existem **dois e somente dois** entrypoints. Ambos consomem `ProjectCreateOpts`:

1. **`ProjectService.createFromSubmission(submissaoId, opts)`** — cria novo projeto-espelho (ou retorna o existente).
2. **`ProjectService.linkExisting(submissaoId, projetoId, opts)`** — vincula a um projeto existente.

A garantia de unicidade (no banco) vem do `UNIQUE INDEX china_submissao_projetos_submissao_id_uniq` (Fase 6).

## Uso — Fluxo 2 (Mesa China, `useCriarProjetoEspelho`)

```tsx
import { useCriarProjetoEspelho } from "@/hooks/useProjetoEspelhoSubmissao";

const criar = useCriarProjetoEspelho();

// Criar novo
await criar.mutateAsync({
  submissaoId: submissao.id,
  projetoNome: "Compact powder",
  templateB2cId: template.id,
  dataInicio: "2026-07-01",
  prazoPadraoTarefa: 5,
  regimeCalendario: "dias_uteis",
  usaFeriados: true,
});

// Vincular a projeto existente
await criar.mutateAsync({
  submissaoId: submissao.id,
  projetoId: projetoExistente.id,
});

// Substituir vínculo anterior (raro — uso administrativo)
await criar.mutateAsync({
  submissaoId: submissao.id,
  substituir: true,
  projetoNome: "Novo nome",
});
```

`CriarProjetoEspelhoArgs = ProjectCreateOpts & { submissaoId; projetoId? }` — qualquer campo de `ProjectCreateOpts` flui sem remapeamento manual.

## Uso — leitura do vínculo existente

```tsx
import {
  useProjetoEspelhoDaSubmissao,
  useSubmissaoDoProjetoEspelho,
} from "@/hooks/useProjetoEspelhoSubmissao";

const { data: vinculo } = useProjetoEspelhoDaSubmissao(submissao?.id);
const { data: submissao } = useSubmissaoDoProjetoEspelho(projeto?.id);
```

## Uso — Fluxo 1 (Ficha do Produto, `useCriarProjetoChina`)

O Fluxo 1 ainda usa `rpc_criar_projeto` (template `desenvolvimento_produto` + tarefas em código). A defesa contra duplicidade roda **antes** do create:

```ts
const existente = await ProjectService.findBySubmission(submissao.id);
if (existente) return openProjeto(existente.projeto_id);
```

Consolidar Fluxo 1 sobre `rpc_china_criar_projeto_espelho` muda comportamento (template diferente) e fica para uma PR dedicada com QA manual.

## Anti-padrões — proibidos

- ❌ Chamar `supabase.rpc("rpc_china_criar_projeto_espelho", { ... })` direto. Use `ProjectService`.
- ❌ Inserir em `china_submissao_projetos` direto sem `findBySubmission` antes.
- ❌ Criar novo hook que duplique a lógica de criação. Estenda `ProjectService` ou o hook existente.
- ❌ Remapear `ProjectCreateOpts` campo a campo dentro de um caller (sintoma de divergência futura — use spread).

## Testes de regressão

- [`projectService.test.ts`](../../../src/lib/projetos/__tests__/projectService.test.ts) — 7 testes unitários.
- [`projectFlows.integration.test.ts`](../../../src/lib/projetos/__tests__/projectFlows.integration.test.ts) — 5 testes de integração Fluxo 1 + Fluxo 2.
- [`buildRpcParams.contract.test.ts`](../../../src/lib/projetos/__tests__/buildRpcParams.contract.test.ts) — contrato: `create` e `linkExisting` produzem parâmetros idênticos exceto `p_projeto_id`.
- [`scripts/qa/smoke-submissao-projeto.spec.ts`](../../../scripts/qa/smoke-submissao-projeto.spec.ts) — smoke UI manual (Playwright) cobrindo os dois fluxos.
- Canary diário: `scripts/security/canary-submissao-projeto.sh`.
