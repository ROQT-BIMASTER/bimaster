

## Reestruturação do Menu Lateral com Submenus Agrupados

### Problema
O sidebar atual tem ~18 módulos como seções independentes no nível superior, tornando-o excessivamente longo e difícil de navegar.

### Solução
Agrupar os módulos em **5 categorias** de alto nível. Cada categoria expande para mostrar seus módulos, e cada módulo expande para mostrar suas telas. Hierarquia de 3 níveis:

```text
┌─────────────────────────┐
│ 🏠 Geral                │  (Auditoria, Instalar App)
├─────────────────────────┤
│ ▶ Comercial & Vendas    │  ← Categoria (clique expande)
│   ▶ Prospects           │  ← Módulo (clique expande)
│     • Dashboard         │  ← Tela (link)
│     • Lista             │
│     • Kanban            │
│   ▶ Comercial           │
│   ▶ Preços              │
├─────────────────────────┤
│ ▶ Trade & Marketing     │
│   ▶ Trade Marketing     │
│   ▶ Marketing           │
│   ▶ Eventos             │
├─────────────────────────┤
│ ▶ Produção & Qualidade  │
│   ▶ Fábrica             │
│   ▶ Fábrica China       │
│   ▶ Composição          │
│   ▶ Amostras            │
│   ▶ Embalagem           │
│   ▶ Etiqueta/Bula       │
│   ▶ Aprovação de Artes  │
├─────────────────────────┤
│ ▶ Financeiro & Admin    │
│   ▶ Financeiro          │
│   ▶ Departamentos       │
│   ▶ Estoque             │
├─────────────────────────┤
│ ▶ Gestão & Projetos     │
│   ▶ Projetos            │
│   ▶ Reuniões            │
├─────────────────────────┤
│ ⚙ Configurações        │
│ 🚪 Sair                │
└─────────────────────────┘
```

### Comportamento
- Apenas **uma categoria** aberta por vez (accordion) para manter o menu compacto
- Dentro da categoria, múltiplos módulos podem estar abertos
- Categorias só aparecem se o usuário tem permissão em pelo menos 1 módulo daquela categoria
- O filtro de módulos existente continua funcionando
- A categoria que contém a rota ativa abre automaticamente

### Detalhes Técnicos

| Arquivo | Ação |
|---|---|
| `src/components/dashboard/AppSidebar.tsx` | Refatorar para usar estrutura de categorias com Collapsible aninhado. Extrair dados dos módulos em um array de configuração `moduleCategories[]`. Reduzir de ~1400 linhas para ~600 usando renderização dinâmica |

**Abordagem**:
1. Criar uma estrutura de dados `moduleCategories` que agrupa os módulos existentes
2. Criar componente `CategoryGroup` que renderiza a categoria com seus módulos internos
3. Cada módulo dentro usa o mesmo `Collapsible` + `MenuItemLink` existente
4. Auto-expandir a categoria/módulo da rota ativa via `useLocation`
5. Manter o `ModuleHeader` e `MenuItemLink` existentes sem alteração visual
6. O header da categoria é mais discreto (sem ícone colorido grande), diferenciando visualmente da hierarquia do módulo

