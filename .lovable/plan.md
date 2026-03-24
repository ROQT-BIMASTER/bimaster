

# Mobile: Submenu em Drawer em vez de Popover

## Problema

O `PopoverContent side="right"` funciona bem em desktop mas em mobile:
- O popover fica cortado ou sobrepõe a sidebar
- Toque em área pequena é difícil
- Não há espaço lateral suficiente para o flyout

## Solução

Usar abordagem condicional: **Popover no desktop, Drawer (bottom sheet) no mobile**.

### Implementação

**Arquivo: `src/components/dashboard/AppSidebar.tsx`**

1. Importar `useIsMobile` de `@/hooks/use-mobile`
2. Importar `Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle` de `@/components/ui/drawer`
3. Criar componente wrapper `ModuleSubmenu` que renderiza:
   - **Desktop** (`!isMobile`): `Popover` + `PopoverContent side="right"` (comportamento atual)
   - **Mobile** (`isMobile`): `Drawer` + `DrawerContent` com lista de sub-itens em bottom sheet full-width

```text
DESKTOP:  [Módulo] → popover lateral flutuante
MOBILE:   [Módulo] → drawer sobe de baixo com sub-itens
```

4. Aplicar em todos os ~10 pontos onde `PopoverContent side="right"` é usado (módulos dinâmicos, departamentos, Central de Inteligência)

### O que NÃO muda
- Lógica de permissões, rotas, filtro de módulos
- Visual dos sub-itens (mesmos ícones, textos, badges)
- Comportamento desktop permanece idêntico

