

# Profissionalização da Comunicação de Revisões

## Melhorias propostas

### 1. Layout estilo mensageiro profissional (WhatsApp Business / Slack)
- Substituir o layout atual por um **split-view permanente**: lista de conversas à esquerda (30%) e painel de chat à direita (70%), sem precisar navegar entre telas
- Conversa selecionada fica destacada na lista
- Responsivo: em mobile, mantém o comportamento atual de navegação

### 2. Indicadores visuais na lista de conversas
- **Foto/avatar do produto** (iniciais coloridas por marca)
- **Preview da última mensagem** com horário relativo ("há 2h", "ontem")
- **Contagem de não lidas** como badge vermelho
- **Indicador de status** colorido (ponto verde = aberto, cinza = finalizado)
- **Ordenação inteligente**: não lidas primeiro, depois por data

### 3. Cabeçalho do chat com contexto do produto
- Ao abrir uma conversa, mostrar um **header rico** com:
  - Nome do produto, código, marca/linha
  - Matérias-primas vinculadas como chips clicáveis
  - Status da revisão com badge colorido
  - Botão rápido para abrir ficha do produto

### 4. Agrupamento de mensagens por data
- Separadores visuais "Hoje", "Ontem", "15/02/2026"
- Agrupar mensagens consecutivas do mesmo remetente (sem repetir avatar/nome)

### 5. Barra de filtros compacta e responsiva
- Substituir os 7 selects soltos por uma **barra de filtros colapsável** com chips ativos
- Filtros como badges removíveis (ex: "Marca: XYZ ✕")
- Contagem de resultados visível ("12 conversas")

### 6. Estados vazios e feedback visual
- Ilustração quando não há conversas
- Skeleton loading ao carregar lista
- Animação suave ao receber nova mensagem (highlight temporário na lista)

### 7. Notificação sonora/visual de nova mensagem
- Quando uma nova mensagem chega via realtime e o usuário está em outra conversa, destacar a conversa na lista com animação

## Alterações técnicas

### Arquivos a modificar
- **`RevisaoChatConsolidado.tsx`**: Refatorar layout para split-view, melhorar lista de conversas, adicionar agrupamento por data, filtros como chips, skeleton loading
- **`FabricaComunicacaoRevisoes.tsx`**: Ajustar container para ocupar altura total disponível
- **`RevisaoChatPanel.tsx`**: Adicionar separadores de data entre mensagens, agrupar mensagens consecutivas do mesmo remetente

### Sem alterações de banco
Todas as melhorias são puramente de frontend/UX.

