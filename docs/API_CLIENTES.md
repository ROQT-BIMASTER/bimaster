# API Clientes — CRUD Completo (Padrão Omie)

Edge Function: `clientes-api`  
Padrão: Omie `IncluirCliente`, `AlterarCliente`, `ConsultarCliente`, `ExcluirCliente`, `ListarClientes`, `ListarClientesResumido`, `UpsertCliente`, `UpsertClienteCpfCnpj`, `AssociarCodIntCliente`

## Endpoints

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| POST | `/incluir` | IncluirCliente | Inclui cliente |
| POST | `/alterar` | AlterarCliente | Altera cliente |
| POST | `/consultar` | ConsultarCliente | Consulta por código |
| POST | `/excluir` | ExcluirCliente | Exclui (inativa) cliente |
| POST | `/listar` | ListarClientes | Lista completa paginada |
| POST | `/listar-resumido` | ListarClientesResumido | Lista resumida paginada |
| POST | `/upsert` | UpsertCliente | Inclui ou altera |
| POST | `/upsert-cpfcnpj` | UpsertClienteCpfCnpj | Upsert por CPF/CNPJ |
| POST | `/associar` | AssociarCodIntCliente | Associa código integração |
| GET | `/status` | — | Health check |

## Autenticação

Header `x-api-key` obrigatório (exceto `/status`).

## POST /incluir

**Body (campos obrigatórios marcados com *):**
```json
{
  "codigo_cliente_integracao": "CLI001", // *
  "razao_social": "Empresa ABC Ltda",   // *
  "nome_fantasia": "ABC",
  "cnpj_cpf": "12.345.678/0001-90",
  "email": "contato@abc.com",
  "telefone1_numero": "11999998888",
  "endereco": "Rua das Flores, 100",
  "bairro": "Centro",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01000-000"
}
```

**Resposta (201):**
```json
{
  "codigo_cliente_omie": "uuid",
  "codigo_cliente_integracao": "CLI001",
  "codigo_status": "0",
  "descricao_status": "Cliente incluído com sucesso!"
}
```

## POST /consultar

**Body:**
```json
{ "codigo_cliente_integracao": "CLI001" }
```
ou
```json
{ "codigo_cliente_omie": "uuid" }
```

**Resposta (200):** retorna `clientes_cadastro` com todos os campos mapeados.

## POST /listar

**Body:**
```json
{
  "pagina": 1,
  "registros_por_pagina": 50,
  "clientesFiltro": {
    "razao_social": "ABC",
    "estado": "SP",
    "inativo": "N"
  }
}
```

**Resposta (200):**
```json
{
  "pagina": 1,
  "total_de_paginas": 3,
  "registros": 50,
  "total_de_registros": 125,
  "clientes_cadastro": [...]
}
```

## POST /listar-resumido

Mesmos parâmetros de `/listar`. Retorna apenas: `codigo_cliente`, `codigo_cliente_integracao`, `razao_social`, `nome_fantasia`, `cnpj_cpf`.

## Mapeamento de Campos

| Campo Omie | Coluna DB |
|---|---|
| `codigo_cliente_omie` | `id` |
| `codigo_cliente_integracao` | `codigo` |
| `razao_social` | `nome` |
| `nome_fantasia` | `nome_abreviado` |
| `cnpj_cpf` | `cnpj` |
| `email` | `email` |
| `telefone1_numero` | `telefone` |
| `contato` | `comprador` |
| `endereco` | `endereco` |
| `bairro` | `bairro` |
| `cidade` | `cidade` |
| `estado` | `uf` |
| `cep` | `cep` |
| `inscricao_estadual` | `inscricao_estadual` |
| `observacao` | `observacoes` |
| `valor_limite_credito` | `limite_credito` |
| `inativo` | `status_bloqueio` → S/N |

## Erros

| Código | Descrição |
|---|---|
| 400 | Campos obrigatórios ausentes |
| 401 | API key inválida |
| 404 | Cliente não encontrado |
| 409 | Cliente duplicado (incluir) |
| 500 | Erro interno |

---

## Características de Clientes

Endpoints para gerenciar características (key-value) de clientes, equivalente ao módulo `CaracteristicasCliente` da Omie.

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| POST | `/caract/incluir` | IncluirCaractCliente | Inclui característica |
| POST | `/caract/alterar` | AlterarCaractCliente | Altera conteúdo |
| POST | `/caract/consultar` | ConsultarCaractCliente | Lista todas do cliente |
| POST | `/caract/excluir` | ExcluirCaractCliente | Exclui uma característica |
| POST | `/caract/excluir-todas` | ExcluirTodasCaractCliente | Exclui todas |

### POST /caract/incluir

**Body:**
```json
{
  "codigo_cliente_integracao": "CLI001",
  "campo": "SEGMENTO",
  "conteudo": "Varejo"
}
```

**Resposta (201):**
```json
{
  "codigo_cliente_omie": "uuid",
  "codigo_cliente_integracao": "CLI001",
  "codigo_status": "0",
  "descricao_status": "Característica incluída com sucesso!"
}
```

### POST /caract/consultar

**Body:**
```json
{ "codigo_cliente_integracao": "CLI001" }
```

**Resposta (200):**
```json
{
  "codigo_cliente_omie": "uuid",
  "codigo_cliente_integracao": "CLI001",
  "caracteristicas": [
    { "campo": "SEGMENTO", "conteudo": "Varejo" },
    { "campo": "REGIAO", "conteudo": "Sul" }
  ]
}
```

### POST /caract/excluir

**Body:**
```json
{
  "codigo_cliente_integracao": "CLI001",
  "campo": "SEGMENTO"
}
```

### POST /caract/excluir-todas

**Body:**
```json
{ "codigo_cliente_integracao": "CLI001" }
```

Todas as rotas aceitam `codigo_cliente_omie` (UUID) ou `codigo_cliente_integracao` para identificar o cliente.
