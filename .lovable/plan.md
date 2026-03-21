

# Plano: Catálogo de Displays — Trade Marketing

## Referência visual

O catálogo Canva mostra displays físicos Ruby Rose para PDV, organizados por tipo e tamanho:
- **Bandejas Híbridas** (60x30cm)
- **Display de Chão Opção 1** — 3 tamanhos: 60cm, 90cm, 120cm (largura) x 35cm x 210cm
- **Display de Chão Canal Farma** — 40x35x140cm

Cada display tem: nome, categoria, variações de medida, fotos do produto renderizado.

---

## Banco de dados

Nova tabela `trade_displays`:

```sql
CREATE TABLE public.trade_displays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT,
  descricao TEXT,
  categoria TEXT,              -- "Bandeja Híbrida", "Display de Chão", "Display Farma"
  largura_cm NUMERIC,
  profundidade_cm NUMERIC,
  altura_cm NUMERIC,
  material TEXT,
  foto_url TEXT,               -- imagem principal (signed URL)
  fotos_extras JSONB DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  posicao INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: admin CRUD, demais SELECT ativo=true
```

Storage bucket `trade-banners` já existe e será reutilizado para fotos de displays.

## Novos arquivos

| Arquivo | Descrição |
|---|---|
| `src/pages/trade/TradeDisplayCatalogAdmin.tsx` | Página admin: grid de displays + CRUD |
| `src/components/trade/displays/DisplayFormDialog.tsx` | Form criar/editar (nome, categoria, medidas LxPxA, material, foto, toggle ativo) |
| `src/components/trade/displays/DisplayCatalogGrid.tsx` | Grid estilo catálogo: card com foto, nome, medidas, badge categoria |
| `src/hooks/useTradeDisplays.ts` | Hook query + mutations |

## Alterações em arquivos existentes

1. **`AppSidebar.tsx`** — novo item `"Catálogo Displays"` no `tradeSubMenus`
2. **`App.tsx`** — rota `/dashboard/trade/admin/displays`
3. **`TradeAdminModule.tsx`** — card link no grupo de conteúdo
4. **`TradeModule.tsx`** — seção "Catálogo de Displays" na home do Trade (grid de cards com foto e medidas, estilo visual rosa/pink consistente)

## Visual dos cards (inspirado no Canva)

Cada card mostrará:
- Foto do display (bordas arredondadas 16px)
- Nome + badge categoria (ex: "Display de Chão")
- Medidas formatadas: **60cm** x **35cm** x **210cm** (L x P x A)
- Hover com scale(1.02)
- Clique abre modal com galeria de fotos e detalhes

## Ordem

1. Migração SQL (tabela + RLS)
2. Hook `useTradeDisplays`
3. Componentes (form + grid)
4. Página admin
5. Seção na home Trade
6. Rota + sidebar + link no admin

