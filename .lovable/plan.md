

# Iniciar Análise de Embalagem a partir de Submissões Vinculadas

## Resumo

O diálogo "Nova Análise" atualmente pede preenchimento manual de SKU, produto e submissão ID. O objetivo é permitir que o usuário selecione diretamente uma submissão já vinculada na tela "Vincular China", auto-preenchendo os campos e associando os documentos do processo.

## Alterações

### 1. `NewAnaliseDialog` — Seletor de submissões vinculadas

- Adicionar uma aba/seção **"Importar do Vincular China"** no topo do diálogo
- Buscar submissões vinculadas via `china_submissao_tarefa_vinculos` → `china_produto_submissoes` (mesmo padrão usado no Recebimento de Amostra)
- Listar como cards clicáveis com código, nome e status
- Ao selecionar, auto-preencher `submissao_id`, `sku` (produto_codigo), `produto_nome`
- Manter opção de preenchimento manual como fallback

### 2. `NewAnaliseDialog` — Preview de documentos vinculados

- Após selecionar submissão, carregar documentos via `china_produto_documentos` filtrados por `submissao_id`
- Exibir lista resumida dos docs disponíveis (tipo + nome) como informação
- Esses documentos ficarão acessíveis na aba "Processo" após criar a análise

### 3. Filtro na listagem principal

- Assim como no Recebimento de Amostra, filtrar a listagem para mostrar apenas análises cujo `submissao_id` esteja na tabela de vínculos (ou mostrar todas, com badge indicando vínculo)

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/AnaliseEmbalagem.tsx` | Refatorar `NewAnaliseDialog` com seletor de submissões vinculadas |

## Fluxo

```text
[+ Nova Análise] → Dialog abre
  → Lista submissões vinculadas (cards)
  → Usuário clica em uma → campos preenchidos automaticamente
  → Docs do processo exibidos como preview
  → [Criar Análise] → análise criada com submissao_id correto
```

