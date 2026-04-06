

# Adicionar Tarefas de Melhorias Pendentes em Cada Projeto de Módulo

## Objetivo

Atualizar a Edge Function `seed-system-projects` para incluir, na seção **"Melhorias & Backlog"** de cada módulo, tarefas detalhadas de melhorias identificadas a partir da análise do código atual. Cada tarefa terá prazo estimado (via campo `data_prazo`) e prioridade.

## Análise de Melhorias Identificadas por Módulo

### Prospects & CRM
- Integração WhatsApp para disparos diretos do prospect (já listado, sem prazo)
- Dashboard de funil de conversão com taxas por etapa
- Notificações de follow-up automático por inatividade
- Exportação de relatórios PDF com branding

### Comercial
- Dashboard de Forecast com IA (sazonalidade + histórico)
- Comparativo meta vs realizado com alertas automáticos
- Integração de pedidos OMS com pipeline de vendas
- Curva ABC dinâmica com atualização em tempo real

### Trade Marketing
- IA de análise de fotos de PDV (qualidade de execução)
- Relatório de ROI por campanha com métricas financeiras
- Offline mode completo para visitas (já há captura offline parcial)
- Dashboard de cobertura geográfica com mapas de calor

### Financeiro
- Aprovação de pagamentos com workflow multi-nível
- Conciliação bancária automática (match por valor+data)
- Alertas de vencimento por email/push
- Dashboard consolidado AP+AR+DRE em tela única
- Previsão de fluxo de caixa com IA

### Fábrica Brasil
- Integração de OP com ERP (sync bidirecional)
- Dashboard de OEE (eficiência global de equipamento)
- Alertas de estoque mínimo de matéria-prima
- Rastreabilidade de lote ponta-a-ponta
- Comparativo de custo planejado vs realizado por OP

### Fábrica China
- Notificações WeChat para revisão pendente
- Dashboard de lead time por fornecedor
- Automação de emissão de PO a partir de submissão aprovada
- Relatório de conformidade documental por fornecedor

### Marketing
- IA de otimização de budget entre plataformas
- A/B testing tracker integrado
- Relatório consolidado cross-platform (Meta + Google + Analytics)
- Automação de agendamento de posts com calendário editorial

### Projetos
- Templates customizáveis pelo usuário
- Dependências entre tarefas (predecessoras/sucessoras)
- Relatório de produtividade por membro da equipe
- Automação de status por regras (ex: todas subtarefas concluídas → pai concluída)
- Burndown chart por sprint/período

### Estoque
- Alertas de estoque mínimo/máximo por produto
- Dashboard de giro de estoque
- Integração de movimentações com ERP
- Inventário com leitura de código de barras

### Eventos
- Integração Google Calendar / Outlook
- Dashboard de ROI por evento
- Check-in digital de participantes com QR code
- Gestão de fornecedores do evento

### Reuniões
- Transcrição automática de áudio com IA
- Resumo automático e extração de action items por IA
- Integração com Google Meet / Zoom para gravação
- Busca semântica em atas anteriores

### Integração ERP
- Retry automático para webhooks que falharam
- Dashboard de saúde das integrações com alertas
- Logs de sync com drill-down por entidade
- Documentação interativa auto-gerada das APIs

### Central de Inteligência
- Alertas proativos de insights críticos (push)
- Dashboard preditivo com séries temporais
- Correlação automática entre módulos (vendas × estoque × produção)
- Exportação de relatórios executivos em PDF

## Implementação Técnica

### Alteração na Edge Function `seed-system-projects/index.ts`

1. **Expandir backlogTasks** de cada módulo com 4-6 tarefas específicas (em vez das 1-2 atuais)
2. **Adicionar `data_prazo`** no insert de tarefas — prazos escalonados de 30 a 180 dias a partir da data de execução
3. **Adicionar `prioridade`** no insert — alta/média/baixa conforme impacto
4. **Status `pendente`** para tarefas de backlog (em vez de `concluida`)

### Lógica de prazos

```text
Prioridade alta  → +30 dias
Prioridade média → +60-90 dias  
Prioridade baixa → +120-180 dias
```

### Estrutura do insert atualizado

Cada tarefa de backlog será inserida com:
- `status: "pendente"`
- `prioridade: "alta" | "media" | "baixa"`
- `data_prazo: new Date(now + dias).toISOString()`
- Descrições detalhadas com escopo e benefício esperado

## Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/seed-system-projects/index.ts` | Expandir seção "Melhorias & Backlog" de todos os 13 módulos com ~60 novas tarefas detalhadas, prazos e prioridades |

