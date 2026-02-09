
# Busca de Fornecedor/Loja + Dados Bancarios no Lancamento Trade

## Problema Atual
1. O seletor de Fornecedor usa um `Select` simples sem busca -- com muitos fornecedores fica impossivel encontrar
2. O seletor de Loja/PDV tambem nao tem busca
3. Ao selecionar um fornecedor, o sistema nao verifica nem solicita dados bancarios (banco, agencia, conta, PIX) necessarios para o financeiro processar o pagamento

## O que sera feito

### 1. Seletor de Fornecedor com busca (Combobox)
Substituir o `Select` atual por um Combobox com busca (Popover + Command), identico ao padrao ja usado em `EnviarFinanceiroDialog.tsx` de Eventos:
- Campo de busca por nome ou CNPJ
- Exibicao do CNPJ abaixo do nome
- Icone de check no item selecionado
- Botao de adicionar fornecedor rapido (`FornecedorQuickAdd`)

### 2. Seletor de Loja/PDV com busca (Combobox)
Substituir o `Select` de Loja por um Combobox com busca similar, permitindo filtrar por codigo ou nome da loja.

### 3. Verificacao de dados bancarios do fornecedor
Apos selecionar um fornecedor, o sistema consultara os campos bancarios na tabela `fabrica_fornecedores` (banco, agencia, conta, tipo_conta, pix_chave, pix_tipo, favorecido). Dois cenarios:

**a) Fornecedor COM dados bancarios:** Exibir um card resumo com os dados bancarios (banco, agencia/conta, chave PIX) em formato read-only abaixo do seletor de fornecedor.

**b) Fornecedor SEM dados bancarios:** Exibir um alerta informando que os dados bancarios nao foram cadastrados, com duas opcoes:
- **"Preencher agora"**: Expande um formulario inline para o usuario informar banco, agencia, conta, tipo de conta, chave PIX, tipo PIX e favorecido. Ao salvar, os dados sao gravados na tabela `fabrica_fornecedores`.
- **"Seguir sem dados bancarios"**: O usuario confirma que deseja prosseguir sem dados, e o lancamento e criado normalmente (o financeiro tera que solicitar depois).

### 4. Aplicar as mesmas mudancas no EditarLancamentoDialog
Garantir consistencia entre criacao e edicao.

## Detalhes Tecnicos

### Componentes reutilizados
- `Popover` + `Command` (cmdk) de `@/components/ui/command` -- ja existem no projeto
- `FornecedorQuickAdd` de `@/components/fabrica/FornecedorQuickAdd`

### Arquivos modificados
- `src/components/trade/NovoLancamentoDialog.tsx`: Substituir Select de Fornecedor por Combobox com busca; Substituir Select de Loja por Combobox com busca; Adicionar fetch de dados bancarios ao selecionar fornecedor; Adicionar card de dados bancarios ou alerta com opcao de preenchimento inline
- `src/components/trade/EditarLancamentoDialog.tsx`: Mesmas mudancas para consistencia

### Query de dados bancarios
Ao selecionar fornecedor, buscar campos adicionais: `banco, agencia, conta, tipo_conta, pix_chave, pix_tipo, favorecido` da tabela `fabrica_fornecedores`.

### Sem migracao necessaria
Os campos bancarios ja existem na tabela `fabrica_fornecedores`. Nenhuma alteracao de schema e necessaria.
