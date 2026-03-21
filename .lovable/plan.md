

# Plano: Banner para Incentivos da Semana

## O que será feito

Adicionar um campo `banner_url` na tabela `trade_incentivos` para que cada incentivo possa ter uma imagem de banner. O banner header da seção "Incentivos da Semana" na home do Trade passará a exibir a imagem do banner quando configurada, no lugar do gradiente estático atual. Também será criado um banner de teste via seed SQL.

## Alterações

### 1. Migração SQL
- `ALTER TABLE trade_incentivos ADD COLUMN banner_url TEXT DEFAULT NULL`
- Inserir um incentivo de teste com banner usando uma imagem placeholder (gradiente gerado ou URL de exemplo)

### 2. `src/hooks/useTradeIncentivos.ts`
- Adicionar `banner_url: string | null` à interface `TradeIncentivo`

### 3. `src/components/trade/incentivos/IncentivoFormDialog.tsx`
- Adicionar campo de upload de imagem para banner (similar ao padrão já usado em `BannerFormDialog`)
- Upload para bucket `trade-banners` (reutilizar bucket existente)
- Preview da imagem com botão de remover
- Otimização automática via edge function `optimize-banner-image` no upload

### 4. `src/components/trade/incentivos/IncentivosWeekSection.tsx`
- Se houver incentivos ativos com `banner_url`, exibir carrossel de banners (auto-slide 7s, pausa ao toque) no lugar do header gradiente estático
- Se nenhum tiver banner, manter o header gradiente atual como fallback

### 5. `src/pages/trade/TradeIncentivosAdmin.tsx`
- Exibir thumbnail do banner na lista de incentivos (se houver)

## Arquivos alterados

| Arquivo | Tipo |
|---|---|
| Migração SQL | Novo |
| `src/hooks/useTradeIncentivos.ts` | Editar |
| `src/components/trade/incentivos/IncentivoFormDialog.tsx` | Editar |
| `src/components/trade/incentivos/IncentivosWeekSection.tsx` | Editar |
| `src/components/trade/incentivos/IncentivosAdminList.tsx` | Editar |

