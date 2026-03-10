

# Fluxo Administrativo de Aprovação de OC (Brasil)

## Contexto

Hoje, quando o Brasil clica "Emitir OC", a ordem é criada com status `emitida` e já fica visível para a China produzir. Faz sentido adicionar uma etapa administrativa intermediária porque:

- Uma OC é um compromisso financeiro de compra — precisa de aprovação antes de virar pedido oficial
- Evita erros (quantidades, prazos) que iriam direto para a fábrica
- Cria rastreabilidade de quem solicitou vs quem aprovou

## Fluxo Proposto

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Usuário Brasil  │     │  Admin/Supervisor │     │   China (Fábrica)│
│  cria rascunho   │────▶│  aprova ou rejeita│────▶│  vê OC aprovada  │
│  status:         │     │  status:          │     │  e inicia produção│
│  "rascunho"      │     │  "aprovada" ou    │     │                   │
│                  │     │  "rejeitada"      │     │                   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Status da OC ajustados:**
- `rascunho` — criada, aguardando aprovação interna (novo)
- `aprovada` → substitui `emitida` como status que a China enxerga
- `rejeitada` — devolvida com observação (novo)
- `em_producao`, `concluida`, `cancelada`, `embarque_enviado` — mantidos

## Alterações

### 1. Database Migration
- Adicionar colunas: `aprovado_por` (uuid), `aprovado_em` (timestamptz), `motivo_rejeicao` (text)
- Status default muda de `'emitida'` para `'rascunho'`

### 2. `EmitirOCDialog.tsx`
- O insert passa a criar com status `rascunho` em vez de `emitida`
- Toast muda para "OC criada como rascunho — aguardando aprovação"

### 3. Nova seção: Aprovação de OC no `ChinaOrdemDetalhe.tsx`
- Card de aprovação visível apenas para `isBrasilUser` + admin/supervisor
- Botões "Aprovar" (muda status para `aprovada`, registra `aprovado_por`/`aprovado_em`) e "Rejeitar" (abre campo de motivo, muda para `rejeitada`)
- China só vê o formulário de produção quando status = `aprovada`

### 4. `ChinaOrdens.tsx` — Lista
- Adicionar status `rascunho` e `rejeitada` no mapa de badges
- China: filtrar para mostrar apenas OCs com status `aprovada` ou posterior (oculta rascunhos)
- Brasil: vê todas, com destaque para as pendentes de aprovação

### 5. `ChinaFabrica.tsx` — Dashboard
- Badge no card de OCs mostrando quantas estão "Pendentes de aprovação" (para Brasil)

### Arquivos impactados
| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Colunas `aprovado_por`, `aprovado_em`, `motivo_rejeicao`; default status `rascunho` |
| `EmitirOCDialog.tsx` | Status insert → `rascunho` |
| `ChinaOrdemDetalhe.tsx` | Card de aprovação/rejeição (Brasil only) |
| `ChinaOrdens.tsx` | Novos status badges + filtro China |
| `ChinaFabrica.tsx` | Badge pendentes aprovação |

