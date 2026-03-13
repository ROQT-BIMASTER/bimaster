

# Exportar Excel, AlertDialogs, Botões Voltar e Filtro por Data — Todos os Módulos

## Escopo

Aplicar 4 melhorias padronizadas nos 6 módulos core (Composição, Amostras, Embalagem, Etiqueta/Bula, Motor de Artes, Aprovação de Artes):

1. **Botão Exportar Excel** nas listagens
2. **AlertDialog** para ações destrutivas (substituir `removeItem` diretos, etc.)
3. **Botão Voltar** em todas as telas (listagem e detalhe)
4. **Filtro por Data** (de/até) nas listagens

## 1. Exportar Excel

Usar `exportToExcel` de `@/utils/excelExport` (já existe). Adicionar botão `<Download>` no header de cada listagem, ao lado do botão "Novo".

| Módulo | Dados exportados |
|--------|-----------------|
| ChecklistComposicao | produto_nome, produto_codigo, status, created_at |
| RecebimentoAmostra | produto_nome, status, rodada, created_at |
| AnaliseEmbalagem | sku, produto_nome, status_aprovacao, sla, created_at |
| ChecklistEtiquetaBula | sku, produto_nome, etapa_atual, rodada, created_at |
| FluxoArtesMotor | sku, produto_nome, tipo_checklist, etapa_atual, status_geral, created_at |
| FluxoAprovacaoArtes | config.nome, status, etapa_atual, created_at |

## 2. AlertDialog para Ações Destrutivas

Substituir chamadas diretas de delete/remove sem confirmação por `AlertDialog`:

- **ChecklistComposicao**: `removeItem` (excluir ingrediente) — envolver com AlertDialog
- **AnaliseEmbalagem**: deletar cor de análise — envolver com AlertDialog
- **ChecklistEtiquetaBula**: nenhuma ação destrutiva direta encontrada, mas adicionar proteção caso haja
- **FluxoArtesDetalhe**: deletar cor — envolver com AlertDialog
- **FluxoAprovacaoDetalhe**: reprovar (já tem AlertDialog) — manter

Padrão: `AlertDialog` com título, descrição contextual, botão "Cancelar" e botão vermelho destrutivo.

## 3. Botão Voltar

Adicionar `<Button variant="ghost" size="icon" onClick={() => navigate(-1)}>` com `<ArrowLeft>` no header de **todas** as telas:

- **Listagens** (6 páginas): Voltar para o dashboard/módulo anterior
- **Detalhes** (FluxoArtesDetalhe, FluxoAprovacaoDetalhe): Já têm — verificar consistência
- **Editors internos** (ComposicaoEditor, AmostraDetail): Já usam `onBack` — manter

Onde já existe `onBack` ou `navigate(-1)`, garantir o ícone `ArrowLeft` padronizado.

## 4. Filtro por Data

Adicionar dois `DatePicker` (De / Até) ao lado do campo de busca em cada listagem. Filtrar pela coluna `created_at`.

Padrão visual: dois `Popover` com `Calendar` (mode="single"), estilo compacto, ao lado do Input de busca. Botão "Limpar" quando filtro ativo.

```text
[🔍 Buscar...] [📅 De: dd/mm/yyyy] [📅 Até: dd/mm/yyyy] [× Limpar]
```

A filtragem é client-side sobre os dados já carregados (os dados já vêm completos dos hooks existentes).

## Arquivos Modificados

| Arquivo | Alterações |
|---------|-----------|
| `ChecklistComposicao.tsx` | + Export Excel, + Voltar, + Date Filter, + AlertDialog no removeItem |
| `RecebimentoAmostra.tsx` | + Export Excel, + Voltar, + Date Filter |
| `AnaliseEmbalagem.tsx` | + Export Excel, + Voltar, + Date Filter, + AlertDialog no deleteCor |
| `ChecklistEtiquetaBula.tsx` | + Export Excel, + Voltar, + Date Filter |
| `FluxoArtesMotor.tsx` | + Export Excel, + Voltar, + Date Filter |
| `FluxoArtesDetalhe.tsx` | + AlertDialog no deleteCor (se não existir) |
| `FluxoAprovacaoArtes.tsx` | + Export Excel, + Voltar, + Date Filter, + DashboardLayout/Breadcrumb |
| `FluxoAprovacaoDetalhe.tsx` | Verificar AlertDialogs existentes |

