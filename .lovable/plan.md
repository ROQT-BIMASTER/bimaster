

# Cor de Fundo Personalizada em Todos os Ambientes de Projetos

## Objetivo

Adicionar o mesmo `ProjetoBgColorPicker` (já usado em ProjetoDetalhe) a todas as páginas do módulo de Projetos, permitindo que cada ambiente tenha sua cor de fundo independente.

## Abordagem

Usar **localStorage** para persistir a cor por página (chave: `projeto_page_bg_{pageName}`), já que são preferências pessoais do usuário, não ligadas a um projeto específico. Criar um hook reutilizável para encapsular a lógica.

## Implementação

### 1. Hook `usePageBgColor`

Criar `src/hooks/usePageBgColor.ts`:
- Recebe `pageKey: string` (ex: "home", "minhas_tarefas", "inbox", "lista", "equipe")
- Retorna `{ bgColor, setBgColor, darkBg, customBg }` 
- Persiste em `localStorage` com chave `projeto_page_bg_{pageKey}`
- Reutiliza a função `isDarkHex` do `ProjetoBgColorPicker`

### 2. Adicionar picker + aplicar cor em cada página

| Página | Arquivo | pageKey |
|---|---|---|
| Home | `ProjetoHome.tsx` | `"projeto_home"` |
| Minhas Tarefas | `MinhasTarefas.tsx` | `"minhas_tarefas"` |
| Caixa de Entrada | `ProjetoInbox.tsx` | `"projeto_inbox"` |
| Lista de Projetos | `Projetos.tsx` | `"projetos_lista"` |
| Minha Equipe | `ProjetosMinhaEquipe.tsx` | `"projetos_equipe"` |

Em cada página:
- Importar `usePageBgColor` e `ProjetoBgColorPicker`
- Aplicar `style={{ backgroundColor }}` no `<main>`
- Colocar o picker ao lado do `SidebarTrigger` no header
- Adaptar classes de texto quando fundo escuro (`darkBg`)

### 3. Extrair `isDarkHex` como utilitário

Mover `isDarkHex` de `ProjetoBgColorPicker.tsx` para `src/lib/colorUtils.ts` para ser reutilizado pelo hook.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/lib/colorUtils.ts` | Novo — utilitário `isDarkHex` |
| `src/hooks/usePageBgColor.ts` | Novo — hook de cor de fundo por página |
| `src/pages/ProjetoHome.tsx` | Adicionar picker + aplicar cor |
| `src/pages/MinhasTarefas.tsx` | Adicionar picker + aplicar cor |
| `src/pages/ProjetoInbox.tsx` | Adicionar picker + aplicar cor |
| `src/pages/Projetos.tsx` | Adicionar picker + aplicar cor |
| `src/pages/ProjetosMinhaEquipe.tsx` | Adicionar picker + aplicar cor |
| `src/components/projetos/ProjetoBgColorPicker.tsx` | Importar `isDarkHex` do utilitário |

