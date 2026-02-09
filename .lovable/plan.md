
# Workflow de Aprovacao da Ficha de Custos pela Diretoria

## Visao Geral

Implementar um fluxo profissional de submissao, revisao e aprovacao da Ficha de Custos, onde:

1. O usuario da Fabrica preenche a ficha e a submete para aprovacao
2. A Diretoria (admin/supervisor) recebe, analisa e pode aprovar ou solicitar reducoes em insumos especificos
3. O sistema congela a ficha no momento da submissao (snapshot) e monitora todas as alteracoes feitas apos o envio para revisao
4. O historico completo de revisoes fica registrado para auditoria

---

## Fluxo do Processo

```text
+------------------+      +-------------------+      +-------------------+
|   RASCUNHO       | ---> | EM REVISAO        | ---> | APROVADA          |
| (usuario edita)  |      | (Diretoria avalia)|      | (pronta p/ preco) |
+------------------+      +---+---------------+      +-------------------+
                               |
                               v
                          +-------------------+
                          | REVISAO SOLICITADA|
                          | (devolvida c/     |
                          |  apontamentos)    |
                          +--------+----------+
                                   |
                                   v
                          (usuario ajusta e reenvia)
```

---

## Banco de Dados - Novas Tabelas

### 1. `fabrica_ficha_custo_revisoes` (controle de submissoes)
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| config_id | uuid FK -> fabrica_produto_custos_config | Ficha vinculada |
| produto_id | uuid FK -> fabrica_produtos | Produto |
| status | text | `pendente`, `aprovada`, `revisao_solicitada`, `cancelada` |
| snapshot_insumos | jsonb | Copia dos insumos no momento da submissao |
| snapshot_config | jsonb | Copia da configuracao no momento da submissao |
| snapshot_totais | jsonb | Totais calculados no momento da submissao |
| submetido_por | uuid | Usuario que submeteu |
| submetido_em | timestamptz | Data da submissao |
| revisado_por | uuid | Diretor que revisou |
| revisado_em | timestamptz | Data da revisao |
| parecer | text | Comentario geral da Diretoria |
| versao | integer | Numero sequencial da versao (1, 2, 3...) |
| created_at | timestamptz | |

### 2. `fabrica_ficha_custo_revisao_itens` (apontamentos por insumo)
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| revisao_id | uuid FK -> fabrica_ficha_custo_revisoes | |
| insumo_id | uuid FK -> fabrica_produto_custos | Insumo apontado |
| campo | text | `custo_nf`, `custo_servico`, `custo_condicao` |
| valor_atual | numeric | Valor no momento da submissao |
| valor_sugerido | numeric | Valor que a Diretoria sugere |
| comentario | text | Justificativa da reducao |
| atendido | boolean | Se o usuario acatou a sugestao |

### 3. Coluna adicional em `fabrica_produto_custos_config`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| status_aprovacao | text | `rascunho`, `em_revisao`, `aprovada`, `revisao_solicitada` (default: `rascunho`) |
| revisao_ativa_id | uuid | ID da revisao em andamento (nullable) |

---

## Interface do Usuario (Fabrica)

### No Editor da Ficha (`FichaCustoProdutoEditor`)
- **Banner de status** no topo da ficha, com cores por estado:
  - Rascunho (cinza) - editavel normalmente
  - Em Revisao (amarelo/ambar) - campos bloqueados, aguardando Diretoria
  - Revisao Solicitada (laranja) - mostra apontamentos da Diretoria com destaque nos insumos que precisam de ajuste
  - Aprovada (verde) - campos bloqueados, pronta para gerar precos
- **Botao "Submeter para Aprovacao"** no lugar/ao lado do botao Salvar (visivel apenas quando status = rascunho ou revisao_solicitada)
- **Painel de apontamentos** lateral ou abaixo da tabela quando ha revisao solicitada, mostrando cada item apontado com valor atual vs. sugerido

### Na lista de Produtos Acabados
- A coluna "Ficha" passa a mostrar o status detalhado: Rascunho, Em Revisao, Aprovada, Revisao Solicitada (badges coloridos)

---

## Interface da Diretoria

### Nova pagina/dialog: "Revisao de Fichas de Custos"
- Lista de fichas pendentes de revisao (status = `pendente`)
- Ao abrir uma ficha:
  - Visualizacao completa da ficha (somente leitura)
  - Para cada insumo, a Diretoria pode clicar e adicionar um apontamento com valor sugerido + comentario
  - Campo de parecer geral
  - Botoes: **Aprovar** ou **Solicitar Revisao**
- Comparacao lado a lado quando for uma resubmissao (versao anterior vs. atual), destacando o que mudou

---

## Seguranca (RLS)

- **fabrica_ficha_custo_revisoes**: Usuarios da fabrica podem ver/criar revisoes dos seus produtos; admins/supervisors podem ver todas e atualizar status
- **fabrica_ficha_custo_revisao_itens**: Admins/supervisors podem inserir apontamentos; usuarios da fabrica podem visualizar
- Somente admins/supervisors podem alterar o `status_aprovacao` na config

---

## Notificacoes

- Ao submeter para aprovacao: notificacao para admins/supervisors
- Ao aprovar ou solicitar revisao: notificacao para o usuario que submeteu

---

## Resumo dos Arquivos Impactados

| Arquivo | Alteracao |
|---------|-----------|
| Migration SQL | Criar tabelas `fabrica_ficha_custo_revisoes` e `fabrica_ficha_custo_revisao_itens`, adicionar colunas na config, RLS |
| `useFichaCustoProduto.ts` | Adicionar logica de submissao, carregar status e revisao ativa |
| `FichaCustoProdutoEditor.tsx` | Banner de status, bloqueio de campos, botao submeter, painel de apontamentos |
| `FabricaProdutosAcabados.tsx` | Atualizar coluna Ficha para mostrar status detalhado |
| Novo: `FichaRevisaoDiretoria.tsx` | Pagina de revisao para a Diretoria |
| Novo: `useFichaRevisao.ts` | Hook para gerenciar revisoes |
| Routing | Nova rota para a tela de revisao da Diretoria |
