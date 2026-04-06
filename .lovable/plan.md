

# Navegação "Voltar" Inteligente no Módulo de Projetos

## Problema

Ao navegar entre os ambientes do módulo de Projetos (Home → Minhas Tarefas → Detalhe do Projeto → Inbox, etc.), o botão "voltar" sempre leva a um destino fixo (`/dashboard/projetos`), ignorando de onde o usuário realmente veio. Isso quebra o fluxo natural de navegação.

## Solução

Usar `useNavigate(-1)` (histórico do browser) como padrão, com fallback para uma rota fixa caso não haja histórico. Criar um componente reutilizável `ProjetoBackButton` que encapsula essa lógica para todo o módulo.

## Implementação

### 1. Componente `ProjetoBackButton`

Criar `src/components/projetos/ProjetoBackButton.tsx`:
- Usa `useNavigate()` com `navigate(-1)` para voltar ao ambiente anterior
- Detecta se há histórico via `window.history.length > 1`
- Fallback para rota configurável (default: `/dashboard/projetos`)
- Props: `fallbackTo`, `label`, `darkBg`, `customBg` (para adaptar cores no header do projeto)

### 2. Aplicar em todas as páginas do módulo

| Página | Situação atual | Mudança |
|---|---|---|
| `ProjetoDetalhe.tsx` | Botão fixo → `/dashboard/projetos` | Trocar por `ProjetoBackButton` com fallback `/dashboard/projetos` |
| `ProjetoHome.tsx` | Sem botão de voltar | Não precisa (é a "raiz" pessoal) |
| `MinhasTarefas.tsx` | Sem botão de voltar | Não precisa (é ambiente principal) |
| `ProjetoInbox.tsx` | Sem botão de voltar | Não precisa (é ambiente principal) |
| `ProjetosMinhaEquipe.tsx` | Verificar | Adicionar `ProjetoBackButton` se necessário |

O foco principal é o **ProjetoDetalhe**, que é acessado de vários contextos (lista de projetos, home, minhas tarefas, inbox) e precisa voltar para onde o usuário estava.

### 3. Lógica do componente

```text
onClick:
  1. Se window.history.state tem entrada anterior do mesmo domínio → navigate(-1)
  2. Senão → navigate(fallbackTo)
```

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/projetos/ProjetoBackButton.tsx` | Novo componente reutilizável |
| `src/pages/ProjetoDetalhe.tsx` | Substituir botão fixo pelo `ProjetoBackButton` |
| `src/pages/ProjetosMinhaEquipe.tsx` | Adicionar `ProjetoBackButton` se não tiver |

