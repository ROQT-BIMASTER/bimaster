## Diagnóstico

O módulo **Projetos** já tem um padrão visual de personalização: hook `usePageBgColor` + `getBgPaletteVars` (recolore cards/tabelas a partir do fundo) + componente `ProjetoBgColorPicker` no header. Hoje está aplicado em:

- ✅ Central de Trabalho
- ✅ Meus Projetos
- ✅ Minha Equipe
- ✅ Detalhe do Projeto / Vincular China

Telas do menu **Projetos** que **não** seguem o padrão:

| Tela | Arquivo | Status |
|---|---|---|
| Caixa de Entrada | `src/pages/ProjetoInbox.tsx` | sem picker |
| Central de Aprovações | `src/pages/CentralAprovacoes.tsx` | sem picker |
| Auditoria de Aprovações | `src/pages/AprovacoesAuditoria.tsx` | sem picker |
| Modelos de Projeto | `src/pages/projetos/MeusModelos.tsx` | sem picker |
| Relatórios | `src/pages/ProjetosRelatorios.tsx` | sem picker |

A paleta atual do `ProjetoBgColorPicker` tem 16 cores (4 linhas × 4 colunas), bem básica:

```
branco / cinza claro / amarelo creme / âmbar suave
vermelho suave / rosa suave / verde suave / verde menta
azul suave / índigo / lilás / violeta
3 pretos + 1 azul-noite
```

## Objetivo

1. **Padronizar**: aplicar nas 5 telas faltantes o mesmo padrão (header com `ProjetoBgColorPicker`, fundo via `usePageBgColor`, paleta derivada via `getBgPaletteVars`).
2. **Ampliar a paleta**: adicionar uma nova faixa de cores ao `ProjetoBgColorPicker` (válida globalmente, beneficiando todas as telas que já usam).

## Mudanças

### 1) Ampliar a paleta — `src/components/projetos/ProjetoBgColorPicker.tsx`

Reorganizar `PRESET_COLORS` em **6 colunas × 5 linhas (30 cores)**, agrupadas por temperatura, mantendo o input HEX para personalização total:

```text
Linha 1 — Neutros claros:    #FFFFFF #F8FAFC #F3F4F6 #E5E7EB #FAF5FF #FFF7ED
Linha 2 — Pasteis quentes:   #FEF3C7 #FDE68A #FED7AA #FECACA #FBCFE8 #F5D0FE
Linha 3 — Pasteis frios:     #D1FAE5 #A7F3D0 #BAE6FD #BFDBFE #C7D2FE #DDD6FE
Linha 4 — Saturados médios:  #34D399 #38BDF8 #6366F1 #A855F7 #EC4899 #F97316
Linha 5 — Escuros / noite:   #0F172A #111827 #1E293B #1F2937 #312E81 #4C1D95
```

A grade do popover passa de `grid-cols-6` (já está) para 6 colunas com 30 swatches; o popover ganha um pouco mais de altura naturalmente. Sem mudança de API.

### 2) Aplicar o padrão nas 5 telas

Em cada arquivo abaixo, importar `usePageBgColor`, `getBgPaletteVars` e `ProjetoBgColorPicker`; instanciar `const { bgColor, setBgColor } = usePageBgColor("<chave>")`; aplicar o `style={ bgColor ? { backgroundColor, color, ...getBgPaletteVars(bgColor), minHeight: "100vh" } : undefined }` no container raiz; e adicionar `<ProjetoBgColorPicker value={bgColor} onChange={setBgColor} />` ao header da página (junto ao título / botão Voltar):

| Arquivo | Chave de preferência |
|---|---|
| `src/pages/ProjetoInbox.tsx` | `projetos_inbox` |
| `src/pages/CentralAprovacoes.tsx` | `projetos_aprovacoes_central` |
| `src/pages/AprovacoesAuditoria.tsx` | `projetos_aprovacoes_auditoria` |
| `src/pages/projetos/MeusModelos.tsx` | `projetos_modelos` |
| `src/pages/ProjetosRelatorios.tsx` | `projetos_relatorios` |

Não há mudança em dados, queries, RLS nem rotas. Só UI/preferência de tema por tela.

## Critérios de aceitação

- O ícone de paleta aparece nas 5 telas listadas, no header, no mesmo estilo das demais telas de Projetos.
- A nova paleta de 30 cores aparece em **todas** as telas que já usam o picker (efeito colateral positivo).
- A escolha persiste por usuário e por tela (já é o comportamento do `usePageBgColor`).
- Cards, tabelas e bordas seguem a paleta derivada (escuro ↔ claro) sem precisar de ajustes manuais.