
# Correção de Permissões: Milene Harumi

## Problema Identificado

Milene tem apenas a tela `trade_admin`, mas falta:
1. O **módulo `trade`** - necessário para ver o Trade Marketing na navegação
2. Outras **telas do Trade** - para acesso completo às funcionalidades

## Situação Atual vs Desejada

| Permissão | Atual | Necessário |
|-----------|-------|------------|
| Módulo `trade` | Não | Sim |
| Tela `trade_admin` | Sim | Sim |
| Tela `trade_marketing` | Não | Sim |
| Outras telas Trade | Não | Sim |

## Correção Proposta

Adicionar todas as permissões de Trade Marketing para Milene:

### 1. Adicionar Módulo Trade
```sql
INSERT INTO usuario_permissoes_modulos (usuario_id, modulo_id)
VALUES ('7eb17733-d824-4758-8ddf-7b9606ef4991', 'd33394b9-fc47-4e28-befc-f46025269187');
```

### 2. Adicionar Todas as Telas de Trade
Incluir acesso a todas as telas relacionadas ao Trade Marketing:
- trade_marketing (visão geral)
- trade_admin (administrativo) - já tem
- trade_stores/TRADE_LOJAS (PDVs)
- trade_visits/TRADE_VISITAS (Visitas)
- trade_photos/TRADE_FOTOS (Fotos)
- trade_promotions (Promoções)
- trade_competitors (Concorrentes)
- trade_insights (Insights IA)
- TRADE_DASHBOARD (Dashboard)
- TRADE_PERFORMANCE (Performance)
- TRADE_AUDITORIAS (Auditorias)
- trade_import_stores (Importar Lojas)

## Resultado Esperado

Após a correção:
- Milene verá o módulo Trade Marketing no menu lateral
- Terá acesso a todas as funcionalidades do Trade
- Continuará com acesso administrativo exclusivo
