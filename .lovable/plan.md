

# Plano: Adicionar temas claros (incluindo Branco) ao seletor de cores

## Problema
Todos os 6 temas atuais têm sidebar escura. Os textos da sidebar usam cores hardcoded (`#8896ab`, `#c8d3e0`, `text-white`) que não funcionam em fundos claros.

## Solução

### 1. Expandir `ThemeDefinition` com propriedades de texto da sidebar
Adicionar ao interface: `sidebarText`, `sidebarTextActive`, `sidebarTextHover`, `sidebarTextMuted`, `sidebarBorder`, `sidebarMode: 'dark' | 'light'`.

### 2. Adicionar 3 novos temas claros

- **White Clean** — sidebar branca `#ffffff`, primary `#3872e0`, textos escuros
- **Light Gray** — sidebar `#f1f3f8`, primary `#475569`, textos escuros  
- **Warm Light** — sidebar `#faf8f5`, primary `#b76e79`, textos escuros

### 3. Atualizar `applyTheme()` para emitir variáveis de texto da sidebar
Novas CSS variables:
```
--sidebar-text-raw, --sidebar-text-active-raw, --sidebar-text-hover-raw,
--sidebar-text-muted-raw, --sidebar-border-raw
```

### 4. Refatorar `AppSidebar.tsx` — substituir cores hardcoded
Trocar todas as ~74 ocorrências de `#8896ab`, `#c8d3e0`, `#4a5a70`, `text-white`, `border-white/` por `var(--sidebar-text-raw)` etc.

### 5. Atualizar `ThemeSelectorPopover.tsx` com as mesmas variáveis

### 6. Atualizar `ThemeSelector.tsx` — grid agora com 9 temas (3×3)

### 7. Atualizar `ThemeKey` type union com os 3 novos keys

### Arquivos modificados
- `src/contexts/ThemeContext.tsx` — novo type, novos temas, `applyTheme` expandido
- `src/components/dashboard/AppSidebar.tsx` — substituir cores hardcoded por CSS vars
- `src/components/theme/ThemeSelectorPopover.tsx` — mesma substituição
- `src/components/theme/ThemeSelector.tsx` — grid 3×3

