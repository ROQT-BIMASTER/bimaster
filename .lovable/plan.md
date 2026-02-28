

# Separar telas de Revisão: Diretoria vs Compras/Faturamento

## Contexto
A tela `FichaRevisaoDiretoria` hoje é acessada por todos. O objetivo é restringi-la à Diretoria e criar uma tela dedicada para Compras/Faturamento, acessível via botão na tela de Produtos Acabados.

## Alterações

### 1. Criar nova página `FabricaComunicacaoRevisoes.tsx`
Nova página que reutiliza o componente `RevisaoChatConsolidado` com `tipoRemetente="usuario"`, contendo:
- Header com botão de voltar para Produtos Acabados
- O componente de conversas consolidado já existente (com filtros por Marca, Linha, Produto, Usuário)
- Sem as abas de análise, documentos ou dashboard admin que são exclusivas da Diretoria

### 2. Registrar rota em `App.tsx`
Adicionar rota `/dashboard/fabrica/comunicacao-revisoes` protegida pelo mesmo `screenCode` de `fabrica_produtos`.

### 3. Atualizar botão em `FabricaProdutosAcabados.tsx`
- Trocar o botão "Revisões Solicitadas" (que aponta para `/revisao-fichas`) por "Comunicação de Revisões" apontando para `/comunicacao-revisoes`
- Manter o botão antigo apenas se o usuário for admin (Diretoria), ou adicionar ambos os botões condicionalmente

### 4. Atualizar sidebar (`AppSidebar.tsx`)
- Manter "Revisão de Fichas" no menu (restrito via permissão de tela `fabrica_revisao_fichas` — já existente)
- Adicionar item "Comunicação Revisões" visível para quem tem `fabrica_produtos`

### Detalhes técnicos
- A nova página é essencialmente um wrapper de `RevisaoChatConsolidado` dentro de `DashboardLayout`
- Não requer migração de banco — usa as mesmas tabelas e queries
- O controle de acesso à tela de Diretoria continua pelo `screenCode` existente (`fabrica_revisao_fichas`)

