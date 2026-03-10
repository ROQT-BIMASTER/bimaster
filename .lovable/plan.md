

## Criar Subtarefas Detalhadas no Projeto "BiMaster - Implantação do Sistema"

### Objetivo
Inserir subtarefas (`parent_tarefa_id` preenchido) em cada uma das ~54 tarefas pai existentes, mapeando todas as funcionalidades efetivamente desenvolvidas no sistema com base na análise completa do codebase.

### Escopo
Serão inseridas aproximadamente **280+ subtarefas** distribuídas pelas 14 seções. Cada subtarefa terá:
- `titulo`: nome da funcionalidade implementada
- `status`: `concluida` (maioria, pois foram desenvolvidas)
- `secao_id`: mesmo da tarefa pai
- `projeto_id`: `25c59cc5-0219-41fb-b718-496af49be999`
- `parent_tarefa_id`: ID da tarefa pai correspondente

### Mapeamento Completo por Seção

**1. Dashboard & Administração**

| Tarefa Pai | Subtarefas |
|---|---|
| Painel Principal | KPIs Executivos, Funil de Prospecção, Widget Prospects, Widget Trade, Widget Financeiro |
| Gestão de Departamentos | Hub de Departamentos, Orçamentos por Depto, Despesas e Anexos, Aprovação de Verbas, Envio ao Financeiro, Foco Mode Despesas |
| Aprovação de Usuários | Tela Aguardando Aprovação, Fluxo de Aprovação Admin, Usuário Bloqueado |
| LGPD & Compliance | Painel LGPD Admin, Termos de Uso, Política de Privacidade, Aceite de Termos Modal |
| Gestão de Permissões | Permissões por Módulos, Permissões por Telas, Permissões por Departamentos, Ordem dos Módulos, Impersonation (visualizar como outro usuário) |

**2. CRM / Prospects**

| Tarefa Pai | Subtarefas |
|---|---|
| Gestão de Prospects | Pipeline de Prospects, Novo Prospect Dialog, Busca CNPJ (BizCreditos), Filtros e Preview CNPJ |
| Importação de Prospects | Importar Clientes (Excel/CSV), Mapeamento de Campos, Atribuição Admin |
| Lead Mining & Whitespace | Tela Lead Mining, Whitespace Analysis, Municípios Intelligence (IBGE) |
| Reativação de Clientes | Tela Reativação, Scoring de Clientes, Fila de Cobrança |
| Chamadas com IA | Interface AI Call, Transcrição ao Vivo, Histórico de Chamadas |

**3. Trade Marketing**

| Tarefa Pai | Subtarefas |
|---|---|
| Visitas e Roteiros | Nova Visita Dialog, Atribuir Visita, Editar Visita, Calendário de Visitas, Monitoramento de Visitas, Detalhe da Visita |
| Registro Fotográfico | Captura Offline de Fotos, Análise de Fotos (Status), Detalhe de Foto, Fotos Ideais |
| Sell-Out e Preços | Novo Sell-Out, Sell-Out Multiprodutos, Quick Entry, Comparação de Produtos, Relatório Competitivo |
| Campanhas e Rewards | Campanhas (CRUD + Detalhe), Lançamentos de Campanhas, Rewards Dialog, Badges/Showcase, Level Progress, Promoções |
| Competidores e Share | Novo Competidor, Produto Concorrente, Auditoria de Gôndola, Shelf Measurements, Share History Chart, Brand Share Dashboard |

**4. Fábrica**

| Tarefa Pai | Subtarefas |
|---|---|
| Ordens de Produção | Nova Ordem Dialog, Cronômetro de Produção, Apontamentos, Registro de Parada, Refugo, Retrabalho, Simulador de Produção |
| Fórmulas e Receitas | Editor de Fórmulas, Árvore de Fórmula, Aprovador de Fórmula, Comparador de Versões, Roteiro de Produção |
| Controle de Qualidade | Nova Inspeção, Plano de Inspeção, Ficha de Análise, Comunicação de Revisões, Revisão Chat Consolidado |
| Máquinas e Manutenção | Cadastro de Máquina, Cadastro de Operador, Registro de Parada |
| Planejamento (PCP) | Tela Planejamento, Lançamentos Fábrica, Produtos Acabados, Importar Produtos Acabados, Matérias-Primas (CRUD), Categorias MP |

**Fábrica (adicional) - Precificação e Fiscal** (subtarefas distribuídas):
- Ficha de Custo Produto, Editor de Custos, Cadeia Precificação Visual, Tabelas de Preço, Aprovação de Preços, Gerador de Preços, Simulador de Impacto, Reajuste em Lote, Histórico de Preços, Limites de Preço, Markup Overrides
- Fiscal: Tabela Impostos, NCM, Regras Fiscais, NF Saída, Apuração Fiscal, IVA (Dual Tab, Simulador, Alíquotas), Validação Fiscal Recebimento
- Recebimentos, Lançamento Detail, Cotações Insumo, Histórico Custos Insumo

**5. Financeiro**

| Tarefa Pai | Subtarefas |
|---|---|
| Contas a Pagar | Dashboard Contas Pagar, Calendário Vencimentos, AI Chat (Sofia), Sincronização ERP, Plano Redução Gastos, Metas Redução, Revisão de Gastos, Classificação Rápida, Transferir Fornecedor, Auditoria CP |
| Contas a Receber | Dashboard Contas Receber, Calendário Recebimentos (Aggregated), Importar CSV, Sincronização, Cobrança Inadimplentes, Scoring, Acordo Calculadora, Templates Mensagem, Cobrança Automática, Auditoria CR |
| DRE | DRE Analítico, Focus Mode, Classificar Categorias, Classificar Contas em Lote, Reclassificar Conta, Fonte Control, Auditoria Plano Contas, Password Confirm |
| Fluxo de Caixa | Tabela Fluxo Caixa, KPIs Avançados, Filtros, Gráfico Anual, Movimentações, Análise Inadimplência, Cash Gap Alerts |

**6. Marketing & Redes Sociais**

| Tarefa Pai | Subtarefas |
|---|---|
| Mission Control | Dashboard Mission Control, Calendário Editorial, Agendamento de Posts, Monitoramento Social Media, Sentimento, Gráficos |
| Campanhas de Ads | Gerador de Imagens AI, Gerador Criativo de Produto, DashCortex Reports, LookerStudio Reports, PowerBI Reports |
| ElevenLabs | Studio ElevenLabs, Nano Banana Video Engine |
| Analytics Performance | Marketing Insights Chat, Social Media Charts |

**7. Estoque**

| Tarefa Pai | Subtarefas |
|---|---|
| Estoque Consolidado | Tela Consolidado, Nova Movimentação, Histórico Movimentações |
| Distribuidoras | Tela Distribuidoras, Nova Distribuidora Dialog |
| Produtos Master | Tela Produtos Master, Novo Produto Master, Produto Detalhes Sheet |
| Vinculação | Tela Vinculações, Vincular Produto Dialog, Mapear Produtos Dialog |

**8. Projetos**

| Tarefa Pai | Subtarefas |
|---|---|
| Gestão de Projetos | Lista de Projetos, Novo Projeto Dialog, Detalhe do Projeto, Seções colapsáveis, Tarefas (CRUD), Subtarefas, Quick Add Task, Lixeira (soft delete + restaurar), Filtros e Ordenação, Criar com IA, Cor de fundo customizável, Código automático, Briefings e Import, Arquivos do Projeto, Focus Mode |
| Cronograma Gantt | Cronograma View, Barras por estágio, Risk Badges, Task Evolution Chart, Diamantes (marcos) |
| Aprovação e Governança | Workflow de Aprovação, Validação Final, Retrabalho (motivo obrigatório), Atividades Log (auditoria), Dependências entre tarefas, Health Panel |
| Equipe e Hierarquia | Dashboard Equipe, Membros Dialog, Colaboradores, Inbox Feed, Inbox Card, Calendário View, Kanban View, @Menções, Resumo IA |

**9. China (Importação)**

| Tarefa Pai | Subtarefas |
|---|---|
| Submissões | Nova Submissão, Detalhe Submissão, Manual de Submissão, Data Validation, Ficha Produto, Checklist Projeto |
| Ordens de Compra | Detalhe Ordem, Emitir OC, Progress Tracker, Timeline |
| Embarques e Logística | Formulário Embarque, Info Embarque, Grade Editor, Grade View, Excel Preview |
| Cofre de Documentos | Document Slot, Doc Preview, Cofre Fullscreen Modal, Enviar para Cofre, Audit Badge Vínculo |
| Recebimento | Tela Recebimentos, Apontamento Form, Produto Widget, Bilingual Labels |

**10. Chat & Comunicação**

| Tarefa Pai | Subtarefas |
|---|---|
| Chat Interno | Chat Window, Lista de Conversas, Nova Conversa Dialog, AI Insights Chat |
| WhatsApp | Monitoring Panel, Messages Panel, Filtros, Charts, Sentiment Dashboard, Agent Config, Agent Flow |
| Chamadas | Call History, Vincular WhatsApp |
| Notificações Push | Notification Bell, Notification Item, Push Notification Prompt, Offline Indicator |

**11. Mapas & Geolocalização**

| Tarefa Pai | Subtarefas |
|---|---|
| Mapa Comercial | Prospect Map, Mapa Comercial (página), Novo Município Dialog |
| Intelligence IBGE | Municípios Intelligence, IBGE Data, Market Intelligence |
| Geolocalização Visitas | Check-in/out de Visitas, Atribuição de Municípios |

**12. Eventos Corporativos**

| Tarefa Pai | Subtarefas |
|---|---|
| Gestão de Eventos | Novo Evento Dialog, Detalhe do Evento, Despesas (CRUD), Anexos de Despesas |
| Dashboard Eventos | Dashboard com Gráficos, Aprovações Hub |
| Aprovações Orçamento | Aprovar Evento Dialog, Solicitar Verba, Aprovar Despesas, Enviar ao Financeiro |

**13. Relatórios & Analytics**

| Tarefa Pai | Subtarefas |
|---|---|
| Relatórios Gerenciais | Relatório Desempenho, Relatório Financeiro, Relatório Concorrentes, Export Controls |
| AI Analytics | Tela AI Analytics, Insights Automáticos |
| QA Agent | QA Agent Chat |
| Auditoria | Tela Auditoria, Classificar Todo Banco, Logs do Sistema |

**14. Infraestrutura & Segurança**

| Tarefa Pai | Subtarefas |
|---|---|
| Autenticação | Login Form, Signup Form, MFA Enroll, MFA Verify, Protected Route, Module Protected Route, Screen Protected Route, Cliente Protected Route, Dashboard Redirect, Inactivity Modal |
| PWA | Splash Screen, PWA Update Prompt, Offline Indicator, Push Notification Prompt, Instalar App |
| API Health | API Health Check, Monitoramento APIs, Documentação API, Documentação Integração ERP, Gerenciamento API Keys |
| Segurança e RLS | RLS Policies, Gerenciamento Usuários, Hierarquia Usuários, Editar Perfil, Personalizar Cores, Gerenciamento CNPJ |
| Edge Functions | Gerenciamento Integrações, N8N Tab, Sync Control Panel, Configurações Cobrança Automática, Configurações Notificações |

### Implementação Técnica

**Método**: Uma única operação SQL (via insert tool) que insere ~280 registros na tabela `projeto_tarefas` com `parent_tarefa_id` apontando para as tarefas pai existentes. Todas as subtarefas terão `status = 'concluida'` pois representam funcionalidades já implementadas.

**Dados necessários**:
- `projeto_id`: `25c59cc5-0219-41fb-b718-496af49be999`
- `secao_id`: herdado da tarefa pai
- `parent_tarefa_id`: ID da tarefa pai
- `titulo`: nome da funcionalidade
- `status`: `concluida`

### Arquivos a Modificar
Nenhum arquivo de código. Apenas inserção de dados via SQL.

