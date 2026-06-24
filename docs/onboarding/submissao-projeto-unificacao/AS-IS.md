# AS-IS — Submissão China → Projeto

Dois fluxos coexistem hoje convertendo `china_produto_submissoes` em `projetos`, **sem serviço compartilhado** e **sem UNIQUE constraint** que previna duplicação.

---

## Fluxo 1 — Ficha do Produto (`ChinaFichaProduto`)

### UI
- `ChinaProjetosVinculadosSection` — `src/pages/ChinaFichaProduto.tsx:849` (inline)
- Botões "Criar projeto" / "Criar outro projeto" — `src/pages/ChinaFichaProduto.tsx:952,985`
- Botão "Force create" (bypass de auditoria IA) — `src/pages/ChinaFichaProduto.tsx:937`

### Hooks / Services
- `useChinaProjetosVinculados` — `src/hooks/useChinaProjeto.ts:46`
- `useCriarProjetoChina` — `src/hooks/useChinaProjeto.ts:223` (mutation central)
- `useAuditChinaVinculo` — `src/pages/ChinaFichaProduto.tsx:856` (IA pré-criação, não bloqueia)
- RPC: `rpc_criar_projeto` — `src/hooks/useChinaProjeto.ts:282`

### Sequência (`useCriarProjetoChina`)
```
rpc_criar_projeto             → projetos
 └─ select projeto_secoes     → projeto_secoes (geradas pelo RPC com template "desenvolvimento_produto")
    └─ insert lote            → projeto_tarefas (lista hardcoded TAREFAS_POR_SECAO, useChinaProjeto.ts:7-36)
       └─ insert lote         → projeto_tarefa_produtos (FK tarefa_id + produto_id = submissao.id)
          └─ insert           → china_submissao_projetos (is_espelho = false)
```

### Características
| Item | Valor |
|---|---|
| Edge function | Nenhuma na criação (só `useAuditChinaVinculo` antes) |
| Storage buckets | **Nenhum** — documentos da submissão **não** são copiados |
| Responsável da tarefa | Não preenchido (só `criador_id = user.id`) |
| Status inicial das tarefas | `"pendente"` (hardcoded `useChinaProjeto.ts:315`) |
| `is_espelho` | **`false`** → projeto invisível para Mesa China |
| Prazos/regime de calendário | Não suporta |
| Template B2C | Não suporta |
| Proteção contra duplicata | **Nenhuma** — insert direto sem checar existência (`useChinaProjeto.ts:341`) |
| Tipo do projeto | `"desenvolvimento_produto"`, `origem_projeto: "china"` |

---

## Fluxo 2 — Vincular China (Mesa China / `ProjetoVincularChina`)

Dois sub-pontos de entrada:

### 2A — Mesa China → "Continuar no projeto"
- Página: `src/pages/ProjetoVincularChina.tsx` — rota `/dashboard/projetos/vincular-china`
- `VincularChinaSidePanel` — `src/components/china/VincularChinaSidePanel.tsx:251`
- `ContinuarNoProjetoDialog` — `src/components/china/inbox/ContinuarNoProjetoDialog.tsx:36`
- `useProjetoEspelhoDaSubmissao` (detecta espelho já existente) — `ContinuarNoProjetoDialog.tsx:48`

### 2B — Mesa China → "Encaminhar ao projeto"
- `EncaminharProjetoDialog` — `src/components/china/vincular/EncaminharProjetoDialog.tsx:284`
- `ConfigurarProjetoEspelhoDialog` — `src/components/china/vincular/ConfigurarProjetoEspelhoDialog.tsx:34`
- `VincularChinaVincularTab` (vincula tarefas existentes a submissão) — `src/components/china/VincularChinaVincularTab.tsx`

### Hooks / Services
- `useCriarProjetoEspelho` — `src/hooks/useProjetoEspelhoSubmissao.ts:78` (mutation central)
- `useProjetoEspelhoDaSubmissao` — `useProjetoEspelhoSubmissao.ts:14`
- `useSubmissaoDoProjetoEspelho` — `useProjetoEspelhoSubmissao.ts:31`
- `useProjetosParaVinculo` — `src/hooks/useChinaTarefaVinculos.ts:36`
- `useCreateVinculo` — `src/hooks/useChinaTarefaVinculos.ts:145`
- `useTemplatesB2C` — `ContinuarNoProjetoDialog.tsx:50`
- RPC: `rpc_china_criar_projeto_espelho` — assinatura em `src/integrations/supabase/types.ts:54559`

### Tabelas escritas
| Tabela | Como |
|---|---|
| `projetos` | via `rpc_china_criar_projeto_espelho` |
| `china_submissao_projetos` | via RPC, **`is_espelho = true`** |
| `china_submissao_tarefa_vinculos` | via `useCreateVinculo` (UNIQUE em `submissao_id+tarefa_id`, erro 23505 capturado em `useChinaTarefaVinculos.ts:173`) |
| `china_checklist_brasil_china` | via `p_template_b2c_id` (campo `projeto_tarefa_id` referencia tarefa criada) |
| `projeto_tarefas` | geradas pelo RPC a partir do template B2C |

### Características
| Item | Valor |
|---|---|
| Edge function | Nenhuma (tudo via RPC Postgres) |
| Storage buckets | **Nenhum** — documentos da submissão também **não** são copiados |
| Configuração de prazos | Sim: `p_data_inicio`, `p_data_fim_alvo`, `p_prazo_padrao_tarefa`, `p_alerta_antecipacao_dias`, `p_regime_calendario`, `p_usa_feriados`, `p_uf_feriados` |
| Vincular a projeto existente | Sim (`p_projeto_id`) |
| Template B2C | Sim (`p_template_b2c_id`) |
| Detecção de espelho existente | Sim (oferece "Abrir projeto" sem recriar) |
| Substituição de espelho | `p_substituir=true` desativa `is_espelho` anterior |
| `is_espelho` | **`true`** |
| Audit AI | Não |
| Navegação pós-criação | `/dashboard/projetos/${id}?tab=submissao_board` |

---

## Tabelas-chave

### `china_submissao_projetos` (`types.ts:7227-7280`)
```
id            uuid PK
submissao_id  uuid FK → china_produto_submissoes.id
projeto_id    uuid FK → projetos.id
is_espelho    boolean default false
created_by    uuid
created_at    timestamptz
```
- **Nenhum UNIQUE constraint** em `submissao_id` nem `(submissao_id, projeto_id)`.
- Fluxo 1 pode inserir N linhas para a mesma submissão.
- Fluxo 2 só protege o slot `is_espelho=true` (lógica no RPC).

### `china_submissao_tarefa_vinculos`
- UNIQUE `(submissao_id, tarefa_id)` inferido de erro 23505 capturado.

### `china_produto_submissoes` (`types.ts:6736-6840`)
- **Não existem** campos `foto_*`, `imagem_*`, `thumbnail_*`.
- Apenas `arte_final_path` + `arte_final_url`.
- "Foto oficial" exige nova coluna `foto_oficial_path` ou uso de `china_produto_documentos` com tipo dedicado.

---

## Diferenças observáveis

| Dimensão | Fluxo 1 | Fluxo 2 |
|---|---|---|
| Hook | `useCriarProjetoChina` | `useCriarProjetoEspelho` |
| RPC | `rpc_criar_projeto` (genérico) | `rpc_china_criar_projeto_espelho` |
| `is_espelho` | `false` | `true` |
| Origem das tarefas | Hardcoded (`TAREFAS_POR_SECAO`) | Template B2C |
| Linkagem tarefa↔submissão | `projeto_tarefa_produtos` | `china_checklist_brasil_china.projeto_tarefa_id` |
| Prazos | Não | Sim |
| Template B2C | Não | Sim |
| Detecção de duplicata | Nenhuma | Sim (slot `is_espelho`) |
| Audit AI | Sim | Não |
| Navegação | `/dashboard/projetos/:id` | `…?tab=submissao_board` |
| Visível na Mesa China | Não (filtra `is_espelho=true`) | Sim |

---

## Riscos identificados

1. **Ausência de UNIQUE em `china_submissao_projetos`** → submissão pode ter N projetos.
2. **Dois RPCs independentes** sem core compartilhado → divergência de regras (status, responsáveis, prazos).
3. **Tabelas de linkagem incompatíveis** (`projeto_tarefa_produtos` vs `china_checklist_brasil_china.projeto_tarefa_id`) — leituras de um fluxo ignoram tarefas do outro.
4. **Documentos nunca são copiados** em nenhum fluxo — ficam só na submissão.
5. **Projetos do Fluxo 1 são invisíveis** na Mesa China por nunca setarem `is_espelho`.
6. **Sem campo de foto oficial** na submissão — UI atual exibe arte final (campo distinto).

---

## Open questions (resolver na Fase 1)

1. Corpo SQL completo de `rpc_china_criar_projeto_espelho` (necessário inspecionar migrations) — define quais seções/tarefas cria sem `p_template_b2c_id`.
2. Policies RLS de `china_submissao_projetos` (não vieram no snapshot).
3. Nome real e critério da edge function de audit AI (`useAuditChinaVinculo`).
4. Bucket destino real para documentos da submissão (provavelmente `china-documentos`, visto em `useArquivarAnexoChat.ts:69`).
