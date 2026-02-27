

# Plano de Correção e Melhorias

## 1. Tela Branca para Erika, Faturamento e Compras (CRÍTICO - Produção)

**Diagnóstico:** Os três usuários possuem permissões corretas no banco (módulo `fabrica`, `precos`). O `DashboardRedirect` deveria redirecioná-los para `/dashboard/fabrica`. Possíveis causas da tela branca:
- O componente `DashboardLayout` retorna `null` na linha 72 se `!session` enquanto o auth ainda carrega
- Race condition entre `AuthContext.loading` e `PermissionsContext.loading` onde um resolve antes do outro
- Erro silencioso no `FabricaModule` que busca `fabrica_ficha_revisoes` (tabela que **não existe**) causando crash no render

**Ações:**
1. Corrigir a referência à tabela inexistente `fabrica_ficha_revisoes` em `FabricaProdutosAcabados.tsx` (linha 95) — alterar para `fabrica_ficha_custo_revisoes` que é a tabela real
2. Adicionar `ErrorBoundary` local no `DashboardLayout` para capturar erros de renderização filhos e mostrar mensagem amigável em vez de tela branca
3. No `DashboardRedirect`, adicionar safety timeout de 5s: se `loading` continuar `true` após 5s, forçar redirecionamento para `/dashboard/instalar-app`
4. Validar e testar o fluxo com browser automation após as correções

---

## 2. Diretor Não Visualiza Evidências na Revisão de Fichas

**Diagnóstico:** A página `FichaRevisaoDiretoria.tsx` exibe apenas o snapshot de insumos e os apontamentos, mas **não carrega nem exibe** as evidências da tabela `fabrica_custo_evidencias`. A RLS permite leitura (SELECT com `using: true`), então é puramente um problema de UI — o código nunca consulta essa tabela.

**Ações:**
1. No dialog de análise em `FichaRevisaoDiretoria.tsx`, adicionar consulta à tabela `fabrica_custo_evidencias` filtrando pelo `produto_id` da ficha
2. Criar uma seção "Evidências e Orçamentos Enviados" no dialog mostrando:
   - Nome do arquivo, tipo, data de upload, usuário que enviou
   - Botão para visualizar/download (usando signed URL do storage)
   - Indicação visual se é evidência ou orçamento
3. Também carregar e exibir os dados de contestações e resoluções manuais dos requisitos (`fabrica_revisao_requisitos` com campos `contestado`, `contestacao_motivo`, `resolvido_manualmente`)
4. Adicionar aba/seção de "Requisitos e Status" para o diretor ver o progresso de cada requisito (cumprido, contestado, pendente)

---

## 3. Visualização em Cards para Produtos Acabados

**Diagnóstico:** A tela atual usa apenas formato de tabela. As imagens de referência mostram cards com: nome do produto, código, custo unitário, itens/display, Proc. Anvisa, NCM, Lead Time, composição de grade (variantes com EAN), badges de status (Modo Foco, Ativo), e uma segunda view com planejamento global/origem.

**Ações:**
1. Criar migração para adicionar colunas na tabela `fabrica_produtos`:
   - `ncm` (varchar) — Nomenclatura Comum do Mercosul
   - `processo_anvisa` (varchar) — Número do processo Anvisa
   - `lead_time_dias` (integer) — Lead time em dias
   - `custo_unitario` (numeric) — Custo unitário exibido no card
   - `itens_display` (integer) — Qtd. itens por display
   - `modo_foco` (boolean, default false) — Flag de modo foco
2. Criar componente `ProdutoCard.tsx` replicando o design da imagem de referência com tema escuro
3. Em `FabricaProdutosAcabados.tsx`, adicionar toggle "Tabela / Cards" ao lado dos filtros existentes, preservando a view tabela como padrão
4. Os cards devem mostrar: nome, código, badges (Modo Foco, Ativo/Inativo), custo unitário, itens/display, Anvisa, NCM, Lead Time
5. Buscar variantes/composição de grade se existir tabela de variantes (ou criar estrutura para tal)

---

## Detalhes Técnicos

### Arquivos a Modificar
- `src/pages/FabricaProdutosAcabados.tsx` — fix tabela inexistente + toggle cards/tabela
- `src/pages/FichaRevisaoDiretoria.tsx` — seção de evidências e requisitos
- `src/components/auth/DashboardRedirect.tsx` — safety timeout
- `src/components/dashboard/DashboardLayout.tsx` — error boundary local

### Arquivos a Criar
- `src/components/fabrica/ProdutoCard.tsx` — componente de card individual
- Migration SQL para novas colunas em `fabrica_produtos`

### Ordem de Execução
1. Fix tela branca (item 1) — **prioridade máxima, produção afetada**
2. Evidências na revisão (item 2)
3. View em cards (item 3)

