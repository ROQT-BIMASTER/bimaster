

# Fix: Submenu Abrindo Automaticamente e Piscando

## Causa Raiz

O `useEffect` nas linhas 412-424 do `AppSidebar.tsx` executa em toda mudança de rota e **adiciona automaticamente** o modulo correspondente ao `openModules`. Como agora os submenus sao Popovers/Drawers (nao mais accordions), isso faz o submenu abrir sozinho ao carregar a pagina, causando o efeito de "piscar".

```typescript
// PROBLEMA — roda em toda navegacao e abre o popover automaticamente
useEffect(() => {
  const path = location.pathname;
  for (const [moduleCode, routes] of Object.entries(moduleRouteMap)) {
    if (routes.some(r => path.startsWith(r))) {
      setOpenModules(prev => { ... next.add(moduleCode); return next; });
      break;
    }
  }
}, [location.pathname, ...]);
```

Esse padrao fazia sentido quando os submenus eram Collapsibles/accordions. Com Popovers, abrir automaticamente e indesejado.

## Solucao

**Arquivo unico: `src/components/dashboard/AppSidebar.tsx`**

### 1. Remover auto-expand de modulos por rota (linhas 412-424)

Eliminar o bloco que adiciona modulos ao `openModules` baseado em `location.pathname`. Submenus so devem abrir por clique do usuario.

### 2. Manter auto-expand por busca (linhas 519-533)

O comportamento de abrir submenus ao digitar na busca permanece, conforme preferencia confirmada.

### 3. Manter auto-expand de finSubgroups (linhas 426-442)

Os Collapsibles internos do Financeiro (verbas, campanhas, etc.) continuam expandindo por rota, pois sao accordions dentro do popover, nao popovers em si.

## O que NAO muda

- Logica de `setModuleOpen` (explicit boolean)
- Botao X de fechar
- Popover desktop / Drawer mobile
- Busca com auto-abertura
- Permissoes e filtros

