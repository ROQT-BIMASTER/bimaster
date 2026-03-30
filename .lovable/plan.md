

# Devolução Final do Brasil — Upload de Documentos e Seleção para Decisão

## Contexto

O `ProcessDecisionDialog` atualmente permite apenas selecionar tipo de decisão, escrever justificativa e (em caso de ajuste) marcar documentos existentes. Falta:
1. **Upload de arquivos** como evidência/parecer anexo à decisão
2. **Seleção de documentos** visível para TODOS os tipos de decisão (não apenas "needs_revision")

O hook `useProcessDecisions` já suporta o campo `attachments: Array<{ url: string; nome: string }>`, mas o dialog nunca envia anexos.

## Plano

### 1. Adicionar upload de arquivos ao dialog

- Adicionar zona de upload (input file múltiplo) abaixo da justificativa
- Ao selecionar arquivos, fazer upload para Supabase Storage bucket `process-attachments`
- Exibir lista de arquivos selecionados com nome, tamanho e botão remover
- Passar os URLs resultantes no campo `attachments` ao criar a decisão

### 2. Seleção de documentos para TODAS as decisões

- Mover o checklist de documentos para fora do bloco condicional `needs_revision`
- Mostrar para todos os tipos (aprovação parcial, rejeição com itens específicos, ajuste)
- Label contextual: "Documentos relacionados" (genérico) em vez de "Itens que precisam de correção"
- Manter o campo `motivo` por item apenas quando `needs_revision`

### 3. Criar bucket Storage (se não existir)

- Migration para criar bucket `process-attachments` com políticas de acesso autenticado

### 4. UX aprimorada

- Seção de anexos com ícone Paperclip e drag indicator
- Preview de nome do arquivo com badge de tamanho
- Loading state durante upload antes de permitir submissão
- DialogDescription para resolver o warning de acessibilidade nos logs

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/components/processo/ProcessDecisionDialog.tsx` | Upload de arquivos, seleção de docs para todos os tipos, DialogDescription |
| `src/hooks/useProcessDecisions.ts` | Sem mudança (já suporta attachments) |
| Migration SQL | Criar bucket `process-attachments` com RLS |

