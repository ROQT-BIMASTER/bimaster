

# Enriquecer Relatório de Desenvolvimento com Conexão a Projetos

## Objetivo
O relatório atual documenta bem os módulos individuais (testes, embalagem, ANVISA, etc.), mas falta o **elo central com o módulo de Projetos** — como tudo se conecta, qual o começo, meio e fim do processo do ponto de vista operacional da equipe.

## O que será adicionado/modificado

### Nova Seção 2 (antes do pipeline) — "Projetos como Motor do Desenvolvimento"
Explica que o módulo de Projetos é o **centro de comando** de todo o ciclo. Inclui:
- Como um projeto de tipo `desenvolvimento_produto` é criado (template com seções: Criação, Regulatório, Embalagem, etc.)
- Campos obrigatórios: marca, categoria, origem
- Vinculação de membros por papel (coordenador, design, regulatório, QA)
- Diagrama ASCII: `Projeto → Seções → Tarefas → Produto vinculado`

### Nova Seção 3 — "Ciclo Completo: Começo, Meio e Fim"
Diagrama ASCII de 3 fases claras:

**COMEÇO** (Concepção):
- Criação do projeto tipo "Desenvolvimento de Produto"
- Wizard gera seções automáticas por departamento
- Produto China vinculado → cria Produto Brasil automaticamente
- Briefing IA gerado por tarefa

**MEIO** (Execução):
- Tarefas distribuídas por seções (Kanban, Lista, Gantt, Calendário)
- Cada tarefa pode ter produto vinculado com StatusPipeline
- Fluxo de validação: tarefa concluída → Enviar para Validação → Checklist + Auditoria IA
- Testes, Embalagem, ANVISA executados em paralelo por equipes diferentes
- Focus Mode com painel de produto lado a lado

**FIM** (Conclusão):
- Cadastro Final com 7 validações bloqueantes
- Aprovação física por 5 critérios → RNC se não conforme
- Tarefa validada → produto avança no pipeline
- Projeto finalizado quando todos os produtos atingem "Lançamento"

### Nova Seção 4 — "Estrutura de Tarefas e Governança"
- Hierarquia: Projeto → Seções → Tarefas → Subtarefas
- Código automático (PR-001, PR-002)
- Fluxo de validação por tipo de projeto (dev produto vs genérico)
- Diagrama: `Tarefa Concluída → Enviar Validação → Checklist → Auditoria IA → Aprovada/Rejeitada`

### Renumeração das seções existentes
As seções atuais (3-14) serão renumeradas para (5-16), mantendo todo o conteúdo existente intacto.

## Arquivo modificado
- `src/pages/RelatorioDesenvolvimento.tsx` — inserção de 3 novas seções após a seção 1 (Resumo Executivo) e renumeração das demais.

## Impacto
- Apenas 1 arquivo modificado
- Sem migração de BD
- Badge da capa atualizado: "12 Estágios | 8 Módulos | Governança Completa"

