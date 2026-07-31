# Auditoria de saída — Thalyta Dutra Fucitalo

Usuária localizada no sistema: **Thalyta Dutra Fucitalo** (t.dutra@distribuidoraunion.com.br), Coordenadora CSO, perfil ainda **ativo**, papel `vendedor`, membro de 15 projetos e com 7 permissões de tela individuais. Não existe cadastro grafado "Thalita".

## O que a auditoria mostra

Nenhuma exclusão relevante ou destrutiva foi encontrada.

- Trilha de tarefas (`tarefa_auditoria_log`): 4 eventos, todos de conclusão/reabertura. **Zero exclusões**.
- 68 tarefas criadas por ela — **nenhuma está excluída** hoje.
- Nenhuma tarefa que ela tocou está na lixeira.
- Nenhum projeto consta como excluído por ela (a exclusão de projetos não registra autor; ver lacuna abaixo).
- Nenhum download em lote de anexos registrado.
- Documentos de produto: 35 eventos, todos `upload` — nenhuma remoção.
- Último acesso registrado: 20/07/2026; última atividade em tarefas: 29/07/2026.

Remoções pontuais encontradas (baixa criticidade, todas com rastro):

| Data | Ação | Item | Projeto |
|---|---|---|---|
| 29/07 14:21 | Anexo removido | COMBO - WONDER ID 89 EMY BARRETOS (1).xlsx | Lançamento Wonder |
| 29/07 14:21 | Anexo removido | ID key Account (6).xlsx | Lançamento Wonder |
| 13/07 14:20 | Anexo removido | Distrivix.jpeg | Pedidos Distribuidor |
| 08/07 13:01 | Anexo removido | WhatsApp Image 2026-07-07.jpeg | Pedidos Distribuidor |
| 06/07 19:55 | Seguidor removido | Kauã Alves Teixeira | Digitação de Pedidos |
| 06/07 18:19 | Anexo removido | JR EMPREENDIMENTOS.xlsx | Pedidos Distribuidor |
| 06/07 18:19 | Anexo removido | Pedido Distribuidor - PRIMER 06-07.xlsx | Pedidos Distribuidor |
| 06/07 12:10 | Anexo removido | Produtos do Mês Filiais _ Julho 2026.xlsx | Digitação de Pedidos |
| 03/07 19:31 | Anexo removido | JR EMPREENDIMENTOS.xlsx | Pedidos Distribuidor |
| 03/07 19:19 | Responsável removido | ela mesma | Pedidos Distribuidor |

Padrão compatível com troca/substituição de planilhas de pedido, não com apagamento de acervo.

## Entregas propostas

1. **Relatório de desligamento em tela** (`/dashboard/admin/auditoria-desligamento`, restrito a admin): busca por usuário e período, com resumo de criações, conclusões, remoções de anexos/membros, uploads, acessos negados e último acesso, além de exportação em PDF/CSV para o RH.
2. **Ação de offboarding assistida** a partir dessa tela: encerrar sessões ativas, inativar o perfil, revogar permissões de tela/módulo e listar os 15 projetos e as tarefas em aberto sob responsabilidade dela para reatribuição — sem apagar histórico.
3. **Fechar a lacuna de rastreio de exclusão de projetos**: hoje `projetos.deleted_at` não guarda quem excluiu. Passar a registrar autor e motivo, e espelhar o evento na trilha imutável.
4. **Preservação de evidências**: marcar os registros de auditoria dela como retidos, fora das rotinas de purga por tempo.

## Detalhes técnicos

- Fontes consultadas: `tarefa_auditoria_log`, `projeto_tarefa_atividades`, `projeto_atividades`, `produto_doc_audit_log`, `access_audit_log`, `security_audit_log`, `anexos_download_log`, `projeto_tarefas.deleted_at`, `projetos.deleted_at`.
- Nova RPC `SECURITY DEFINER` `rpc_relatorio_desligamento_usuario(_user_id, _de, _ate)` consolidando as fontes acima, com acesso restrito por `has_role(auth.uid(),'admin')`.
- Coluna `deleted_by`/`deleted_motivo` em `projetos`, preenchida pela rotina de exclusão e replicada em `audit_log_immutable`.
- Offboarding reaproveita `session_invalidation_queue` e os padrões já existentes em `useProjetoOffboarding`.
- Exportação usando os utilitários de PDF já existentes, sem `window.open`.

Nada é excluído do banco em nenhuma etapa; a proposta é somente leitura, revogação de acesso e reatribuição.
