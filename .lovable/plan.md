

## Cofre do Produto Dinâmico — Plano de Implementação

### Resumo

Transformar o Cofre do Produto de uma lista fixa de 8 slots (hardcoded em `PHOTO_FIELDS`) para um sistema configurável pelo Brasil, com checklist inteligente por contexto, barra de progresso e rastreabilidade completa. Incluir item obrigatório "Pedido China" para a planilha Excel que alimenta a IA.

---

### 1. Database — Novas Tabelas

**`cofre_produto_config`** — Itens configuráveis pelo Brasil:
- `id` (uuid PK), `nome_pt` (text NOT NULL), `nome_zh` (text), `tipo_anexo` (enum: foto/video/documento/qualquer), `qtd_minima` (int default 1), `obrigatorio` (bool default false), `aplicavel_a` (jsonb — filtros: todos/categoria/origem/fase), `status` (text: ativo/inativo), `ordem` (int), `criado_por` (uuid), `created_at`, `updated_at`

**`cofre_produto_itens`** — Itens por produto/submissão:
- `id` (uuid PK), `submissao_id` (uuid FK china_produto_submissoes), `config_id` (uuid FK cofre_produto_config, nullable para itens legados), `tipo_documento` (text), `nome_pt` (text), `nome_zh` (text), `obrigatorio` (bool), `qtd_minima` (int), `tipo_anexo` (text), `status` (text: pendente/aprovado/devolvido), `observacao_brasil` (text), `adicionado_por` (uuid), `created_at`

Os arquivos continuam em `china_produto_documentos` vinculados via `tipo_documento` matching ou um novo campo `cofre_item_id`.

**Migração de dados**: Seed com os 8 PHOTO_FIELDS atuais + novo item "Pedido China" (obrigatório) na `cofre_produto_config`. RLS: leitura para authenticated, escrita restrita a admin/coordenador via `has_role`.

---

### 2. Painel de Configuração (Brasil)

Nova aba em `Configuracoes.tsx` ou componente standalone `CofreProdutoConfig.tsx`:
- Tabela listando itens com colunas: Nome PT, Nome ZH, Tipo, Qtd Mín, Obrigatório, Aplicável a, Status
- Botões: Criar, Editar (dialog/modal), Desativar (toggle status)
- Drag-and-drop para reordenar (usando `@hello-pangea/dnd` já presente no projeto)
- Acesso restrito: verificar cargo do perfil (Coordenador/Gestor)

---

### 3. Cofre Dinâmico no `ChinaDataValidationDialog`

Substituir `PHOTO_FIELDS` hardcoded por query à `cofre_produto_config`:
- Carregar itens **FIXOS** (obrigatórios para todos)
- Carregar itens **CONTEXTUAIS** (filtro por categoria/origem/fase do produto)
- Carregar itens **ADICIONAIS** (inseridos pelo Brasil para esta submissão específica via `cofre_produto_itens`)
- Botão "+ Adicionar Item" ao final da grade que abre modal com checkbox dos itens configurados

Cada slot exibe: nome bilíngue, badge obrigatório/opcional, tipo aceito, contagem mínima.

---

### 4. Item "Pedido China" Obrigatório

Criar na seed um item `cofre_produto_config` com:
- `nome_pt`: "Pedido China (Planilha Excel)"
- `nome_zh`: "中国订单（Excel表格）"
- `tipo_anexo`: "documento"
- `obrigatorio`: true
- `qtd_minima`: 1
- `aplicavel_a`: `{"tipo": "todos"}`

Isso força o usuário a subir a planilha Excel original que gerou os dados da IA.

---

### 5. Barra de Progresso e Validação

No topo da seção Cofre:
- `Progress` bar com contagem `X/Y itens preenchidos`
- Cores: verde (preenchido), vermelho (obrigatório pendente), cinza (opcional pendente)
- Botão "Confirmar Dados" desabilitado até todos obrigatórios preenchidos + checkbox marcado

---

### 6. Notificação ao Brasil

Ao confirmar dados, inserir registro na tabela de notificações existente (ou `audit_logs`) com action `COFRE:dados_confirmados` contendo nome do produto. Status da submissão muda para "pendente" (já existe).

---

### 7. Arquivos Alterados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/` | Nova migration: criar `cofre_produto_config`, `cofre_produto_itens`, seed dados, RLS |
| `src/hooks/useCofreProdutoConfig.ts` | **Novo** — CRUD da config + query dinâmica |
| `src/components/china/ChinaDataValidationDialog.tsx` | Substituir PHOTO_FIELDS por query dinâmica, adicionar progress bar, botão "+ Adicionar" |
| `src/components/configuracoes/CofreProdutoConfig.tsx` | **Novo** — Painel de configuração com CRUD e drag-and-drop |
| `src/pages/Configuracoes.tsx` | Adicionar aba "Cofre do Produto" |

