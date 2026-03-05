

## Personalização de Cor de Fundo do Módulo Projetos

### O que será feito

Adicionar um seletor de cor acima do header do projeto (entre o botão "Voltar" e o título) que permite ao usuário escolher uma cor de fundo para a área do módulo. As escritas se ajustarão automaticamente para preto, garantindo contraste.

### Implementação

#### 1. Persistência — campo `bg_cor` na tabela `projetos`

Adicionar coluna `bg_cor` (text, nullable, default null) à tabela `projetos` para salvar a preferência de cor de fundo por projeto.

#### 2. Atualizar interface `Projeto`

O tipo será atualizado automaticamente via types.ts após a migração.

#### 3. Editar `ProjetoDetalhe.tsx`

- Aplicar `style={{ backgroundColor: projeto.bg_cor }}` no container principal (`<main>`)
- Quando `bg_cor` está definida, todas as classes de texto mudam para `text-black` (títulos, labels, tabs, badges)
- Adicionar um pequeno botão de paleta de cores ao lado do botão "Voltar", com um popover contendo:
  - Grade de cores predefinidas (branco, cinza claro, amarelo claro, rosa claro, verde claro, azul claro, lilás, etc.)
  - Input hex para cor customizada
  - Botão "Remover" para voltar ao padrão
- Ao selecionar, faz `update` no campo `bg_cor` do projeto

#### 4. Editar `ProjetoHeader.tsx`

- Receber prop `customBg` (boolean) para saber se há cor de fundo customizada
- Quando `customBg = true`, aplicar `text-black` nos textos do header (título, descrição, tabs, botões) em vez das classes padrão do tema

#### 5. Componente `ProjetoBgColorPicker.tsx`

Novo componente com:
- Botão com ícone `Palette` que abre um `Popover`
- Grade de ~12 cores pastel predefinidas
- Input para cor hex customizada
- Preview da cor selecionada
- Callback `onColorChange(cor: string | null)`

#### Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | Adicionar coluna `bg_cor` em `projetos` |
| Criar | `src/components/projetos/ProjetoBgColorPicker.tsx` |
| Editar | `src/pages/ProjetoDetalhe.tsx` |
| Editar | `src/components/projetos/ProjetoHeader.tsx` |

