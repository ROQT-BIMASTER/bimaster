# Organização de Projetos em Pastas (Workspaces)

Objetivo: reduzir a poluição da lista de Projetos permitindo agrupar projetos em pastas, sem alterar nenhuma regra de acesso, permissão ou dado existente.

## Princípio de segurança

Nada do que existe hoje muda de comportamento. As pastas são uma camada puramente organizacional, aditiva:

- Nenhum projeto é escondido por falta de pasta: quem não usar pastas continua vendo a lista exatamente como hoje.
- As pastas não concedem nem removem acesso. A visibilidade continua sendo decidida pelas regras atuais (criador, membro, departamento, "Ver todos" para admin/gerente geral).
- Toda a estrutura nova vive em tabelas novas; a tabela de projetos ganha apenas uma referência opcional de pasta.

## O que o usuário vai ver

1. **Barra de pastas** no topo da lista de Projetos: "Todos", "Sem pasta" e cada pasta com a contagem de projetos. Clicar filtra a lista.
2. **Modo agrupado** (alternável): em vez de uma lista única, a tabela aparece dividida em seções recolhíveis por pasta. A preferência (lista x agrupado, pasta selecionada, seções recolhidas) fica salva por usuário.
3. **Pastas compartilhadas** (visíveis para toda a empresa, ex.: Financeiro, Marketing, China) — criadas e editadas por admin/gerente geral. Um projeto pertence a no máximo uma pasta compartilhada.
4. **Pastas pessoais**: cada usuário cria as suas para organizar a própria visão; ninguém mais as vê. Um projeto entra em no máximo uma pasta pessoal do usuário.
5. **Mover projeto**: opção "Mover para pasta" no menu de três pontos do projeto (e ação em massa quando houver seleção múltipla).
6. **Gerenciar pastas**: diálogo simples para criar, renomear, escolher cor/ícone, reordenar e excluir. Excluir uma pasta nunca exclui projetos — eles voltam para "Sem pasta".

Começamos com todas as pastas vazias; nenhum projeto é movido automaticamente. O filtro por departamento que já existe continua funcionando em paralelo.

## Detalhes técnicos

Banco (uma migration aditiva, sem DROP/ALTER destrutivo):

- `projeto_pastas`: `id`, `nome`, `cor`, `icone`, `ordem`, `escopo` ('compartilhada' | 'pessoal'), `owner_id` (nulo em compartilhada), `created_by`, timestamps. Unique parcial por (`owner_id`, `nome`) em pessoais e por `nome` em compartilhadas.
- `projeto_pasta_itens`: `pasta_id`, `projeto_id`, `user_id` (nulo = vínculo compartilhado), `created_at`. Unique parcial garantindo no máximo uma pasta compartilhada por projeto e uma pasta pessoal por (projeto, usuário). Usar tabela de vínculo em vez de coluna em `projetos` evita qualquer risco em produção nas escritas atuais de projeto.
- GRANTs explícitos para `authenticated` e `service_role`, RLS habilitada nas duas tabelas.
- Policies com semi-joins (`EXISTS`/`IN`), sem funções pesadas: leitura de pastas compartilhadas para qualquer autenticado; escrita apenas para admin/gerente geral (padrão já usado em Projetos). Pastas pessoais: leitura/escrita apenas do `owner_id = auth.uid()`.
- Vínculos: um usuário só pode vincular um projeto que ele já enxerga (semi-join contra as tabelas de membros/criador/departamento já usadas hoje).

Frontend:

- Novo hook `useProjetoPastas` (TanStack Query) com queries de pastas e vínculos e mutations de criar/renomear/mover/excluir com atualização otimista.
- Novos componentes em `src/components/projetos/`: `ProjetoPastasBar`, `ProjetoPastasManagerDialog`, `MoverParaPastaMenuItem`, `ProjetoPastaGroupSection` — mantendo `Projetos.tsx` enxuto (a filtragem entra no `useMemo` que já existe).
- Preferência de visualização em `localStorage` (`projetos:pastas:view`), seguindo o padrão de `VER_TODOS_KEY` e `useTarefaDensity`.
- Tokens semânticos apenas; cores de pasta vindas da paleta já usada em projetos.

Testes e rollout:

- Testes unitários da lógica de agrupamento/filtragem e testes de integração cobrindo "sem pasta", pasta compartilhada + pessoal simultâneas e exclusão de pasta sem perder projetos.
- Script de verificação de RLS para as duas tabelas novas, no padrão de `scripts/security/`.
- Bump de `APP_VERSION` com entrada no changelog em `ApiDocumentation.tsx`.
- Rollback: como nada existente é alterado, basta ocultar a barra de pastas; os dados de pasta ficam inertes.
