

# Bloqueio de Visualizacao de Linha/Produto nas Tabelas de Preco

## Contexto

Durante a validacao de precos, o administrador precisa poder bloquear a visualizacao de uma linha inteira ou de um produto especifico para todos os usuarios nao-administradores, em todas as tabelas de preco simultaneamente. Para o admin, tudo continua visivel normalmente.

## O Que Sera Feito

### 1. Nova tabela no banco de dados: `fabrica_produto_visibility_blocks`

Armazenara os bloqueios ativos:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| tipo | text ('linha' ou 'produto') | Tipo do bloqueio |
| linha | text, nullable | Nome da linha bloqueada |
| produto_id | uuid, nullable, FK | Produto individual bloqueado |
| motivo | text, nullable | Motivo opcional do bloqueio |
| blocked_by | uuid | Admin que bloqueou |
| created_at | timestamp | Data do bloqueio |

Constraint unique em `(tipo, linha, produto_id)` para evitar duplicatas. RLS para acesso apenas de admins na escrita e leitura para autenticados.

### 2. Atualizar o Hook `useUserPriceTableAccess`

- Buscar todos os bloqueios ativos da tabela `fabrica_produto_visibility_blocks`
- Adicionar funcao `isProductBlocked(linha, produtoId)` que verifica se o produto ou sua linha esta bloqueado
- Atualizar `filterProductsByAccess` para, alem das regras de acesso granular, tambem remover produtos/linhas bloqueados para usuarios nao-admin
- Para admins (`hasFullAccess`), os bloqueios nao se aplicam -- tudo continua visivel

### 3. Adicionar botao de bloqueio no `GeradorPrecosDialog`

Na lista de produtos (onde o admin ve os precos calculados por linha), adicionar um icone de cadeado ao lado de cada produto e um botao para bloquear a linha inteira:
- Icone de cadeado vermelho ao lado do produto/linha para bloquear
- Icone de cadeado aberto verde para desbloquear
- Indicador visual (badge vermelha "Bloqueado") nos itens bloqueados
- O bloqueio afeta todas as tabelas, nao apenas a tabela atual

### 4. Adicionar botao de bloqueio no `EditarPrecosProdutoDialog`

No dialog de edicao de precos de um produto individual, exibir:
- Badge de status "Bloqueado" se o produto ou sua linha estiver bloqueado
- Botao para bloquear/desbloquear aquele produto especifico

### 5. Painel de bloqueios no `GerenciamentoAcessoPrecos`

Adicionar uma nova secao/aba "Bloqueios Ativos" na pagina de controle de acesso para:
- Listar todos os bloqueios ativos (linhas e produtos)
- Permitir desbloquear diretamente da lista
- Mostrar quem bloqueou e quando

## Fluxo de Uso

```text
Admin abre Gerador de Precos
  -> Ve lista de produtos por linha
  -> Clica no cadeado ao lado de "Linha Banana"
  -> Confirma o bloqueio
  -> Todos os produtos da linha Banana ficam invisiveis
     para usuarios nao-admin em TODAS as tabelas
  -> Admin continua vendo normalmente com badge "Bloqueado"
```

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Criar tabela `fabrica_produto_visibility_blocks` com RLS |
| `src/hooks/useUserPriceTableAccess.ts` | Buscar bloqueios e integrar na filtragem com `isProductBlocked()` |
| `src/components/fabrica/GeradorPrecosDialog.tsx` | Adicionar icones de bloqueio por produto e por linha |
| `src/components/fabrica/EditarPrecosProdutoDialog.tsx` | Exibir status de bloqueio e botao de acao |
| `src/pages/GerenciamentoAcessoPrecos.tsx` | Adicionar secao "Bloqueios Ativos" com listagem e gestao |

## Compatibilidade

- Sem bloqueios cadastrados, o sistema funciona exatamente como hoje
- Administradores e supervisores veem tudo, incluindo itens bloqueados (com indicador visual)
- O bloqueio e global (todas as tabelas) -- nao por tabela individual
- Pode ser combinado com as regras granulares de acesso (linha/produto) ja existentes

