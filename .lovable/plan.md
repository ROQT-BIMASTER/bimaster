

# Filtro de Modulos na Sidebar

## O que sera feito

Adicionar um seletor de modulo no topo da sidebar (abaixo do logo), permitindo que o usuario escolha rapidamente qual modulo visualizar. Apenas os modulos com permissao serao exibidos no filtro.

## Como funciona

- Um dropdown/select compacto aparece logo abaixo do logo
- Opcao "Todos" (padrao) mostra todos os modulos como hoje
- Ao selecionar um modulo especifico, apenas aquele modulo aparece na sidebar
- O filtro respeita 100% as permissoes existentes (`hasModulePermission`) - apenas modulos permitidos aparecem como opcoes
- Itens gerais (Auditoria, Instalar App) permanecem sempre visiveis

## Fluxo visual

```text
+---------------------------+
|       [Logo Union]        |
+---------------------------+
| [v] Selecionar Modulo     |  <-- Novo filtro
|   - Todos                 |
|   - Prospects             |
|   - Financeiro            |
|   - Trade Marketing       |
|   - (apenas permitidos)   |
+---------------------------+
|  Auditoria                |
|  Instalar App             |
+---------------------------+
|  [Modulos filtrados]      |
+---------------------------+
```

## Revisao de Seguranca

| Aspecto | Status |
|---|---|
| Permissoes de modulo (`hasModulePermission`) | Mantidas - filtro so exibe modulos permitidos |
| Permissoes de tela (`hasPermission`) | Mantidas - sub-itens continuam filtrados |
| Rotas protegidas (ModuleProtectedRoute/ScreenProtectedRoute) | Nao alteradas - protecao server-side intacta |
| Impersonacao | Respeitada - hooks usam contexto de impersonacao |
| RLS no banco | Nao impactado - e apenas filtro visual |

O filtro e puramente visual/UX. Nenhuma logica de seguranca e alterada. As verificacoes `hasModulePermission` e `hasPermission` continuam sendo aplicadas em cada item renderizado.

## Detalhes Tecnicos

### Arquivo modificado
- `src/components/dashboard/AppSidebar.tsx`

### Implementacao
1. Adicionar estado `selectedModule` (string | "all") com valor padrao "all"
2. Construir lista de modulos disponiveis dinamicamente a partir de `hasModulePermission`
3. Renderizar um `Select` (Shadcn) entre o logo e o conteudo da sidebar
4. Envolver cada bloco de modulo com condicional `selectedModule === "all" || selectedModule === "nomeDoModulo"`
5. Quando um modulo e selecionado, auto-expandir seu collapsible

### Modulos no filtro
- Prospects (prospects)
- Financeiro (financeiro)
- Marketing (marketing)
- Trade Marketing (trade)
- Fabrica (fabrica)
- Comercial (comercial)
- Eventos (eventos)
- Departamentos (departamentos)
- Tabelas de Precos (precos)

Cada opcao so aparece se `hasModulePermission("codigo")` retorna `true`.

