

# Modernizacao Visual + Banners + Incentivos — Trade Marketing

## Escopo

Tres frentes: (A) redesign visual rosa/pink no modulo Trade, (B) gerenciador de banners no admin, (C) incentivos da semana no admin + tela do usuario.

**Regra**: nenhuma funcionalidade existente sera alterada — apenas visual atualizado e novas secoes/rotas adicionadas.

---

## A. Modernizacao Visual (aplicada nos modulos Trade)

### Mudancas no Design System (apenas Trade)

Nao alterar o tema global do app. Criar classes utilitarias e componentes wrapper especificos para o contexto Trade:

- **Paleta Trade**: rosa primario `#E91E78`, background blush `#FFF0F5`, gradientes roxo-pink `#7C3AED → #E91E78`
- **Cards**: `border-radius: 16px`, sombras suaves, hover com `scale(1.02)`
- **Busca pill**: barra arredondada no topo do TradeModule
- **Tipografia**: manter fonte do sistema (Inter/Segoe UI) — apenas aumentar peso visual dos titulos
- **Bottom nav**: nao sera adicionado (app ja tem sidebar/DashboardLayout — bottom nav quebraria UX existente)

### Componentes visuais novos

| Componente | Descricao |
|---|---|
| `TradeHeroBanner` | Carrossel horizontal com banners arredondados, auto-slide 5s |
| `TradeSearchBar` | Barra de busca pill no topo com icone lupa |
| `TradeSectionHeader` | Titulo bold + link "Abrir todas" a direita |
| `TradeIncentiveCard` | Card com icone, barra progresso, badge status |
| `TradeCouponTicket` | Estilo voucher com recortes arredondados |

### Paginas afetadas

- `TradeModule.tsx` — redesign dos cards KPI, adicionar carrossel de banners e secao incentivos
- `TradeAdminModule.tsx` — adicionar links para Banners e Incentivos nas secoes admin

---

## B. Gerenciador de Banners (Admin)

### Tabela no banco

```sql
CREATE TABLE public.trade_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  imagem_url TEXT NOT NULL,
  link_destino TEXT,
  posicao INTEGER DEFAULT 0,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_fim TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: admin pode tudo, outros podem SELECT onde ativo=true
```

### Nova pagina: `/dashboard/trade/admin/banners`

- Tabela com thumbnail, titulo, periodo, status (ativo/inativo/agendado)
- Botao "Novo Banner" → dialog com:
  - Upload imagem (drag & drop para storage bucket `trade-banners`)
  - Campos: titulo, link destino, posicao, data inicio/fim, toggle ativo
  - Preview do banner
- Acoes por linha: editar, duplicar, desativar, excluir
- Drag & drop para reordenar (usando `@dnd-kit` ja disponivel ou sortable simples)

### Carrossel no TradeModule

- `TradeHeroBanner` busca banners ativos com `data_inicio <= now()` e `(data_fim IS NULL OR data_fim >= now())`
- Auto-slide com dots de navegacao
- Clique redireciona para `link_destino`

---

## C. Incentivos da Semana

### Tabela no banco

```sql
CREATE TABLE public.trade_incentivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('visitas','fotos','vendas','ranking','bonus')),
  meta_valor NUMERIC DEFAULT 0,
  meta_unidade TEXT DEFAULT 'unidades',
  recompensa TEXT,
  icone TEXT DEFAULT '🎯',
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '6 days'),
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.trade_incentivo_progresso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incentivo_id UUID REFERENCES trade_incentivos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  valor_atual NUMERIC DEFAULT 0,
  concluido BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(incentivo_id, user_id)
);
-- RLS: admin CRUD em incentivos, usuarios leem ativos e CRUD proprio progresso
```

### Nova pagina admin: `/dashboard/trade/admin/incentivos`

- Cards resumo dos incentivos da semana atual
- Botao "Criar Incentivo" → formulario:
  - Titulo, descricao, tipo (dropdown), meta/valor alvo, recompensa, icone/emoji
  - Periodo (padrao segunda-domingo corrente)
  - Toggle ativo
- Lista com filtro por data, badges status (Em andamento / Concluido / Expirado)
- Historico de semanas anteriores

### Secao no TradeModule (tela do usuario)

- Secao "Incentivos da Semana" com banner tematico gradiente roxo/pink
- Grid de cards: icone + titulo + barra progresso + meta (ex: "8/15 PDVs") + tempo restante + recompensa
- Badge: "Em andamento", "Concluido", "Expirado"
- Clique abre detalhe com descricao completa e regras

---

## Rotas novas no App.tsx

```text
/dashboard/trade/admin/banners     → TradeBannersAdmin
/dashboard/trade/admin/incentivos  → TradeIncentivosAdmin
```

Ambas protegidas por `ScreenRoute screenCode="trade_admin"`.

---

## Estrutura de arquivos

```text
src/
  components/trade/
    banners/
      TradeHeroBanner.tsx        # Carrossel na home
      BannerFormDialog.tsx       # Form criar/editar
      BannerListTable.tsx        # Tabela admin
    incentivos/
      IncentivosWeekSection.tsx  # Secao na home do usuario
      IncentivoCard.tsx          # Card individual
      IncentivoFormDialog.tsx    # Form admin
      IncentivosAdminList.tsx    # Lista admin
    ui/
      TradeSearchBar.tsx
      TradeSectionHeader.tsx
  pages/
    trade/
      TradeBannersAdmin.tsx
      TradeIncentivosAdmin.tsx
  hooks/
    useTradeBanners.ts
    useTradeIncentivos.ts
```

## Ordem de execucao

1. Migracoes SQL (2 tabelas + RLS + storage bucket)
2. Hooks de dados (`useTradeBanners`, `useTradeIncentivos`)
3. Componentes de banners (admin + carrossel)
4. Componentes de incentivos (admin + secao usuario)
5. Redesign visual do TradeModule (cores, cards, carrossel, secao incentivos)
6. Rotas no App.tsx + links no TradeAdminModule

