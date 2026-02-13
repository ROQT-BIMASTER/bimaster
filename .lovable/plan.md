

# Corrigir Sistema de Tradução Multi-idiomas

## Problema Identificado

O sistema de tradução (`LanguageContext`) foi criado com apenas ~12 chaves genéricas (titulo do sistema, navegacao, mensagens offline). Nenhum componente da aplicacao realmente usa a funcao `t()` para traduzir textos. Todos os textos estao hardcoded em portugues nos componentes.

## Abordagem

Como o sistema possui **100+ paginas e centenas de componentes**, traduzir tudo de uma vez seria inviavel. A estrategia sera:

1. **Expandir massivamente o dicionario de traducoes** no `LanguageContext.tsx` com todas as chaves necessarias para as areas principais
2. **Integrar `t()` nos componentes mais visiveis** que o usuario interage diariamente

## Componentes Prioritarios para Traduzir

### Fase 1 - Layout e Navegacao (visivel em todas as paginas)
- `DashboardLayout.tsx` - titulo do header, mensagens offline
- `AppSidebar.tsx` - todos os menus e submenus (Prospects, Financeiro, Trade, Marketing, Fabrica, etc.)

### Fase 2 - Paginas Principais
- `ProspectsOptimized.tsx` - titulo, filtros, labels, mensagens
- `Dashboard.tsx` - cards de estatisticas, titulos de secoes
- `ProspectsDashboardWidget.tsx` - cards de KPI

### Fase 3 - Componentes Compartilhados
- Status labels (Novo, Em Contato, Proposta, Negociacao, Ganho, Perdido)
- Botoes comuns (Novo Prospect, Atualizar, Buscar, Salvar, Cancelar)
- Mensagens de estado (Carregando, Nenhum resultado, etc.)

## Detalhes Tecnicos

### 1. Expandir `LanguageContext.tsx`
Adicionar ~150+ chaves de traducao cobrindo:
- Sidebar: nomes de modulos e submenus
- Prospects: titulos, filtros, status, labels
- Dashboard: KPIs, graficos
- Acoes comuns: botoes, mensagens de feedback
- Financeiro, Trade, Marketing: titulos principais

Todas as 4 linguas: pt-BR, en, es, ar

### 2. Integrar `useLanguage()` nos componentes
- Importar `useLanguage` em cada componente
- Substituir strings hardcoded por `t("chave")`
- Manter `pt-BR` como fallback (ja funciona assim)

### 3. Componentes a modificar
- `src/components/dashboard/DashboardLayout.tsx` - header title, mensagens offline
- `src/components/dashboard/AppSidebar.tsx` - todos os menus (~50 itens)
- `src/pages/ProspectsOptimized.tsx` - titulo, filtros, botoes, status
- `src/pages/Dashboard.tsx` - titulos e labels
- `src/components/dashboard/ProspectsDashboardWidget.tsx` - cards

### 4. Sidebar - Estrategia
Os menus da sidebar sao arrays de objetos com `title: "string"`. Serao convertidos para usar chaves de traducao: `title: t("sidebar.prospects.dashboard")`.

## Resultado Esperado
Ao trocar o idioma no seletor, todos os menus, titulos de paginas, labels de filtros, status e botoes principais mudarao para o idioma selecionado. O conteudo dinamico (nomes de empresas, dados do banco) permanecera no idioma original.

