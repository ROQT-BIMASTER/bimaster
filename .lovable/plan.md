

# Caixa de Validação de Dados da IA com Edição Protegida por Senha

## Problema
Após a IA extrair os dados, o sistema exibe um preview estático sem validação formal. A quantidade total (777.600) aparece, mas as quantidades por cor/grupo não ficam claras para conferência. Não há aceite formal nem possibilidade de ajustar dados após a confirmação.

## Solução

### 1. Novo componente `ChinaDataValidationDialog`
Dialog modal que abre automaticamente após a IA retornar os dados, contendo:

**Seção Dados Gerais** (editável antes do aceite):
- Código, Nome, Fórmula, Item, Ordem em inputs
- Quantidade Total com destaque visual

**Seção Grade de Cores** (tabela editável):
- Tabela com colunas: Grupo | Cor | Quantidade | Ações
- Soma automática das quantidades por grupo e total geral
- Alerta visual se soma das cores divergir do `qty_total`
- Botão para adicionar/remover linhas

**Seção Pesos**:
- Peso bruto e líquido editáveis

**Rodapé**:
- Checkbox de aceite: "Confirmo que revisei todos os dados extraídos pela IA"
- Botão "Confirmar Dados" (habilitado só com aceite marcado)

### 2. Edição pós-aceite protegida por senha
Após confirmar os dados e a submissão ser criada:
- Os dados aparecem como read-only no preview (como hoje)
- Botão "Editar Dados (Senha)" abre um prompt de senha
- Senha configurável (hardcoded inicial: ex. `bimaster2026` ou via env)
- Após autenticar, reabre o dialog de validação em modo edição
- Alterações são salvas via UPDATE no registro existente

### 3. Fluxo alterado em `ChinaNovaSubmissao.tsx`
- Após `processAiResponse` retornar dados, **não criar submissão imediatamente**
- Abrir o `ChinaDataValidationDialog` com os dados extraídos
- Só criar o registro no banco após o usuário confirmar no dialog
- Mover a lógica de `insert` para o callback `onConfirm` do dialog

### 4. Melhoria no prompt da Edge Function
Adicionar ao `SYSTEM_PROMPT` instrução para:
- Extrair `qty_total` como quantidade total de peças (não caixas)
- Garantir que cada cor tenha quantidade individual correta
- Adicionar campo `ctn_total` (total de caixas/cartons) separado

## Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| `src/components/china/ChinaDataValidationDialog.tsx` | **Novo** - Dialog de validação com tabela de cores editável |
| `src/pages/ChinaNovaSubmissao.tsx` | Abrir dialog após IA, mover insert para callback de confirmação |
| `src/components/china/ChinaExcelPreview.tsx` | Adicionar botão "Editar (Senha)" quando em modo read-only |
| `supabase/functions/parse-china-excel/index.ts` | Melhorar prompt para extrair qtd por cor corretamente |

