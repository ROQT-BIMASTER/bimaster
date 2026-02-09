

## Caixa de Comunicacao com Historico entre Usuario e Diretoria

### Objetivo

Adicionar um painel de comunicacao (chat) na Ficha de Custos, vinculado a revisao ativa, onde o usuario responsavel e a Diretoria podem trocar mensagens com historico completo. Isso permite que o usuario justifique a manutencao de valores reprovados e que a Diretoria responda, tudo registrado com data, hora e nome do remetente.

---

### 1. Nova tabela no banco de dados

**Tabela:** `fabrica_revisao_mensagens`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | PK |
| revisao_id | uuid | FK para fabrica_ficha_custo_revisoes |
| usuario_id | uuid | Quem enviou |
| usuario_nome | text | Nome do remetente |
| conteudo | text | Texto da mensagem |
| tipo | text | "usuario" ou "diretoria" |
| insumo_id | uuid (nullable) | Referencia a um insumo especifico, se aplicavel |
| created_at | timestamptz | |

- RLS: usuarios autenticados podem SELECT e INSERT
- Indice em `revisao_id`
- Realtime habilitado para atualizacoes em tempo real

### 2. Novo componente de chat

**Novo arquivo:** `src/components/fabrica/RevisaoChatPanel.tsx`

- Card com titulo "Comunicacao - Revisao" e icone de mensagem
- Area de scroll com historico de mensagens (bolhas estilo chat)
  - Mensagens do usuario alinhadas a direita (azul)
  - Mensagens da diretoria alinhadas a esquerda (cinza)
  - Cada mensagem mostra: nome, data/hora, conteudo
  - Se a mensagem referencia um insumo, exibe o nome do insumo como badge
- Campo de texto na parte inferior para digitar nova mensagem
- Dropdown opcional para selecionar um insumo ao qual a mensagem se refere (para contextualizar a justificativa)
- Botao de enviar
- Subscription em tempo real para novas mensagens

### 3. Integracao na Ficha de Custos

**Arquivo:** `src/components/fabrica/FichaCustoProdutoEditor.tsx`

- Exibir o `RevisaoChatPanel` quando houver revisao ativa (status `revisao_solicitada` ou `em_revisao`)
- Posicionar logo abaixo do banner de apontamentos, antes da tabela de insumos
- Passar `revisao_id` e lista de insumos como props

### 4. Integracao na tela da Diretoria

**Arquivo que gerencia a revisao da diretoria** (tela de revisao de fichas)

- Exibir o mesmo `RevisaoChatPanel` na tela de revisao da Diretoria
- Permitir que o revisor tambem envie mensagens
- As mensagens da diretoria aparecem com tipo "diretoria"

### 5. Fluxo do usuario

1. Diretoria solicita revisao com apontamentos
2. Usuario abre a ficha e ve os apontamentos em vermelho
3. Abaixo dos apontamentos, aparece a caixa de comunicacao com todo o historico
4. Usuario pode:
   - Digitar uma justificativa explicando por que deseja manter os valores
   - Selecionar o insumo especifico para contextualizar
   - Enviar a mensagem
5. Diretoria ve a mensagem na tela de revisao e pode responder
6. Todo o historico fica registrado e visivel para ambas as partes
7. Ao submeter novamente, as mensagens continuam vinculadas a revisao

---

### Detalhes tecnicos

**Arquivos a criar:**
- `src/components/fabrica/RevisaoChatPanel.tsx` - Componente de chat com historico

**Arquivos a modificar:**
- `src/components/fabrica/FichaCustoProdutoEditor.tsx` - Integrar o painel de chat
- `src/pages/FichaCustoProduto.tsx` - Passar revisao_id como prop

**Migration SQL:**
- Tabela `fabrica_revisao_mensagens`
- RLS (SELECT e INSERT para autenticados)
- Indice em revisao_id
- Habilitar realtime na tabela

