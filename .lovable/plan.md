

## Projeto "BiMaster - Implantação do Sistema" com Documentação Completa

### Objetivo
Criar via SQL migration um projeto completo de acompanhamento da implantação do BiMaster, com seções por módulo/departamento, tarefas com percentuais de conclusão realistas baseados no código existente, e descrições detalhadas servindo como documentação e fluxogramas de cada função.

### Seções (Módulos do Sistema)
Baseado na análise completa do codebase (`src/pages/`), o projeto terá **14 seções**:

1. **Dashboard & Administração** — painel principal, aprovações, departamentos, LGPD
2. **CRM / Prospects** — gestão de prospects, importação, reativação, lead mining, whitespace
3. **Trade Marketing** — visitas, fotos, campanhas, sell-out, competidores, shelf, rewards
4. **Fábrica** — ordens produção, fórmulas, qualidade, máquinas, operadores, planejamento
5. **Financeiro** — contas pagar/receber, DRE, fluxo de caixa, saldos, plano de contas
6. **Marketing & Redes Sociais** — mission control, nano banana, ElevenLabs
7. **Estoque** — consolidado, distribuidoras, produtos master, saldos, vinculações
8. **Projetos** — gestão tarefas, Kanban, Gantt, calendário, inbox, equipe, aprovações
9. **China (Importação)** — submissões, ficha produto, recebimentos, ordens, cofre docs
10. **Chat & Comunicação** — chat interno, WhatsApp monitoring, call history
11. **Mapas & Geolocalização** — mapa comercial, municípios, intelligence IBGE
12. **Eventos Corporativos** — eventos, dashboard, aprovações
13. **Relatórios & Analytics** — relatórios, AI analytics, QA agent, auditoria
14. **Infraestrutura & Segurança** — auth, PWA, API health, configurações, roles/RLS

### Tarefas por Seção
Cada seção terá **4-8 tarefas** representando funcionalidades-chave. Cada tarefa incluirá:
- `titulo`: nome da funcionalidade
- `descricao`: documentação detalhada com fluxograma em texto (inputs → processo → outputs, departamentos envolvidos, regras de negócio)
- `status`: `concluida`, `em_andamento` ou `pendente` baseado no estado real do código
- `prioridade`: `alta`, `media` ou `baixa`

### Percentuais Estimados por Módulo
| Módulo | Estimativa |
|---|---|
| Dashboard & Admin | 90% |
| CRM / Prospects | 85% |
| Trade Marketing | 90% |
| Fábrica | 80% |
| Financeiro | 75% |
| Marketing | 60% |
| Estoque | 70% |
| Projetos | 95% |
| China | 85% |
| Chat & Comunicação | 70% |
| Mapas | 80% |
| Eventos | 75% |
| Relatórios & Analytics | 65% |
| Infraestrutura | 85% |

### Implementação Técnica

**Único arquivo**: Uma SQL migration que:
1. Cria o projeto `BiMaster - Implantação do Sistema` vinculado ao admin (primeiro user da tabela `user_roles` com role admin)
2. Insere as 14 seções com `ordem` sequencial
3. Insere ~70 tarefas com `titulo`, `descricao` (documentação completa com fluxograma textual), `status`, `prioridade`
4. Adiciona o admin como membro coordenador em `projeto_membros`

A `descricao` de cada tarefa conterá:
- **Visão Geral**: O que a funcionalidade faz
- **Departamentos**: Quem usa
- **Fluxo**: Passo-a-passo do processo (entrada → processamento → saída)
- **Tabelas Envolvidas**: Referências ao banco
- **Status Atual**: O que está implementado vs pendente

### Arquivos a Criar/Modificar
| Arquivo | Ação |
|---|---|
| `supabase/migrations/seed_projeto_implantacao.sql` | Migration com todo o conteúdo |

Nenhuma alteração de código frontend necessária — o projeto aparecerá automaticamente na tela de Projetos para o admin.

