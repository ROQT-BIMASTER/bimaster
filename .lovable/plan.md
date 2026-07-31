# Substituição de Thalyta por Debora (Gerente de CSO)

## O que foi levantado no ambiente

Thalyta Dutra Fucitalo participa hoje de **10 projetos ativos** (mais 5 vínculos em projetos já excluídos):

| Projeto | Papel dela |
|---|---|
| Digitação de Pedidos | coordenador |
| Redigitação de Pedidos | coordenador |
| Lançamento Wonder | coordenador |
| Pedidos Distribuidor | coordenador |
| Suporte - Administrativo CSO | coordenador |
| AGENDAMENTO | membro |
| Ajuste de valor em pedidos | membro |
| Produtos solicitados a reserva. | membro |
| Reserva Grandes Redes | membro |
| Pessoal (projeto pessoal dela) | coordenador |

Outros vínculos: é criadora de 4 projetos operacionais (Digitação, Redigitação, Lançamento Wonder, Pedidos Distribuidor), responsável direta por 7 tarefas (1 em aberto), corresponsável em 8 e colaboradora em 9 tarefas, além de participante de 5 conversas de chat. Não é responsável por nenhum departamento, não tem subordinados e não tem chamados de suporte atribuídos.

Debora Ap de Mello Pacheco hoje só tem o projeto "Pessoal" — ou seja, ainda não está em nenhum projeto do CSO.

## O que será feito

1. **Adicionar Debora a todos os 9 projetos operacionais** com o mesmo papel que Thalyta tinha (coordenador onde ela era coordenadora, membro nos demais). O projeto "Pessoal" da Thalyta **não** é transferido — é área pessoal e cada usuário tem a sua.
2. **Transferir a titularidade dos 4 projetos** criados por ela (Digitação de Pedidos, Redigitação de Pedidos, Lançamento Wonder, Pedidos Distribuidor) para Debora.
3. **Transferir as tarefas em aberto** (pendente / em andamento) em que Thalyta é responsável, corresponsável ou colaboradora, passando Debora para o lugar dela.
4. **Preservar o histórico**: tarefas já concluídas mantêm o registro da Thalyta como executora original — não reescrevemos histórico concluído nem logs de auditoria.
5. **Incluir Debora nas conversas de chat** dos projetos transferidos, para que ela receba as tratativas em andamento.
6. **Encerrar os vínculos ativos da Thalyta**: remover das listas de membros dos projetos operacionais e revogar o papel de acesso, mantendo o perfil e todo o rastro de auditoria intactos (offboarding sem perda de trilha).

## Detalhes técnicos

- Operação feita por script de dados (`insert`/`update`), em transação única, sobre: `projeto_membros`, `projetos.criador_id`, `projeto_tarefas.responsavel_id`, `projeto_tarefa_responsaveis`, `projeto_tarefa_colaboradores`, `conversas_participantes` e `user_roles`.
- Inserções em `projeto_membros` e nas junções de responsáveis usam upsert por chave (`projeto_id,user_id` / `tarefa_id,user_id`) para evitar duplicidade caso Debora já esteja vinculada.
- Nas tarefas, a troca só se aplica onde `status <> 'concluida'` e `deleted_at IS NULL`.
- Antes/depois da execução, gero uma contagem comparativa por tabela para conferência.
- Nenhuma mudança de código de frontend é necessária; a Central de Trabalho e o Kanban leem esses vínculos em tempo real.

## Confirmações antes de executar

- Se preferir que Thalyta permaneça como membro somente leitura em vez de ser removida, ajusto o passo 6.
- Se quiser que também as tarefas concluídas passem para Debora, informo o impacto no histórico e altero o passo 3/4.
