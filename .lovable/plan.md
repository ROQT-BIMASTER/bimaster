

# Melhorias na Visualização de Documentos e Pendências no Fluxo de Composição

## Problema

1. No Step 2 (Analisar & Aceitar), o fluxo de aprovação mostra apenas as etapas cadastradas, mas não exibe claramente TODAS as etapas com status visual (concluída/atual/pendente)
2. Planilhas (xlsx, xls, csv) não têm opção de download/visualização no preview
3. Após extração, na tela principal (ComposicaoEditor), o usuário não consegue ver rapidamente quais documentos já foram processados e quais ainda estão pendentes

## Solução

### 1. Etapas do fluxo com status visual completo (ExtrairIngredientesIADialog.tsx)

No card "Fluxo de Aprovação Vinculado" (Step 2), melhorar a visualização das etapas:
- Etapas anteriores à `etapa_atual`: ícone CheckCircle2 verde + texto "Concluída"
- Etapa atual: highlight primário + badge "Etapa atual" (já existe, manter)
- Etapas futuras: ícone Circle cinza + texto "Pendente"
- Adicionar barra de progresso visual acima das etapas

### 2. Download e visualização para planilhas e outros formatos (ExtrairIngredientesIADialog.tsx)

No preview (Step 2), quando o arquivo for planilha (.xlsx, .xls, .csv) ou outro formato sem preview inline:
- Mostrar botão "Download" e "Abrir em nova aba" (como já existe no ChinaDocPreviewDialog)
- Manter a mensagem de que a IA processará o conteúdo interno
- Aplicar mesma lógica para .doc, .docx, .xml etc.

### 3. Painel de Documentos do Processo na tela principal (ChecklistComposicao.tsx)

Adicionar uma nova aba **"Documentos"** no `ComposicaoEditor` (entre "Composição" e "Tarefas Vinculadas") que mostra:
- Lista de TODOS os documentos vinculados ao módulo (via `china_documento_tarefa_vinculos`)
- Para cada documento: nome, tipo, status, checklist de origem
- Badge visual indicando se já foi "Analisado pela IA" ou "Pendente de análise"
- Botão rápido para abrir o diálogo de extração com IA pré-selecionando o documento
- KPIs no topo: Total de documentos, Analisados, Pendentes

Para determinar se um documento já foi analisado, verificar se existe registro em `audit_logs` com `action = "extracao_ia_processo"` e `metadata->documento_id` correspondente.

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/components/composicao/ExtrairIngredientesIADialog.tsx` | Status visual nas etapas do fluxo; botões download/abrir para planilhas |
| `src/pages/ChecklistComposicao.tsx` | Nova aba "Documentos" no editor com painel de documentos e pendências |

## Detalhes Técnicos

**Etapas com status visual:**
```text
etapa.ordem < etapa_atual → ✅ Concluída (verde)
etapa.ordem === etapa_atual → 🔵 Em andamento (highlight)
etapa.ordem > etapa_atual → ⚪ Pendente (cinza)
```

**Detecção de análise prévia:**
```sql
SELECT DISTINCT metadata->>'documento_id' 
FROM audit_logs 
WHERE action = 'extracao_ia_processo' 
  AND metadata->>'submissao_id' = $submissaoId
```

**Download para planilhas (Step 2):**
- Detectar extensão: `.xlsx`, `.xls`, `.csv`, `.doc`, `.docx`
- Renderizar botões Download + Abrir junto ao ícone do arquivo
- Usar `previewUrl` para href dos botões

