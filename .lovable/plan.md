

# Dashboard Público de Respostas do Formulário

## Resumo

Criar uma versão pública (sem autenticação) do dashboard de respostas, acessível via link compartilhável. Usuários externos que preencheram o formulário poderão ver KPIs e gráficos de distribuição, mas **sem** acesso à análise IA nem aos dados individuais das respostas (protegendo privacidade).

## Abordagem

Criar uma nova página leve `DynamicFormDashboardPublic.tsx` que reutiliza a lógica de carregamento e visualização do dashboard existente, mas:
- Sem `DashboardLayout` / `ProtectedRoute` — layout standalone limpo
- Sem botão de análise IA (requer auth)
- Sem tabela de respostas individuais (protege dados sensíveis)
- Apenas: KPIs (total respostas, respostas hoje) + gráficos de distribuição por campo
- Acessível via rota pública `/formulario-dashboard?id=FORM_ID`

## Alterações

### 1. `src/pages/DynamicFormDashboardPublic.tsx` — Novo

- Página standalone com header simples (nome do formulário + logo)
- Carrega form + fields + responses via Supabase (as tabelas já possuem RLS que permite leitura)
- Exibe KPIs: total respostas, respostas hoje
- Exibe gráficos de distribuição (BarChart/PieChart) para campos select/radio/rating
- Sem tabela de respostas, sem análise IA, sem navegação interna

### 2. `src/App.tsx` — Adicionar rota

- Rota pública: `/formulario-dashboard` → `DynamicFormDashboardPublic`

### 3. `src/components/forms/DynamicFormRenderer.tsx` — Link pós-envio

- Após submissão bem-sucedida, exibir link/botão "📊 Ver estatísticas" que abre `/formulario-dashboard?id=FORM_ID` em nova aba

### 4. RLS — Verificar acesso público

- Confirmar que `dynamic_forms`, `dynamic_form_fields` e `dynamic_form_responses` permitem SELECT para anon (formulários ativos). Se não, criar policy para forms com status `active`.

## Segurança

- Nenhum dado individual é exposto — apenas agregações (contagens, distribuições)
- Análise IA não disponível no modo público
- Dados de metadata/user_id nunca expostos

