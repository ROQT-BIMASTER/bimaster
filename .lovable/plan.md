## Objetivo

Concluir a integração das peças já criadas (páginas FAQ/admin, componentes de histórico e debug) ao restante do app, sem alterar regras de negócio.

## 1. Rotas em `src/App.tsx`

Adicionar dois imports lazy junto aos demais (perto da linha 280) e duas `<Route>` dentro do bloco "Módulo de Projetos" (após linha 705):

```tsx
const VisibilidadeTarefas = lazyWithRetry(() => import("./pages/admin/VisibilidadeTarefas"));
const VisibilidadeProjetosAjuda = lazyWithRetry(() => import("./pages/ajuda/VisibilidadeProjetos"));
```

Rotas:

- `/dashboard/projetos/admin/visibilidade` — protegida por `ScreenRoute screenCode="admin"` (mesmo padrão de `/dashboard/admin/projetos-saude`).
- `/dashboard/ajuda/projetos-visibilidade` — apenas `ProtectedRoute` (página de ajuda interna, sem necessidade de módulo).

## 2. Link de ajuda no `CentralHeader.tsx`

Acrescentar um botão discreto (variant `ghost`, ícone `HelpCircle`, texto pequeno) no cluster de ações do header, ao lado de "Restaurar padrão". Comportamento: `<Link to="/dashboard/ajuda/projetos-visibilidade" target="_blank">` com tooltip "Como funciona a visibilidade da Central e dos projetos?". Sem alterar nenhuma outra lógica do header.

## 3. Link de ajuda no `ProjetoVisaoParcialBanner.tsx`

Dentro do tooltip atual (que explica visão parcial), adicionar uma linha extra com link "Saiba mais sobre visibilidade" apontando para `/dashboard/ajuda/projetos-visibilidade` (`target="_blank"`). Manter o ícone `Info` como gatilho do tooltip; nenhuma mudança nas props nem na lógica de exibição do banner.

## 4. Integração no `ProjetoTarefaDetalhe.tsx`

Imports a adicionar:

```tsx
import { TarefaAcessoHistorico } from "./TarefaAcessoHistorico";
import { VisibilidadeDebugDialog } from "./VisibilidadeDebugDialog";
import { useUserRole } from "@/hooks/useUserRole"; // ou hook equivalente já em uso no projeto
```

Posicionamento dentro do `ScrollArea` da `SheetContent`:

- Logo após `<ProjetoTarefaTimeline tarefaId={tarefa.id} />` (linha 819), inserir um bloco condicional visível apenas para admin/coordenador:
  ```tsx
  <Separator />
  <div className="flex items-center justify-between">
    <h4 className="text-sm font-medium">Auditoria de acesso</h4>
    {isAdmin && (
      <VisibilidadeDebugDialog tarefaId={tarefa.id} />
    )}
  </div>
  <TarefaAcessoHistorico tarefaId={tarefa.id} />
  ```
- O `VisibilidadeDebugDialog` é renderizado como botão "Por que vejo isto?" e abre o dialog com a explicação retornada pelo RPC `debug_visibilidade_tarefa`.

Observações:

- Detectar admin com o mesmo padrão já existente no projeto (verificar `useUserRole` ou equivalente). Se o componente `VisibilidadeDebugDialog` já faz a checagem internamente e retorna `null` para não-admin, basta sempre renderizá-lo e omitir o `if`.
- `TarefaAcessoHistorico` é exibido para todos os usuários com acesso à tarefa; o RLS da tabela `projeto_tarefa_acesso_audit` é o gate final.

## 5. Não escopo

- Nenhuma mudança nas RPCs, RLS, hooks de dados ou na lógica de filtragem das abas.
- Nenhuma mudança visual nos demais componentes da Central ou do detalhe da tarefa.

## Verificação

- Carregar `/dashboard/projetos/central` → clicar no novo link de ajuda abre a FAQ em nova aba.
- Abrir uma tarefa → visualizar a seção "Auditoria de acesso" com o histórico; admin vê o botão de depuração.
- Acessar `/dashboard/projetos/admin/visibilidade` como admin → página carrega; como não-admin → redireciona.
