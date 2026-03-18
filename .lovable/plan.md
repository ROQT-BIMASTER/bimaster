

# Plano: Seta expansível no nome do usuário (footer da sidebar)

## O que muda

Transformar a área do nome do usuário no footer da sidebar em um **Collapsible trigger** com uma seta (ChevronUp/ChevronDown). Ao clicar no nome ou na seta, os links do footer (Configurações, LGPD, Config. Menu, etc.) expandem/recolhem. Os links ficam ocultos por padrão.

## Implementação

### Arquivo: `src/components/dashboard/AppSidebar.tsx` (footer, linhas ~990-1096)

1. Envolver o footer com um `Collapsible` controlado por estado local (`footerOpen`)
2. O bloco do avatar/nome do usuário (linhas 993-1006) vira o `CollapsibleTrigger`, adicionando um ícone `ChevronUp` que rotaciona conforme o estado
3. O `SidebarMenu` com os links (linhas 1009-1095) fica dentro de `CollapsibleContent`
4. Manter o bloco de Privacidade/Termos sempre visível fora do collapsible
5. O `ThemeSelectorPopover` permanece ao lado da seta

### Estrutura resultante:
```text
┌─────────────────────────┐
│ [Avatar] Nome      🎨 ▲ │  ← clicável, expande/recolhe
│         Conectado       │
├─────────────────────────┤
│  Configurações          │  ← aparece ao expandir
│  LGPD                   │
│  Config. Menu           │
│  Rel. Segurança         │
│  Rel. Desenvolvimento   │
│  Sair                   │
├─────────────────────────┤
│  Privacidade | Termos   │  ← sempre visível
└─────────────────────────┘
```

Zero alterações funcionais ou de permissão.

