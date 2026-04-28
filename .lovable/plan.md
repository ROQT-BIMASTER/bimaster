## Diagnóstico

Confirmei dois problemas reais ao revisar o código e o banco:

### 1. Painéis criados não aparecem para outros usuários
- A tabela `influencer_paineis` tem RLS correta: `SELECT` permite `user_id = auth.uid() OR compartilhado = TRUE`.
- Porém, ao **criar** o painel, o componente `PainelDialog` não está expondo a opção `compartilhado` de forma evidente. O default é `false`, então quando Nathalia/Daniella abrem a tela, o painel da Camila aparece apenas se foi marcado "Compartilhar com a equipe" — o que provavelmente não foi feito.
- Mesmo se for marcado, o "Geral" continua sendo a aba padrão (via `localStorage`), então elas não percebem o painel novo.

### 2. Buscas/IA não funcionam
- `InfluencerDashboard.loadInfluencers()` filtra rigidamente por `user_id = user.id`. Como **100% dos 90 influenciadores cadastrados pertencem a um único user_id** (`da2db53b...` = Camila), Nathalia e Daniella veem **lista vazia**.
- Com lista vazia, todos os painéis IA dependentes (`AIOpportunitiesPanel`, `ContentIntelligencePanel`, `AutopilotMiningPanel`, `InfluencerSuggestionsPanel`, `RegionalPerformancePanel`) e qualquer ranking ficam sem dados de entrada — daí a sensação de "IA não funciona".
- A RLS da tabela `influencers` também é restritiva (`auth.uid() = user_id`), então mesmo removendo o filtro do front, o backend não retornaria nada para os outros usuários.

A causa raiz é arquitetural: **Influenciadores foi modelado como dado pessoal, não como dado de equipe Marketing**. Para multiusuário do mesmo módulo, precisa de escopo compartilhado.

---

## Plano

### Etapa 1 — Compartilhamento de Influenciadores no nível Marketing
Adicionar política RLS de leitura adicional em `public.influencers` permitindo que qualquer usuário com acesso à tela `marketing_social` (via `usuario_permissoes_telas`) veja os influenciadores cadastrados pela equipe. Mantém INSERT/UPDATE/DELETE restritos ao dono original (não muda governança de escrita).

```sql
-- Pseudo: SELECT também se o user tem permissão na tela marketing_social
CREATE POLICY "Marketing team can view all influencers"
ON public.influencers FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.usuario_permissoes_telas upt
    JOIN public.telas_sistema t ON t.id = upt.tela_id
    WHERE upt.usuario_id = auth.uid() AND t.codigo = 'marketing_social'
  )
);
```

Aplicar o mesmo padrão para tabelas auxiliares consultadas pelos painéis IA (a confirmar na implementação): `influencer_company_profile`, `influencer_suggestions`, `influencer_opportunities` (caso existam) — leitura compartilhada para a equipe Marketing.

### Etapa 2 — Remover filtro `user_id` no front
Em `InfluencerDashboard.loadInfluencers()` e demais hooks da pasta `influencers/`, retirar o `.eq("user_id", user.id)` das queries de **leitura**. A RLS passa a ser a única fonte de truth de visibilidade. Mantém o `user_id` apenas em inserts.

### Etapa 3 — Painéis compartilhados por padrão para equipe Marketing
Pequenas melhorias no `PainelDialog`:
- Switch "Compartilhar com a equipe" passa a vir **ligado por padrão** (multiusuário é o caso esperado deste módulo).
- Texto explicativo mais claro: "Painéis compartilhados aparecem para toda a equipe Marketing."

E no `PaineisTabs`:
- Indicar visualmente quem criou o painel compartilhado (ex.: "por Camila").
- Quando um novo painel compartilhado é criado por outro usuário, ele aparece automaticamente na próxima abertura (já funciona via React Query, sem mudança).

### Etapa 4 — Garantir que a IA enxerga o pool completo
Os edge functions `influencer-autopilot`, `ai-opportunities`, `content-intelligence` (a confirmar nomes exatos) já rodam com Service Role e enxergam tudo; só preciso verificar se eles filtram por `user_id` do chamador. Se sim, ajustar para escopo "equipe Marketing" (ou aceitar parâmetro de escopo) — assim Nathalia disparando a IA usa o mesmo pool da Camila.

### Etapa 5 — Validação
- Testar como Nathalia: deve ver os 90 influenciadores, painéis compartilhados existentes, e conseguir disparar análise IA.
- Testar como Camila: continua vendo tudo, painéis pessoais (não compartilhados) seguem privados.
- Verificar que escritas (criar/editar/excluir influenciador) continuam restritas ao dono.

---

## Detalhes técnicos

**Arquivos afetados (frontend):**
- `src/components/marketing/influencers/InfluencerDashboard.tsx` — remover `.eq("user_id", user.id)` da leitura
- `src/components/marketing/influencers/paineis/PainelDialog.tsx` — default `compartilhado=true`, copy ajustada
- `src/components/marketing/influencers/paineis/PaineisTabs.tsx` — exibir autor em painéis compartilhados
- Verificar e ajustar leituras em: `AIOpportunitiesPanel.tsx`, `ContentIntelligencePanel.tsx`, `InfluencerSuggestionsPanel.tsx`, `AutopilotMiningPanel.tsx`, `RegionalPerformancePanel.tsx`, `InfluencerRankingPanel.tsx`

**Migrations:**
- Nova policy SELECT em `public.influencers` (semi-join via `EXISTS`, sem function — segue o padrão "High Volume RLS")
- Mesma policy para tabelas auxiliares de IA, conforme inventariado durante a implementação
- Bump de `APP_VERSION` para forçar atualização do PWA das usuárias

**Não afeta:**
- Governança de escrita (cada usuário ainda só altera/exclui o que cadastrou)
- Painéis pessoais (continuam privados quando `compartilhado=false`)
- Nenhuma outra tela/módulo