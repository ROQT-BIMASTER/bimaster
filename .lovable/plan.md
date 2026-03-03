

## Persistir filtro de módulos no menu lateral

### Problema
O filtro "Todos os Módulos" no sidebar usa `useState` local, então ao navegar para qualquer tela o componente re-renderiza e o filtro volta ao estado inicial (sem filtro).

### Solução
Persistir o `selectedModules` no `sessionStorage` para que sobreviva à navegação entre telas durante a sessão.

### Alteração

**`src/components/dashboard/AppSidebar.tsx`**:

1. Inicializar `selectedModules` lendo do `sessionStorage`:
```typescript
const [selectedModules, setSelectedModules] = useState<Set<string>>(() => {
  try {
    const saved = sessionStorage.getItem("sidebar-module-filter");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { return new Set(); }
});
```

2. Adicionar `useEffect` para salvar no `sessionStorage` quando mudar:
```typescript
useEffect(() => {
  sessionStorage.setItem(
    "sidebar-module-filter",
    JSON.stringify(Array.from(selectedModules))
  );
}, [selectedModules]);
```

Isso mantém o filtro ativo enquanto o usuário navega entre telas, sem necessidade de contexto global ou mudanças em outros arquivos. O filtro reseta apenas quando a aba do navegador é fechada.

