

# Configurar Credenciais Phyllo e Ativar Descoberta com IA

## Situação Atual

Vejo que não existe `PHYLLO_CLIENT_ID` nem `PHYLLO_CLIENT_SECRET` nos secrets do projeto. A edge function `phyllo-proxy` já está pronta e retorna erro 503 quando essas credenciais estão ausentes.

## Plano

### 1. Cadastrar os secrets
Ao aprovar este plano, vou solicitar que você insira as duas credenciais:
- **PHYLLO_CLIENT_ID**
- **PHYLLO_CLIENT_SECRET**

### 2. Criar edge function `discover-influencers`
Nova função que usa a API Phyllo de busca/descoberta para encontrar influenciadores por query, hashtag ou marca. Retorna resultados estruturados com perfil, seguidores, engajamento e nicho.

### 3. Criar componente `InfluencerDiscovery.tsx`
- Campo de busca com linguagem natural (perfil, #hashtag, marca)
- Chips de exemplo clicáveis
- Filtros de plataforma e faixa de seguidores
- Cards de resultado com botão **"Monitorar"** que salva na tabela `influencers`

### 4. Atualizar `InfluencerDashboard.tsx`
- Adicionar botão "Descobrir com IA" ao lado do "Adicionar Influenciador"
- Abrir dialog com o componente de descoberta
- Atualizar lista após adicionar influenciador ao monitoramento

## Arquivos

| Arquivo | Ação |
|---|---|
| Secrets (`PHYLLO_CLIENT_ID`, `PHYLLO_CLIENT_SECRET`) | Cadastrar |
| `supabase/functions/discover-influencers/index.ts` | Criar |
| `src/components/marketing/influencers/InfluencerDiscovery.tsx` | Criar |
| `src/components/marketing/influencers/InfluencerDashboard.tsx` | Modificar |

