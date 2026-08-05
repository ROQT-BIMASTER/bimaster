# Colocar projetos existentes em pastas (em lote)

Hoje já é possível mover um projeto por vez pelo menu de três pontos do card ("Mover para pasta" / "Remover da pasta"). O que falta é uma forma prática de organizar vários projetos já em andamento de uma vez e de transferi-los entre pastas.

## O que será entregue

1. **Novo diálogo "Organizar projetos"**, aberto por um botão na barra de pastas e também de dentro do gerenciador de pastas.
   - Seletor da pasta de destino (compartilhadas e pessoais, respeitando alçada).
   - Lista pesquisável de todos os projetos visíveis ao usuário, com caixa de seleção.
   - Cada linha mostra a pasta atual do projeto (ou "Sem pasta"), para deixar claro o que é inclusão e o que é transferência.
   - Atalhos "Selecionar todos" / "Limpar" sobre o resultado filtrado.
   - Ação "Mover N projetos" e ação secundária "Remover da pasta" para os selecionados.

2. **Atalho contextual**: quando uma pasta específica estiver ativa na barra, o botão abre o diálogo já com essa pasta pré-selecionada.

3. **Feedback**: toast único com o total movido; em falha parcial, informa quantos foram movidos e quantos falharam.

## Regras mantidas

- Pastas continuam sendo apenas organização visual: nenhuma mudança de permissão ou visibilidade.
- Pastas compartilhadas só podem ser organizadas por admin / gerente geral de Projetos; pastas pessoais, por qualquer usuário (apenas para si).
- Um projeto continua em no máximo uma pasta compartilhada e uma pasta pessoal.

## Detalhes técnicos

- `src/hooks/useProjetoPastas.ts`: adicionar `moverProjetosEmLote` (mesma lógica de `moverProjeto`, porém com delete/insert agregados por lote e uma única invalidação de cache no fim).
- Novo componente `src/components/projetos/ProjetoPastasAtribuirDialog.tsx` com a lista de projetos, busca e seleção múltipla.
- `src/pages/Projetos.tsx`: novo estado de abertura do diálogo, botão na área da barra de pastas, passagem de `projetos`, `pastaPorProjeto`, `pastas` e da mutação em lote.
- `src/components/projetos/ProjetoPastasBar.tsx`: botão "Organizar projetos" ao lado de "Gerenciar pastas".
- Sem migração de banco: o esquema `projeto_pastas` / `projeto_pasta_itens` já suporta o caso.
