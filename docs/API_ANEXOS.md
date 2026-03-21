# API Anexos de Documentos — Padronização Omie

> **Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/anexos-api`

## Autenticação

Mesmos métodos das demais APIs:
- **API Key:** Header `x-api-key: huggs-erp-xxxxxxxx`
- **JWT:** Header `Authorization: Bearer <token>`

---

## Endpoints

### POST `/incluir` — IncluirAnexo

Inclui um anexo vinculado a um documento. O conteúdo do arquivo deve ser enviado **compactado (zip) e convertido em base64**.

**Request Body:**
```json
{
  "cCodIntAnexo": "ANX-001",
  "cTabela": "contas_receber",
  "nId": 12345,
  "cNomeArquivo": "comprovante.pdf",
  "cTipoArquivo": "pdf",
  "cArquivo": "<base64 do arquivo zipado>",
  "cMd5": "a1b2c3d4e5f6..."
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `cCodIntAnexo` | string(20) | Não | Código de integração do anexo |
| `cTabela` | string(100) | **Sim** | Tabela de origem (contas_pagar, contas_receber, etc.) |
| `nId` | integer | **Sim** | ID do documento na tabela |
| `cNomeArquivo` | string(100) | **Sim** | Nome do arquivo |
| `cTipoArquivo` | string(10) | Não | Tipo/extensão (pdf, zip, jpg, etc.) |
| `cArquivo` | text | **Sim** | Conteúdo em base64 |
| `cMd5` | string(32) | Não | MD5 do conteúdo para validação |

**Response (201):**
```json
{
  "cCodIntAnexo": "ANX-001",
  "cTabela": "contas_receber",
  "nId": 12345,
  "nIdAnexo": 0,
  "cNomeArquivo": "comprovante.pdf",
  "cCodStatus": "0",
  "cDesStatus": "Anexo incluído com sucesso!"
}
```

---

### GET `/consultar` — ConsultarAnexo

Consulta metadados de um anexo.

**Query Params:** `cCodIntAnexo`, `cTabela`, `nId`, `nIdAnexo`, `cNomeArquivo`

**Response (200):**
```json
{
  "cCodIntAnexo": "ANX-001",
  "cTabela": "contas_receber",
  "nId": 12345,
  "nIdAnexo": 0,
  "cNomeArquivo": "comprovante.pdf",
  "cTipoArquivo": "pdf",
  "info": {
    "dInc": "21/03/2026",
    "dAlt": "21/03/2026",
    "cImpAPI": "S"
  }
}
```

---

### GET `/obter` — ObterAnexo

Obtém link de download temporário (signed URL, expiração 1h).

**Query Params:** `cCodIntAnexo`, `cTabela`, `nId`, `nIdAnexo`, `cNomeArquivo`

**Response (200):**
```json
{
  "cCodIntAnexo": "ANX-001",
  "cTabela": "contas_receber",
  "nId": 12345,
  "nIdAnexo": 0,
  "cNomeArquivo": "comprovante.pdf",
  "cLinkDownload": "https://...",
  "dDtExpiracao": "21/03/2026",
  "cCodStatus": "0",
  "cDesStatus": "Link gerado com sucesso!"
}
```

---

### GET `/listar` — ListarAnexo

Lista anexos de um documento com paginação.

**Query Params:**

| Param | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nPagina` | integer | Não | Página (default: 1) |
| `nRegPorPagina` | integer | Não | Registros por página (default: 50, máx: 200) |
| `nId` | integer | **Sim** | ID do documento |
| `cTabela` | string | **Sim** | Nome da tabela |
| `dDtIncDe` | date | Não | Filtro data inclusão inicial |
| `dDtIncAte` | date | Não | Filtro data inclusão final |

**Response (200):**
```json
{
  "nPagina": 1,
  "nTotPaginas": 1,
  "nRegistros": 2,
  "nTotRegistros": 2,
  "listaAnexos": [
    {
      "cCodIntAnexo": "ANX-001",
      "cTipoArquivo": "pdf",
      "nId": 12345,
      "nIdAnexo": 0,
      "cNomeArquivo": "comprovante.pdf",
      "cTabela": "contas_receber",
      "info": { "dInc": "21/03/2026", "dAlt": "21/03/2026", "cImpAPI": "S" }
    }
  ]
}
```

---

### DELETE `/excluir` — ExcluirAnexo

Exclui um anexo (metadados + arquivo no storage).

**Request Body:**
```json
{
  "cCodIntAnexo": "ANX-001",
  "cTabela": "contas_receber",
  "nId": 12345
}
```

**Response (200):**
```json
{
  "cCodIntAnexo": "ANX-001",
  "cTabela": "contas_receber",
  "nId": 12345,
  "nIdAnexo": 0,
  "cNomeArquivo": "",
  "cCodStatus": "0",
  "cDesStatus": "Anexo excluído com sucesso!"
}
```

---

### GET `/status` — Health Check

```json
{
  "status": "online",
  "service": "anexos-api",
  "version": "1.0.0",
  "endpoints": ["/incluir", "/consultar", "/obter", "/listar", "/excluir", "/status"]
}
```

---

## Tabelas suportadas em `cTabela`

| Valor | Descrição |
|---|---|
| `contas_pagar` | Contas a Pagar |
| `contas_receber` | Contas a Receber |
| `pedido_venda` | Pedidos de Venda |
| `ordem_servico` | Ordens de Serviço |
| `nfe` | Notas Fiscais Eletrônicas |

> Qualquer string é aceita — a API é genérica. Os valores acima são os mais comuns no padrão Omie.

## Formato do arquivo (`cArquivo`)

O conteúdo deve ser o arquivo **compactado em ZIP** e depois **convertido em base64**. O campo `cMd5` é o hash MD5 do conteúdo base64 para validação de integridade.

## Códigos de Erro

| Código | Descrição |
|---|---|
| `VAL-001` | Campos obrigatórios ausentes |
| `VAL-002` | Nome ou conteúdo do arquivo ausente |
| `VAL-003` | Base64 inválido |
| `VAL-004` | MD5 não confere |
| `NOT-001` | Anexo não encontrado |
| `STR-001` | Erro no upload ao storage |
| `STR-002` | Erro ao gerar signed URL |
| `DB-001` | Erro de banco de dados |
| `AUTH-001` | Autenticação falhou |
