

## Fundo Preto na Tabela com Contraste Automático

### O que será feito

Adicionar **preto (#1A1A2E ou #111111)** como opção de cor no seletor de cores do projeto. Quando o fundo for escuro, todo o texto da tabela (cabeçalhos, nomes, datas, badges, seções) mudará automaticamente para branco/claro, com cores de badges adaptadas para dark background.

### Lógica de detecção

Criar uma função utilitária `isDarkColor(hex)` que calcula a luminância relativa da cor. Se luminância < 0.5, considera "dark" e aplica texto claro. Isso funciona para preto e qualquer outra cor escura que o usuário digite via hex.

### Mudanças

#### 1. `ProjetoBgColorPicker.tsx`
- Adicionar cores escuras ao `PRESET_COLORS`: `#111111`, `#1A1A2E`, `#1E293B`, `#1C1917`
- Ajustar o ícone de check para usar `text-white` em cores escuras

#### 2. `ProjetoDetalhe.tsx`
- Criar função `isDarkColor(hex)` para detectar fundo escuro
- Passar nova prop `darkBg` (boolean) além de `customBg` para `ProjetoListView` e `ProjetoHeader`
- Ajustar textos do botão Voltar: `text-white` quando `darkBg`

#### 3. `ProjetoHeader.tsx`
- Receber prop `darkBg`
- Quando `darkBg`: usar `text-white` em títulos, tabs, botões (em vez de `text-black`)

#### 4. `ProjetoListView.tsx`
- Receber prop `darkBg`
- Quando `darkBg`: cabeçalhos da tabela em `text-white/70`, fundo do card em `bg-black/20`, bordas em `border-white/20`
- Propagar `darkBg` para `ProjetoSecao`

#### 5. `ProjetoSecao.tsx`
- Receber prop `darkBg`
- Quando `darkBg`: nome da seção em `text-white`, contador em `text-white/60`
- Propagar para `ProjetoTarefaRow`

#### 6. `ProjetoTarefaRow.tsx`
- Receber prop `darkBg`
- Quando `darkBg`:
  - Título da tarefa: `text-white`
  - Código, datas, criador: `text-white/60`
  - Badges de status: manter cores vibrantes mas com texto claro (`text-pink-300`, `text-amber-300`, etc.)
  - Bordas: `border-white/10`
  - Hover: `hover:bg-white/5`

#### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/projetos/ProjetoBgColorPicker.tsx` |
| Editar | `src/pages/ProjetoDetalhe.tsx` |
| Editar | `src/components/projetos/ProjetoHeader.tsx` |
| Editar | `src/components/projetos/ProjetoListView.tsx` |
| Editar | `src/components/projetos/ProjetoSecao.tsx` |
| Editar | `src/components/projetos/ProjetoTarefaRow.tsx` |

