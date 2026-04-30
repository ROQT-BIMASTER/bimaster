## Objetivo

Adicionar uma barra de rolagem vertical no card **Meus Projetos** (aba Hoje da Central de Trabalho) e remover o limite de 6 projetos, para que você consiga arrastar a barra para baixo e ver todos os seus projetos ativos.

## Contexto

Hoje o card está em `src/components/projetos/central/HojeTab.tsx` e usa o hook `useMeusProjetosRecentes` (`src/hooks/useMeusProjetosRecentes.ts`), que faz `.limit(6)` no Supabase. O resultado é renderizado em uma `<div>` simples sem altura máxima nem `overflow-y`, então não há scrollbar mesmo se houvesse mais projetos.

## Mudanças

1. **Hook `useMeusProjetosRecentes.ts`**
   - Remover o `.limit(6)` para trazer todos os projetos ativos do usuário (ou subir para um teto seguro tipo 200, evitando query sem limite).
   - Manter a ordenação atual.

2. **Card "Meus Projetos" em `HojeTab.tsx`**
   - Envolver a lista (`divide-y ...`) em um container com `max-h-[420px]` (≈6 itens visíveis, mantendo a aparência atual) e `overflow-y-auto`.
   - Aplicar a mesma classe de scrollbar fina já usada no projeto (`[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-border ...`) para combinar com o tema escuro.
   - Adicionar um pequeno header informativo com a contagem total (ex.: `Meus Projetos · 12`) para deixar claro que existe mais conteúdo abaixo.
   - Manter o estado de loading (skeletons) e o empty state inalterados.

## Detalhes técnicos

- Sem mudanças de schema, RLS ou edge functions.
- Sem alteração de SDK/OpenAPI/`APP_VERSION` é estritamente necessária, mas seguirei o padrão do projeto e farei bump em `src/lib/version.ts` + entrada no changelog de `src/components/erp/ApiDocumentation.tsx` (regra `release-changelog-discipline`).
- A barra de rolagem usa apenas tokens Tailwind/semânticos já existentes no design system (`border`, `muted`), sem cores cruas.

## Fora de escopo

- Não vou mudar o layout, paginação infinita, filtros ou ordenação dos projetos.
- Não vou tocar no card de "Atividades" abaixo nem no hook compartilhado por outras telas.