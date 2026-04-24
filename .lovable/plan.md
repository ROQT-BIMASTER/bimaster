# Plano: Vincular China — Padronização visual com Central de Trabalho (v3.4.13)

Reorganizar a tela `ProjetoVincularChina` e migrar os KPIs para o componente global `KpiCard`, replicando a identidade visual da Central de Trabalho (cards uniformes, header em duas linhas, paddings consistentes). **Sem alteração de regras de negócio, dados ou comportamento — apenas melhoria visual.**

---

## 1. `src/components/china/VincularChinaKpis.tsx` — refatorar

Substituir os Cards customizados (com `bg-*/5`, `text-color`, ícones inline e altura variável) pelo componente global `KpiCard` (`src/components/ui/kpi-card.tsx`), o mesmo usado em `CentralKPIs`. Ganhos:
- Altura mínima uniforme (`min-h-[112px]`) — elimina serrilha vertical entre KPIs.
- Variantes semânticas (`info`, `warning`, `success`, `destructive`, `default`) que se adaptam à paleta dinâmica de `getBgPaletteVars` em qualquer cor de fundo.
- Estado ativo via `ring-2 ring-primary ring-offset-1` (mesmo padrão da Central).

**Mapeamento status → variant:**
| KPI            | filterKey         | variant       | ícone       |
|----------------|-------------------|---------------|-------------|
| Total          | todos             | `default`     | LayoutGrid  |
| Enviados       | enviado           | `info`        | Clock       |
| Em Revisão     | em_revisao        | `warning`     | AlertTriangle |
| Aprovados      | aprovado          | `success`     | CheckCircle2 |
| Enviado Brasil | enviado_brasil    | `info`        | Truck       |
| Rejeitados     | rejeitado         | `destructive` | XCircle     |
| Vinculados     | vinculados        | `success`     | Link2       |

Grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3` (mobile-first responsivo, mesma cadência da Central).

---

## 2. `src/pages/ProjetoVincularChina.tsx` — header padronizado

Reorganizar o bloco de header (linhas ~448–509) para refletir o padrão da Central:

- **Linha 1:** Breadcrumb + actions (`SidebarTrigger` + `ProjetoBgColorPicker`) — já existe, mantém.
- **Linha 2 (hero):** ícone chip arredondado (`h-10 w-10 rounded-xl bg-primary/10`), título + progresso, e o `Select` de projeto à direita.
- **Remover** o botão `ArrowLeft "voltar"` redundante (a sidebar já cumpre essa função, igual à Central).
- Padding do container de `p-6` → `p-4 sm:p-6` (mobile-first), mantendo `space-y-4`.

Estrutura final (apenas o header, resto intocado):

```tsx
<div className="p-4 sm:p-6 w-full space-y-4">
  {/* Linha 1: Breadcrumb + actions — mantém o que já existe */}
  <div className="flex items-center justify-between gap-3">
    <Breadcrumb>...</Breadcrumb>
    <div className="flex items-center gap-2 shrink-0">
      <SidebarTrigger />
      <ProjetoBgColorPicker value={bgColor} onChange={setBgColor} />
    </div>
  </div>

  {/* Linha 2: Hero (sem o ArrowLeft redundante) */}
  <div className="flex items-center gap-3 flex-wrap">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
      <Link2 className="h-5 w-5 text-primary" />
    </div>
    <div className="flex-1 min-w-0">
      <h1 className="text-xl font-bold text-foreground truncate">
        Vincular Envio China 关联中国发货
      </h1>
      <div className="flex items-center gap-3 mt-1">
        <Progress value={progressPct} className="h-2 w-40" />
        <span className="text-xs font-medium text-foreground">
          {vinculadasCount}/{tableData.length} · {progressPct}%
        </span>
      </div>
    </div>
    <div className="w-[250px]">
      <Select ...>...</Select>
    </div>
  </div>

  {/* KPIs, tabela e demais blocos — sem alteração */}
  <VincularChinaKpis ... />
  ...
</div>
```

`ArrowLeft` e `useNavigate` deixam de ser usados — remover dos imports para evitar warnings.

---

## 3. `src/lib/version.ts` — bump v3.4.13 + PR-49

Incrementar `APP_VERSION` para `'3.4.13'` e adicionar bloco PR-49 no topo do changelog descrevendo:
- Migração de `VincularChinaKpis` para `KpiCard` global (variantes semânticas, altura uniforme, ring de estado ativo).
- Reorganização do header do Vincular China em duas linhas (breadcrumb/actions + hero/seletor) seguindo padrão da Central.
- Remoção do botão "voltar" redundante (navegação via sidebar).
- Padding mobile-first (`p-4 sm:p-6`).

Invariantes verificáveis (atendendo `release-changelog-discipline`):
- Positivo: `grep -q "PR-49" src/lib/version.ts`
- Negativo: `! grep -q "bg-primary/5\|bg-warning/5\|bg-success/5" src/components/china/VincularChinaKpis.tsx`
- Versão: `grep -q "3.4.13" src/lib/version.ts`

---

## Arquivos modificados
- `src/components/china/VincularChinaKpis.tsx` — refatoração completa para `KpiCard`.
- `src/pages/ProjetoVincularChina.tsx` — header reorganizado, imports limpos.
- `src/lib/version.ts` — bump 3.4.12 → 3.4.13 + entrada PR-49.

## Fora de escopo (preservado)
- Toda a lógica de fetch, vínculos, dispatches, dialogs, side panel, focus mode e tabela permanece **idêntica**.
- A cor global e o hook `usePageBgColor` continuam exatamente como estão.
- Nenhuma alteração de RLS, edge function ou tabela.
