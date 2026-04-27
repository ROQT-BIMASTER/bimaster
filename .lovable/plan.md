# Padronização visual: Color Picker nos ambientes de Produtos Acabados e Revisão de Fichas

## Objetivo
Replicar o mesmo padrão de **personalização de cor de fundo** já aplicado no módulo de Projetos (botão de paleta no header + paleta HSL derivada coerente) nas telas de Produtos Acabados e Revisão de Fichas. **Nenhuma funcionalidade ativa será alterada** — apenas a camada visual/UX.

## Padrão de referência (Projetos)
O módulo de Projetos usa:
- Componente `ProjetoBgColorPicker` no header (16 presets + hex personalizado + remover)
- Helper `getBgPaletteVars(bgColor)` em `src/lib/colorUtils.ts` que deriva uma paleta HSL coerente (cards, badges, inputs, tabela) a partir da cor escolhida
- Aplicação no `<main>` via `style={{ backgroundColor, color, ...getBgPaletteVars(bgColor) }}`
- Persistência: em `Projetos.tsx` (listagem) é estado local; em `ProjetoDetalhe.tsx` é salvo em `projetos.bg_cor`

## Telas a padronizar

| # | Tela | Rota | Persistência |
|---|------|------|--------------|
| 1 | Produtos Acabados (listagem) | `/dashboard/fabrica/produtos-acabados` | localStorage (por usuário) |
| 2 | Ficha de Custo do Produto | `/dashboard/fabrica/produtos-acabados/:id/ficha-custo` | localStorage |
| 3 | Revisão de Fichas (Diretoria) | `/dashboard/fabrica/revisao-fichas` | localStorage |
| 4 | Produtos Brasil (listagem) | `/dashboard/produtos-brasil` | localStorage |
| 5 | Cadastro Produto Brasil | `/dashboard/produtos-brasil/cadastro/:id?` | localStorage |
| 6 | Importar Produtos Acabados | `/dashboard/fabrica/importar-produtos-acabados` | localStorage |

Optamos por **localStorage** (chave por tela, ex.: `bg_color:fabrica_produtos_acabados`) para evitar migração de schema e manter preferência por usuário/dispositivo, igual à listagem de Projetos. Caso futuramente se queira persistir por usuário no banco, basta adicionar coluna preferences.

## Mudanças por arquivo

### 1. `src/pages/FabricaProdutosAcabados.tsx`
- Importar `ProjetoBgColorPicker` e `getBgPaletteVars`
- Adicionar estado `bgColor` com leitura/escrita em `localStorage`
- Inserir `<ProjetoBgColorPicker>` no header ao lado do `SidebarTrigger`
- Aplicar `style={...}` no `<main>` quando `bgColor` definido
- **Não tocar** em filtros, KPIs, queries, RLS, lógica de famílias de status, audit triggers ou alertas de mismatch

### 2. `src/pages/FichaRevisaoDiretoria.tsx`
- Mesmo padrão acima (header + main wrapper)
- Preservar fluxo de aprovação/revisão e badges de status

### 3. `src/pages/FichaCustoProduto.tsx`
- Mesmo padrão (página de detalhe)
- Preservar tabelas de insumos e modo foco

### 4. `src/pages/ProdutosBrasilListagem.tsx`
- Mesmo padrão

### 5. `src/pages/ProdutoBrasilCadastro.tsx`
- Mesmo padrão

### 6. `src/pages/ImportarProdutosAcabados.tsx`
- Mesmo padrão

## Padrão técnico unificado (snippet)

```tsx
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { getBgPaletteVars } from "@/lib/colorUtils";

const STORAGE_KEY = "bg_color:fabrica_produtos_acabados";
const [bgColor, setBgColor] = useState<string | null>(
  () => localStorage.getItem(STORAGE_KEY)
);
const handleBgChange = (c: string | null) => {
  setBgColor(c);
  if (c) localStorage.setItem(STORAGE_KEY, c);
  else localStorage.removeItem(STORAGE_KEY);
};

// No <main>:
<main
  className="flex-1 overflow-auto"
  style={bgColor ? ({
    backgroundColor: bgColor,
    color: "hsl(var(--foreground))",
    ...getBgPaletteVars(bgColor),
  } as React.CSSProperties) : undefined}
>
  ...
  <div className="flex items-center gap-3">
    <SidebarTrigger />
    <ProjetoBgColorPicker value={bgColor} onChange={handleBgChange} />
    <h1>...</h1>
  </div>
```

## Garantias de não-regressão
- Nenhuma migração SQL
- Nenhuma alteração em hooks de dados, mutations ou RLS
- Nenhuma alteração em filtros, KPIs ou famílias de status (`status-families.ts`)
- Sem mexer em `FilterMismatchAlert`, audit triggers ou storage policies
- Apenas adições de import + estado local + wrapper de estilo

## Resumo
6 telas, 1 componente reutilizado, 1 helper já existente, persistência local. Entrega puramente visual alinhada ao padrão de Projetos.