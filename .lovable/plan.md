

# Padronizar Listagens com Visual Tipo "Projetos"

## O que fazer

Aplicar o mesmo padrão visual da listagem de Projetos (imagem de referencia) nas listagens dos 5 novos modulos. Atualmente todos usam Cards empilhados -- vamos trocar por uma **tabela estilizada com header de colunas**, avatar colorido, barra de progresso, badge de status e data, igual ao `Projetos.tsx` (linhas 234-309).

## Padrão visual (extraido de Projetos.tsx)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Produto          │ Status        │ Progresso     │ Etapa  │ Criado │
├──────────────────┼───────────────┼───────────────┼────────┼────────┤
│ 🟠 Lip Oil       │ ⏳ Em Análise │ ████░░ 60%    │ Embal. │ 12 mar │
│    SKU: HB-L6526 │               │               │        │        │
└──────────────────┴───────────────┴───────────────┴────────┴────────┘
```

- Container: `border rounded-xl overflow-hidden bg-card`
- Header row: `bg-muted/50 text-xs font-medium text-muted-foreground`
- Data rows: `grid` com colunas fixas, `hover:bg-muted/30`, `cursor-pointer`, `border-b`
- Avatar: circulo colorido com inicial do produto (cor derivada do tipo/status)
- Progress bar: componente `<Progress>` com `h-1.5` + percentual ao lado
- Status: `<Badge>` com variant por status
- Data: `text-[11px] text-muted-foreground`, formato `dd MMM yyyy`

## Modulos a padronizar (5 arquivos)

### 1. ChecklistComposicao.tsx (linhas 74-95)
**Colunas:** Produto | Status INCI | % Validado | Rodada | Criado em
- Trocar `grid gap-3` de Cards por tabela estilizada
- Adicionar avatar com inicial + cor
- Barra de progresso = % ingredientes validados (se disponivel)
- Manter DashboardLayout + Breadcrumb (adicionar, pois falta)

### 2. RecebimentoAmostra.tsx (linhas 105-132)
**Colunas:** Produto | Status Amostra | Evidencias | Rodada | Criado em
- Trocar Cards por tabela
- Progresso = fotos/videos enviados vs obrigatorios
- Adicionar DashboardLayout + Breadcrumb

### 3. AnaliseEmbalagem.tsx (linhas 170-226)
**Colunas:** Produto | Aprovacao | Specs | Solicitacoes | Criado em
- Ja tem DashboardLayout -- apenas trocar Cards por tabela
- Badges de specs ficam inline na coluna "Specs"

### 4. ChecklistEtiquetaBula.tsx (linhas 109-143)
**Colunas:** Produto | Etapa Atual | Timeline | Rodada | Criado em
- Ja tem DashboardLayout -- apenas trocar Cards por tabela
- Timeline mini fica na coluna "Timeline"

### 5. FluxoArtesMotor.tsx - aba "Todos" (linhas 225-254)
**Colunas:** Documento | Produto | Tipo | Etapa | Status | Criado em
- Trocar Cards por tabela
- Adicionar DashboardLayout + Breadcrumb
- A aba "Produtos (Gate)" mantem o layout agrupado atual

## Implementacao tecnica

Para cada modulo:

1. **Wrapper**: envolver com `DashboardLayout` + `ModuleBreadcrumb` (onde falta)
2. **Substituir listagem de Cards** por:
```tsx
<div className="border rounded-xl overflow-hidden bg-card">
  {/* Header */}
  <div className="grid grid-cols-[...] gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
    <span>Produto</span>
    <span>Status</span>
    <span>Progresso</span>
    <span>Etapa</span>
    <span>Criado em</span>
  </div>
  {/* Rows */}
  {items.map(item => (
    <div className="grid grid-cols-[...] gap-4 px-5 py-3 items-center border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors">
      {/* Avatar + nome */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-primary font-bold text-xs">H</span>
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{nome}</p>
          <p className="text-[11px] text-muted-foreground truncate">{sku}</p>
        </div>
      </div>
      {/* Status badge */}
      <Badge variant={...}>{status}</Badge>
      {/* Progress */}
      <div className="flex items-center gap-3">
        <Progress value={pct} className="h-1.5 flex-1" />
        <span className="text-xs font-semibold">{pct}%</span>
      </div>
      {/* Etapa / info extra */}
      ...
      {/* Date */}
      <span className="text-[11px] text-muted-foreground">12 mar 2026</span>
    </div>
  ))}
</div>
```

3. **Responsividade**: Em mobile (`md:hidden`), manter Cards simplificados com border-left colorido. A tabela fica `hidden md:block`.

4. **Correcoes incluidas**: Trocar `useMemo` com setState por `useEffect` em `ChecklistComposicao` e `RecebimentoAmostra`.

5. **KPIs**: Padronizar todos para `grid-cols-2 md:grid-cols-4`.

## Arquivos modificados

| Arquivo | Alteracoes |
|---------|-----------|
| `ChecklistComposicao.tsx` | + DashboardLayout/Breadcrumb, tabela, KPIs responsivos, fix useMemo |
| `RecebimentoAmostra.tsx` | + DashboardLayout/Breadcrumb, tabela, KPIs responsivos, fix useMemo |
| `AnaliseEmbalagem.tsx` | Tabela nas duas sub-listas (Analises + Solicitacoes) |
| `ChecklistEtiquetaBula.tsx` | Tabela com timeline inline |
| `FluxoArtesMotor.tsx` | + DashboardLayout/Breadcrumb, tabela na aba "Todos", KPIs responsivos |

