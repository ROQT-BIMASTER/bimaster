# API Empresas — API Huggs

Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/empresas-api`

## Autenticação

Header `x-api-key` obrigatório em todas as rotas (exceto `/status`).

## Rotas

| Método | Rota | Equivalente Huggs | Descrição |
|---|---|---|---|
| POST | `/incluir` | IncluirEmpresa | Cadastra nova empresa |
| POST | `/alterar` | AlterarEmpresa | Altera dados de empresa |
| POST | `/consultar` | ConsultarEmpresa | Consulta por código |
| POST | `/listar` | ListarEmpresas | Lista paginada |
| GET | `/status` | — | Health check |

---

## GET /status

Health check. Retorna rotas disponíveis.

---

## POST /incluir

Cadastra uma nova empresa no sistema.

**Request (campos obrigatórios marcados com *):**
```json
{
  "razao_social": "Empresa ABC Ltda",        // *
  "nome_fantasia": "ABC",
  "cnpj": "12.345.678/0001-90",
  "codigo_empresa_integracao": "EMP001",
  "codigo_erp": "12345",
  "regime_apuracao": "Competência",
  "tipo_empresa": "Matriz",
  "natureza_juridica": "Ltda",
  "porte": "EPP",
  "capital_social": 100000.00,
  "data_abertura": "2020-01-15",
  "codigo_ibge_municipio": 3550308,
  "responsavel_nome": "João Silva",
  "responsavel_cpf": "123.456.789-00",
  "inscricao_estadual": "123456789",
  "inscricao_municipal": "987654",
  "regime_tributario": "Lucro Presumido",
  "endereco": "Rua das Flores",
  "endereco_numero": "100",
  "complemento": "Sala 201",
  "bairro": "Centro",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01000-000",
  "email": "contato@abc.com",
  "telefone1_ddd": "11",
  "telefone1_numero": "999998888"
}
```

**Response (201):**
```json
{
  "codigo_empresa": 8,
  "codigo_empresa_integracao": "EMP001",
  "codigo_status": "0",
  "descricao_status": "Empresa incluída com sucesso!"
}
```

**Validação:** Schema Zod `.strict()` — campos não listados são rejeitados com erro 400.

---

## POST /alterar

Altera dados de uma empresa existente.

**Request:**
```json
{
  "codigo_empresa": 8,
  "razao_social": "Empresa ABC Ltda Atualizada",
  "regime_apuracao": "Caixa",
  "porte": "ME"
}
```

**Response (200):**
```json
{
  "codigo_empresa": 8,
  "codigo_empresa_integracao": "EMP001",
  "codigo_status": "0",
  "descricao_status": "Empresa alterada com sucesso!"
}
```

---

## POST /consultar

Consulta uma empresa por código.

**Request:**
```json
{ "codigo_empresa": 8 }
```

**Response (200):**
```json
{
  "empresas_cadastro": {
    "codigo_empresa": 8,
    "codigo_empresa_integracao": "EMP001",
    "codigo_erp": "12345",
    "cnpj": "12.345.678/0001-90",
    "razao_social": "Empresa ABC Ltda",
    "nome_fantasia": "ABC",
    "regime_apuracao": "Competência",
    "tipo_empresa": "Matriz",
    "natureza_juridica": "Ltda",
    "porte": "EPP",
    "capital_social": 100000.00,
    "data_abertura": "2020-01-15",
    "codigo_ibge_municipio": 3550308,
    "responsavel_nome": "João Silva",
    "responsavel_cpf": "123.456.789-00",
    "inscricao_estadual": "123456789",
    "inscricao_municipal": "987654",
    "regime_tributario": "Lucro Presumido",
    "endereco": "Rua das Flores",
    "endereco_numero": "100",
    "complemento": "Sala 201",
    "bairro": "Centro",
    "cidade": "São Paulo",
    "estado": "SP",
    "cep": "01000-000",
    "inativa": "N",
    "inclusao_data": "15/01/2026",
    "inclusao_hora": "10:30:00",
    "alteracao_data": "20/03/2026",
    "alteracao_hora": "14:15:30",
    "..."
  }
}
```

---

## POST /listar

Lista empresas com paginação.

**Request:**
```json
{
  "pagina": 1,
  "registros_por_pagina": 100
}
```

**Response (200):**
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 2,
  "total_de_registros": 2,
  "empresas_cadastro": [...]
}
```

---

## Mapeamento de Campos Completo

| Campo Huggs | Coluna DB | Tipo | Obs |
|---|---|---|---|
| `codigo_empresa` | `id` | SERIAL | PK auto-increment |
| `codigo_empresa_integracao` | `codigo_empresa_integracao` | varchar | Código externo |
| `codigo_erp` | `codigo_erp` | varchar(60) | Código no ERP origem |
| `razao_social` | `nome` | text | — |
| `nome_fantasia` | `nome_fantasia` | text | — |
| `cnpj` | `cnpj` | varchar | — |
| `inscricao_estadual` | `inscricao_estadual` | varchar | — |
| `inscricao_municipal` | `inscricao_municipal` | varchar | — |
| `inscricao_suframa` | `inscricao_suframa` | varchar | — |
| `regime_tributario` | `regime_tributario` | varchar | Lucro Real/Presumido/Simples |
| `regime_apuracao` | `regime_apuracao` | varchar(20) | "Competência" ou "Caixa" |
| `tipo_empresa` | `tipo_empresa` | varchar(20) | "Matriz", "Filial", "Coligada" |
| `natureza_juridica` | `natureza_juridica` | varchar(40) | Ltda, SA, MEI, EIRELI |
| `porte` | `porte` | varchar(20) | "ME", "EPP", "Demais" |
| `capital_social` | `capital_social` | numeric(15,2) | Valor em R$ |
| `data_abertura` | `data_abertura` | date | Data de constituição |
| `codigo_ibge_municipio` | `codigo_ibge_municipio` | integer | Código IBGE do município |
| `responsavel_nome` | `responsavel_nome` | varchar(120) | Sócio/responsável legal |
| `responsavel_cpf` | `responsavel_cpf` | varchar(14) | CPF do responsável |
| `estado` | `uf` | varchar(2) | UF |
| `endereco` | `endereco` | text | — |
| `endereco_numero` | `endereco_numero` | varchar | — |
| `complemento` | `complemento` | varchar | — |
| `bairro` | `bairro` | varchar | — |
| `cidade` | `cidade` | varchar | — |
| `cep` | `cep` | varchar | — |
| `email` | `email` | varchar | — |
| `inativa` | `ativa` invertido | boolean | `true` → `"N"` |
| `inclusao_data` | `created_at` | timestamp | Formatado dd/mm/yyyy |
| `alteracao_data` | `updated_at` | timestamp | Formatado dd/mm/yyyy |

---

## Segurança

- **Validação Zod `.strict()`** em todos os endpoints — campos desconhecidos rejeitados
- **Audit log** em todas as operações (incluir, alterar, consultar)
- **Rate limiting** 60 req/min por usuário
- **Webhooks** disparados em incluir/alterar

## Erros

| Código | Descrição |
|---|---|
| 400 | Campos inválidos ou ausentes (Zod validation) |
| 401 | API key inválida |
| 404 | Empresa não encontrada |
| 405 | Método HTTP não permitido |
| 409 | Empresa duplicada (incluir) |
| 429 | Rate limit excedido |
| 500 | Erro interno |
