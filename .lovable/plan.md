
# Segregação Configurável de Fornecedores por Módulo — Concluído

## O que foi feito

### 1. Tabela de configuração `fornecedor_modulo_config`
- Criada com mapeamento modulo → tabela: fabrica→fabrica_fornecedores, contas_pagar/trade/eventos→fornecedores
- RLS habilitado com leitura para autenticados

### 2. Página FabricaFornecedores (`/dashboard/fabrica/fornecedores`)
- CRUD completo em `fabrica_fornecedores`
- CnpjSearchButton integrado (consulta Receita Federal)
- Painel de detalhes expansível (endereço, bancário, fiscal)
- Filtros por status (ativo/inativo) e busca por razão social/CNPJ
- Formulário com 3 abas: Dados Básicos, Endereço, Dados Bancários

### 3. FabricaFornecedorQuickAdd
- Componente de cadastro rápido específico para `fabrica_fornecedores`
- Upsert por CNPJ (atualiza se já existir)
- CnpjSearchButton integrado

### 4. Banners de segregação
- Página Fornecedores (AP): banner azul com link para Fábrica → Fornecedores
- Página FabricaFornecedores: banner âmbar com link para Cadastros → Fornecedores

### 5. Rota e navegação
- Rota `/dashboard/fabrica/fornecedores` com screenCode `fabrica_fornecedores`
- Card "Fornecedores" adicionado ao hub da Fábrica (Cadastros Básicos)
- Smart redirect inclui `fabrica_fornecedores`

### Separação mantida
- **`fornecedores`** → Contas a Pagar, Trade, Eventos, Departamentos
- **`fabrica_fornecedores`** → Fábrica (matérias-primas, recebimentos, NF-e)
- FKs existentes intactas em ambas as tabelas
