

## Plano: Exportar Briefing com Imagem do Produto + Auditoria IA do Briefing

### Problema 1: Exportação Excel do Briefing com imagem do produto
Atualmente, não existe nenhuma função de exportação no `BriefingView`. Preciso adicionar um botão "Exportar Excel" que gere uma planilha com os campos do briefing e inclua a imagem do produto na primeira célula.

### Problema 2: Auditoria IA do Briefing
Seguir o padrão já existente no `ProductLaunchPanel.tsx` (que usa `audit-produto-tarefa`) para criar uma auditoria IA no contexto do briefing. Quando o briefing e o produto vinculado existirem, a IA analisa se o conteúdo do briefing é compatível com a tarefa e o produto.

---

### Implementação

#### 1. Exportação Excel no BriefingView

**Arquivo**: `src/components/projetos/BriefingView.tsx`

- Adicionar prop opcional `produtoInfo?: { nome: string; codigo: string; foto_url?: string }`
- Adicionar botão `Download` no header (ícone Download)
- Função `handleExport` usando `ExcelJS`:
  - Primeira aba: "Briefing" com imagem do produto no topo (fetch da URL → addImage ao workbook)
  - Tabela abaixo com colunas: Categoria, Campo, Valor, Responsabilidade
  - Header estilizado e bordas
- Usar `exceljs` + `file-saver` (já instalados)

#### 2. Nova Edge Function: `audit-briefing-tarefa`

**Arquivo**: `supabase/functions/audit-briefing-tarefa/index.ts`

- Mesmo padrão do `audit-produto-tarefa` existente
- Recebe: `{ tarefa, produto, briefingCampos }` 
- System prompt analisa se os campos do briefing correspondem ao produto e à tarefa
- Retorna `{ match, confianca, motivo, alertas }` via tool calling
- Modelo: `google/gemini-2.5-flash-lite`

#### 3. Integrar Auditoria no BriefingView / TarefaFocusMode

**Arquivo**: `src/components/projetos/BriefingView.tsx`

- Adicionar props: `tarefaContext?`, `linkedProduto?`
- Quando ambos existem + briefing tem campos, auto-executar auditoria
- Exibir badge de resultado (ShieldCheck/ShieldQuestion/ShieldAlert) com tooltip no header
- Seguir o mesmo padrão visual do `AUDIT_CONFIG` no `ProductLaunchPanel`

**Arquivo**: `src/components/projetos/TarefaFocusMode.tsx`

- Passar `tarefaContext` e `linkedProduto` para o `BriefingView` no modo foco

#### 4. Adicionar `verify_jwt = false` no config.toml

**Arquivo**: `supabase/config.toml` — NÃO editável. A função será deployada automaticamente.

---

### Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/audit-briefing-tarefa/index.ts` |
| Editar | `src/components/projetos/BriefingView.tsx` — exportação Excel + auditoria IA |
| Editar | `src/components/projetos/TarefaFocusMode.tsx` — passar props ao BriefingView |
| Editar | `src/components/projetos/ProjetoBriefingPanel.tsx` — passar props ao BriefingView expandido |

