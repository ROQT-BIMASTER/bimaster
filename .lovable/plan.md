

# Melhorias na Tela Vincular Envio China

## Problemas Identificados

1. **Pendencias fake** — valores calculados com percentuais fixos (`TOTAL_CHECKLIST = 20`, multiplicadores hardcoded) em vez de dados reais do checklist
2. **Pagina monolitica** — 735 linhas com logica de vinculacao, processo, despachos, documentos tudo junto
3. **Paineis abaixo da tabela** — ao selecionar um item, cards de vinculacao, documentos, processo e despachos aparecem em scroll infinito abaixo da grid, obrigando o usuario a rolar
4. **Drawer subutilizado** — mostra apenas detalhes e documentos, mas as acoes ficam fora dele
5. **Sem paginacao** — tabela carrega todos os registros sem limite
6. **Acoes em massa incompletas** — botao "Despachar selecionados" nao tem handler conectado

## Solucao

### 1. Pendencias reais (Migration + Hook)
- Criar RPC `get_pendencias_por_submissao(p_submissao_ids uuid[])` que conta itens do `produto_brasil_checklist` onde `concluido = false` agrupados por `submissao_china_id`
- Substituir o calculo hardcoded no `tableData` por dados reais

### 2. Layout split-panel (refactor principal)
Reorganizar a pagina em layout de duas colunas quando um item esta selecionado:

```text
┌──────────────────────────────────────────────────────────┐
│ Header + KPIs                                            │
├──────────────────────────┬───────────────────────────────┤
│                          │                               │
│   Tabela (grid)          │   Painel lateral fixo         │
│   com paginacao          │   (Detalhes + Vincular +      │
│                          │    Docs + Processo + Chat)    │
│                          │    em abas                    │
│                          │                               │
├──────────────────────────┴───────────────────────────────┤
│ Vinculos existentes (collapsible)                        │
└──────────────────────────────────────────────────────────┘
```

- Quando nenhum item selecionado: tabela ocupa 100% da largura
- Quando item selecionado: tabela 60%, painel lateral 40% com abas (Detalhes, Vincular, Documentos, Processo, Chat)
- Elimina scroll vertical para encontrar paineis

### 3. Paginacao na tabela
- Adicionar paginacao com 50 registros por pagina no `VincularChinaTable`

### 4. Drawer → Painel lateral integrado
- Remover o Sheet/Drawer separado
- Mover o conteudo para o painel lateral com abas
- Aba "Detalhes": info do produto + documentos por categoria (atual drawer)
- Aba "Vincular": selecao de projeto + tarefas (atual card abaixo da tabela)
- Aba "Processo": orquestracao + despachos + decisao formal
- Aba "Chat": chat do processo (quando existir)

### 5. Acoes em massa funcionais
- Conectar "Despachar selecionados" a um dialog de confirmacao que cria despachos batch

### 6. Extrair componentes
- `VincularChinaSidePanel.tsx` — painel lateral com abas
- `VincularChinaVincularTab.tsx` — aba de vinculacao a tarefas
- `VincularChinaBulkActions.tsx` — dialog de acoes em massa

## Detalhes Tecnicos

### Migration SQL
```sql
CREATE OR REPLACE FUNCTION get_pendencias_por_submissao(p_ids uuid[])
RETURNS TABLE(submissao_id uuid, total int, pendentes int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT pb.submissao_china_id, 
         count(*)::int, 
         count(*) FILTER (WHERE NOT c.concluido)::int
  FROM produto_brasil_checklist c
  JOIN produtos_brasil pb ON pb.id = c.produto_brasil_id
  WHERE pb.submissao_china_id = ANY(p_ids)
  GROUP BY pb.submissao_china_id;
$$;
```

### Hook useSubmissaoPendencias
- Chama a RPC com os IDs das submissoes visiveis
- Retorna Map<submissao_id, { total, pendentes }>

### ProjetoVincularChina.tsx (~300 linhas apos refactor)
- Layout com `flex` e painel condicional
- Logica de vinculacao movida para componente dedicado
- Pagina fica como orquestradora de estado

## Arquivos

| Arquivo | Acao |
|---------|------|
| Migration SQL | CREATE FUNCTION `get_pendencias_por_submissao` |
| `src/hooks/useSubmissaoPendencias.ts` | Novo hook para pendencias reais |
| `src/components/china/VincularChinaSidePanel.tsx` | Novo painel lateral com abas |
| `src/components/china/VincularChinaVincularTab.tsx` | Aba de vinculacao extraida |
| `src/components/china/VincularChinaTable.tsx` | Adicionar paginacao |
| `src/pages/ProjetoVincularChina.tsx` | Refatorar para layout split-panel |
| `src/components/china/VincularChinaDrawer.tsx` | Remover (conteudo migrado para SidePanel) |

