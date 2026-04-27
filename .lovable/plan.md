
# Sugestões de melhoria de design — Produtos Acabados (e telas irmãs)

Apenas design / experiência. Nenhuma funcionalidade, filtro, regra de negócio ou query é alterada.

## O que não está funcionando bem hoje

Olhando a tela atual (fundo preto, 7 KPIs em linha, painel de filtros à esquerda, tabela densa):

1. **KPIs competem entre si.** Os 7 cards têm o mesmo peso visual, então o olho não sabe onde pousar. O destaque âmbar de "Em Revisão" some no meio.
2. **Tabela "flutua" no fundo escuro.** A linha não tem superfície própria — texto cinza sobre preto puro cansa e reduz legibilidade (WCAG borderline em vários campos).
3. **Badges inconsistentes.** Tipo, Origem, Ficha e Status usam variantes diferentes (`outline`, `secondary`, `default`, custom amber). Cada coluna fala um idioma visual.
4. **Coluna "Responsável" muito carregada.** Nome + ação + tempo relativo, tudo em fontes parecidas, vira ruído.
5. **Painel de filtros pesado.** Card cheio, labels grandes, muito espaço vertical para 5 selects.
6. **Header sem hierarquia.** Título, subtítulo, 4 botões de ação e o seletor de cor disputam a mesma linha.
7. **Alertas (KPI mismatch + aviso âmbar) ocupam 2 faixas largas separadas** — poderiam ser um único bloco compacto.

## Proposta de redesign (visual apenas)

### 1. Header mais respirado
- Título em uma linha, ações agrupadas à direita em um único cluster com separador sutil.
- Subtítulo em `text-xs text-muted-foreground` (hoje compete com o título).
- Botão "Novo Produto" continua primário; os demais (`Painel Administrativo`, `Comunicação de Revisões`, `Importar em Massa`) viram `variant="outline"` com ícone à esquerda e mesma altura (`h-8`).

### 2. KPIs com hierarquia
- Reduzir altura dos cards (de ~104px → ~76px), tipografia do número em `text-2xl font-semibold` (não `text-3xl`).
- **Um único KPI em destaque por vez** (o "Em Revisão" quando >0): borda âmbar + leve glow, os outros em superfície neutra `bg-card/60`.
- Ícone à direita em opacidade 40% (não compete com o número).
- Sublabel ("38 ativos", "51 itens total", "Clique para filtrar") em `text-[10px] uppercase tracking-wide`.

### 3. Tabela com superfície e ritmo
- Envolver a tabela em um `Card` com `bg-card border` próprio (cria contraste contra o fundo customizado da página).
- Linhas com `hover:bg-muted/40` e zebra muito sutil (`even:bg-muted/10`) — facilita rastreio horizontal em telas largas.
- Header da tabela `sticky top-[52px]` (logo abaixo do topo sticky já existente), com `bg-card/95 backdrop-blur` e tipografia `text-[10px] uppercase tracking-wider text-muted-foreground`.
- Reduzir padding vertical de `py-3` → `py-2` e usar `text-[13px]` no corpo (mais densidade sem apertar).
- Coluna "Ações" alinhada à direita, ícones em um `ButtonGroup` com divisores em vez de 4 botões soltos.

### 4. Badges padronizadas (sistema único)
Definir uma escala consistente para todas as colunas categóricas:

```text
TIPO     → soft pill, sem borda, cor por família (Acabado=slate, Display=indigo, Intermediário=zinc)
ORIGEM   → dot + texto (•), Nacional=emerald, Importado=amber-700
FICHA    → status pill com ícone (Rascunho=•, Em Revisão=⏱, Aprovada=✓)
STATUS   → toggle pill (Ativo=emerald-500/15, Inativo=muted)
```

Todas com `h-5 text-[10px] font-medium rounded-md`, mesma altura e mesmo peso. Resultado: a linha "respira" e o olho diferencia rapidamente cada eixo.

### 5. Coluna Responsável reorganizada
```text
[avatar 20px]  Nome Sobrenome
               Editou · há 18 dias
```
Avatar redondo (iniciais quando não há foto), nome em `text-[12px] font-medium`, metadado em `text-[10px] text-muted-foreground`. Remove o ícone de usuário solto.

### 6. Painel de filtros enxuto
- Trocar o card por uma `aside` plana (sem fundo, só `border-r`).
- Labels em `text-[10px] uppercase tracking-wider` acima de cada campo, sem `<Label>` em bloco.
- Selects com `h-8` (hoje `h-10`).
- Switches "Agrupar" / "Ocultos" em uma única linha `flex justify-between` com a label à esquerda — economiza ~80px verticais.
- Botão "Limpar filtros" no rodapé do painel quando houver qualquer filtro ativo.

### 7. Alertas consolidados
- Unificar o aviso âmbar ("7 produto(s) com ficha em revisão…") e o `FilterMismatchAlert` em **um único bloco** com 2 linhas:
  - Linha 1 (informativa): contagem + botão "Abrir Revisões" / "Filtrar lista".
  - Linha 2 (mismatch, só aparece quando há divergência): badges de motivos + "Limpar filtros".
- Bloco com `border-l-4 border-amber-500` em vez de borda completa — fica mais discreto e ainda chama atenção.

### 8. Ajustes de contraste no tema escuro customizado
- Quando `bgColor` é dark (preto/cinza-escuro), forçar `--card` para um tom **um stop mais claro** que o fundo (não igual). Isso já existe via `getBgPaletteVars`, mas a tabela hoje não usa `bg-card` — passa a usar.
- Texto secundário sobe de `text-muted-foreground` (hoje ~50% opacidade no dark) para um token novo `text-muted-foreground/85` em colunas de dado.

### 9. Aplicar o mesmo sistema nas telas irmãs
Mesmo tratamento, sem mudar conteúdo, em:
- `src/pages/ProdutosBrasilListagem.tsx`
- `src/pages/FichaRevisaoDiretoria.tsx`
- `src/pages/FabricaComunicacaoRevisoes.tsx`
- `src/components/fabrica/ProdutoCard.tsx` (já recebeu contraste, agora alinhar badges ao novo sistema)

## Resumo do que muda no código

| Arquivo | Mudança |
|---|---|
| `src/pages/FabricaProdutosAcabados.tsx` | Header reagrupado, KPIs reduzidos, tabela envelopada em Card, painel de filtros enxuto, alertas consolidados |
| `src/components/fabrica/ProdutoCard.tsx` | Badges migradas para o novo sistema (mesma paleta) |
| `src/components/fabrica/FichaAprovacaoBanner.tsx` | `StatusAprovacaoBadge` ganha variantes "soft" para uso em listagens |
| `src/components/shared/StatusPill.tsx` (novo) | Componente único para Tipo/Origem/Status (pill 20px, dot opcional) |
| `src/pages/ProdutosBrasilListagem.tsx`, `FichaRevisaoDiretoria.tsx`, `FabricaComunicacaoRevisoes.tsx` | Aplicar mesmos componentes/estrutura |

## Garantias

- Zero mudança em hooks, queries, RLS, regras de filtro, famílias de status, auditoria, exportações.
- Zero mudança nos rótulos textuais (apenas hierarquia tipográfica).
- Botões, links, ações e atalhos permanecem onde estão — só mudam de aparência.
- Funciona com qualquer cor escolhida no `PageBgCustomizer` (paleta derivada já existente).

Posso aplicar tudo de uma vez ou em fases (1. KPIs+header, 2. Tabela+badges, 3. Filtros+alertas, 4. Replicar nas telas irmãs). Confirma se aprova o conjunto e se prefere fase única ou incremental.
