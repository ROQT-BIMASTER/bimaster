

## Plano: Módulo de Aprovação de Cadastro (estilo Revisão da Fábrica)

### O que será construído

Uma nova **página dedicada** de aprovação de tarefas finalizadas, com layout de 3 painéis inspirado na `FichaRevisaoDiretoria` e na imagem de referência:

```text
┌──────────────┬──────────────────────────────┬──────────────────┐
│  TAREFAS     │  DADOS TÉCNICOS DO PRODUTO   │  PARECER /       │
│  PENDENTES   │  + Documentos do Cofre        │  OBSERVAÇÕES     │
│              │                              │  (chat)          │
│  • Tarefa 1  │  Nome comercial, SKU         │                  │
│    AGUARDANDO│  Processo ANVISA, Fabricante  │  Comentários de  │
│  • Tarefa 2  │  Composição INCI             │  revisão         │
│              │  Selos validados             │                  │
│              │                              │                  │
│              │  [Aprovar] [Solicitar Correção]│                 │
└──────────────┴──────────────────────────────┴──────────────────┘
```

### Implementação

**1. Nova página `src/pages/ProjetoAprovacaoCadastro.tsx`**
- Layout 3 colunas (similar a `FichaRevisaoDiretoria`)
- **Coluna esquerda**: Lista de tarefas com `validacao_status = 'pendente_validacao'`, com busca e filtro por projeto. Badge "AGUARDANDO" em laranja
- **Coluna central**: Ao selecionar uma tarefa, exibe:
  - Dados técnicos do produto vinculado (`fabrica_produtos`): nome_comercial, sku, processo_anvisa, fabricante, composição (descricao_completa), categoria, marca, linha
  - Documentos do Cofre agrupados por categoria (reutiliza query de `fabrica_revisao_documentos` filtrado por `origem_projeto_tarefa_id`)
  - Botões "Aprovar Cadastro" (verde) e "Solicitar Correção" (vermelho)
- **Coluna direita**: Chat/Parecer — reutiliza os comentários da tarefa (`projeto_tarefa_comentarios`) como canal de parecer técnico/regulatório

**2. Rota e navegação**
- Registrar rota `/dashboard/projetos/aprovacoes` no `App.tsx`
- Adicionar link no sidebar ou no `ProjetoHeader` como nova tab "Aprovações"

**3. Lógica de aprovação/rejeição**
- Reutiliza a mesma lógica do `AprovacaoPanel` existente (`ValidacaoFinalDialog.tsx`)
- Aprovar: `validacao_status → 'validada'`, `visivel_fabrica → true`
- Solicitar correção: `validacao_status → 'rejeitada'`, com observação obrigatória

**4. Atualizar `ProjetoHeader.tsx`**
- Adicionar tab "Aprovações" com badge de contagem de pendentes

### Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/pages/ProjetoAprovacaoCadastro.tsx` |
| Editar | `src/App.tsx` (nova rota) |
| Editar | `src/components/projetos/ProjetoHeader.tsx` (tab Aprovações) |

