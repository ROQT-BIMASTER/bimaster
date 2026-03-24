

# Redesign do Menu Lateral — Estilo Portal de Integração

## Problema

O menu lateral atual usa headers de módulo com caixas coloridas (7x7px), múltiplos níveis de nesting com indentação pesada, e accordion de categorias que gera confusão. Os usuários reclamam da complexidade visual.

## Referência: Sidebar do Portal de Integração

O padrão do portal (imagem-823) é limpo e minimalista:
- Lista flat com ícone + texto + badge de contagem
- Separadores simples entre seções
- Sem caixas coloridas nos headers
- Item ativo com highlight sutil (`bg-primary/10`)
- Tipografia uniforme, sem uppercase tracking pesado

## Plano de Redesign

**Arquivo: `src/components/dashboard/AppSidebar.tsx`** (refactor visual, sem alterar lógica)

### 1. Novo `ModuleHeader` — Estilo Portal

Substituir o header com caixa colorida por um estilo flat:

```text
ANTES:  [██] Prospects    ▾    (caixa 7x7 colorida, font-medium)
DEPOIS:  👤 Prospects  (14)  ▾  (ícone direto, badge count, flat)
```

- Ícone direto sem background box (h-5 w-5, cor `text-muted-foreground`)
- Badge com contagem de sub-itens visíveis (estilo `bg-muted rounded-full text-[10px]`)
- Hover com `bg-muted/50`, sem cores de módulo no header
- Chevron sutil à direita

### 2. Novo `CategoryHeader` — Mais leve

Substituir o uppercase bold tracking por um estilo com separador:

```text
ANTES:  ⓘ COMERCIAL & VENDAS  ▸  (bold 10px uppercase tracking-[0.09em])
DEPOIS:  ── Comercial & Vendas ──  (separator style, text-xs text-muted-foreground)
```

- Linha separadora com texto central (estilo divider label)
- Sem ícone no header da categoria
- Sem chevron — categorias sempre abertas (remover accordion de categorias)

### 3. `MenuItemLink` — Refinamento

Manter o estilo atual mas ajustar:
- Remover `border-l-2` do item ativo → usar `bg-primary/10 text-primary font-medium` (estilo portal)
- Padding uniforme `px-3 py-2` em vez de `py-1.5`
- Ícone `h-4 w-4` (era `h-3.5 w-3.5`)

### 4. Remover accordion de categorias

As categorias do DB (`sidebar_categories`) continuam agrupando módulos, mas sem collapsible — todos os grupos ficam visíveis. Apenas os **módulos** dentro de cada grupo mantêm collapsible.

Isso resolve a reclamação principal: "clico na categoria, abre, clico no módulo, abre de novo" — agora é um clique só.

### 5. Module Filter — Manter

O dropdown "Todos os Módulos" permanece no topo pois é funcional e já segue design limpo.

### 6. Footer — Simplificar

Remover collapsible do footer. Mostrar:
- Avatar + nome (sempre visível)
- Ícones inline: tema, settings, logout
- Links de privacidade/termos abaixo

## O que NÃO muda

- Toda a lógica de permissões (`hasPermission`, `showModule`, `hasModulePermission`)
- Dados de categorias do banco (`useSidebarConfig`)
- Sub-menus e rotas (prospects, financeiro, etc.)
- Auto-expand por rota ativa
- Module filter dropdown
- Financeiro subgroups (verbas, campanhas, contas, análises)
- Fábrica groups (entrada, produção, qualidade, etc.)
- Central de Inteligência (protegida por módulo)

## Arquivo Afetado

| Arquivo | Ação |
|---|---|
| `src/components/dashboard/AppSidebar.tsx` | Refactor visual dos componentes ModuleHeader, CategoryHeader, MenuItemLink. Remover accordion de categorias. Simplificar footer. |

