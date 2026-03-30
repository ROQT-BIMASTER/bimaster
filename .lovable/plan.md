

# Cadastro Inteligente de Cliente via CNPJ no Seletor de Lojas

## Contexto Atual

O sistema ja possui:
- `NovaLojaDialog` com campo CNPJ + botao `CnpjSearchButton` para consulta na Receita Federal
- Verificacao de duplicidade por CNPJ e nome normalizado
- Edge function `opencnpj-consulta` com cache de 30 dias
- `MaterialOrderSheet` com seletor de loja (Popover/Combobox) sem opcao de cadastro rapido

O que falta: um fluxo CNPJ-first no `MaterialOrderSheet` (e potencialmente em outros seletores) onde o usuario digita o CNPJ e o sistema faz tudo automaticamente, incluindo deteccao de duplicatas com opcao de vincular.

## Solucao

### 1. Botao "+ Cadastrar novo cliente via CNPJ" no seletor de lojas

No `MaterialOrderSheet`, dentro do Popover de selecao de loja, adicionar um botao fixo no rodape da lista que abre um novo dialog/sheet de cadastro rapido via CNPJ.

### 2. Novo componente `CadastroClienteCnpjDialog`

Dialog dedicado com fluxo em etapas:

**Etapa 1 — Informar CNPJ**
- Campo unico para digitar o CNPJ (com mascara)
- Botao "Consultar" que chama `opencnpj-consulta`
- Validacao de formato antes de consultar

**Etapa 2 — Verificacao de Duplicidade**
- Se CNPJ ja existe na tabela `stores`:
  - Exibir card com dados do cliente existente
  - Botao "Vincular a voce" que insere registro em `store_sellers` associando o usuario atual
  - Opcao de cancelar
- Se CNPJ nao existe: seguir para etapa 3

**Etapa 3 — Preenchimento Automatico + Revisao**
- Campos pre-preenchidos com dados da Receita: razao social, nome fantasia, endereco, cidade, UF, telefone, email, CNAE, situacao cadastral, porte, regime tributario
- Todos os campos editaveis para ajuste manual
- Card informativo com dados da Receita (situacao, porte, regime) como ja existe no `NovaLojaDialog`

**Etapa 4 — Confirmacao e Cadastro**
- Criar registro em `stores` com `created_by = user.id`
- Inserir em `store_sellers` vinculando o usuario como vendedor principal
- Registrar log de auditoria com: usuario, data/hora, origem ("receita_federal"), CNPJ consultado
- Retornar o novo `store.id` para selecao automatica no seletor

### 3. Vinculacao automatica

- O cliente cadastrado sera automaticamente vinculado ao usuario logado via `store_sellers`
- O `supervisor_id` sera herdado do perfil do vendedor (logica ja existente no `NovaLojaDialog`)
- Respeitar contexto multi-empresa (`EmpresaContext`)

### 4. Audit log

Registrar em `audit_logs`:
- `action`: "cadastro_cliente_cnpj"
- `metadata`: usuario_id, cnpj, origem (manual/receita), store_id criado, dados preenchidos
- Para vinculacao de cliente existente: `action`: "vinculacao_cliente_existente"

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/components/trade/CadastroClienteCnpjDialog.tsx` | Novo — dialog de cadastro CNPJ-first com etapas |
| `src/components/trade/MaterialOrderSheet.tsx` | Adicionar botao "+ Cadastrar via CNPJ" no rodape do Popover de lojas |

## Detalhes Tecnicos

```text
Fluxo:
  CNPJ digitado → opencnpj-consulta → 
    → stores.select(cnpj = X) →
      → existe? → mostrar card + botao "Vincular" → store_sellers.insert
      → nao existe? → preencher form → stores.insert + store_sellers.insert + audit_logs.insert
```

Reutiliza: `CnpjSearchButton` (logica interna), `opencnpj-consulta` (edge function), validacao Zod existente do `NovaLojaDialog`, `store_sellers` para vinculacao.

