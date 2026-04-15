

# Correcao 4 — Body Templates com Valores Placeholder Descritivos

## Problema

Os bodies pre-configurados no `BODY_TEMPLATES` usam numeros hardcoded (e.g. `4214850`, `4243124`, `427619317`, `2485994`) que nao existem no banco, causando confusao e erros 500 ao testar. Devem usar placeholders descritivos.

## Alteracoes

**Arquivo: `src/components/erp/ApiTester.tsx`** — `BODY_TEMPLATES` (linhas 290-417)

### Templates a corrigir:

| Linha | Endpoint | Campos a corrigir |
|---|---|---|
| 296 | CP `/incluir` | `codigo_cliente_fornecedor`: "uuid-do-fornecedor", remover `data_previsao` e `id_conta_corrente` (opcionais, confundem) |
| 298 | CP `/upsert` | Idem + `empresa_id`: "uuid-da-empresa" (string, nao 8) |
| 299 | CP `/upsert-lote` | Idem dentro do array |
| 312 | Lanc CC `/incluir` | `nCodCC`: "codigo-da-conta-corrente", `nCodCliente`: "codigo-do-cliente" |
| 314 | Lanc CC `/upsert` | `nCodCC`: "codigo-da-conta-corrente" |
| 315 | Lanc CC `/upsert-lote` | `nCodCC`: "codigo-da-conta-corrente" |
| 317 | CR `/incluir` | `codigo_cliente_fornecedor`: "uuid-do-cliente", remover `data_previsao` e `id_conta_corrente` |
| 319 | CR `/upsert` | Idem + `empresa_id`: "uuid-da-empresa" |
| 320 | CR `/upsert-lote` | Idem dentro do array |

### Valores finais dos templates corrigidos:

**CP `/incluir`** (linha 296):
```json
{ "codigo_lancamento_integracao": "INT-001", "codigo_cliente_fornecedor": "uuid-do-fornecedor", "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "2.04.01" }
```

**CP `/upsert`** (linha 298):
```json
{ "codigo_lancamento_integracao": "INT-001", "empresa_id": "uuid-da-empresa", "codigo_cliente_fornecedor": "uuid-do-fornecedor", "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "2.04.01" }
```

**CP `/upsert-lote`** (linha 299):
```json
{ "lote": 1, "conta_pagar_cadastro": [{ "codigo_lancamento_integracao": "INT-001", "empresa_id": "uuid-da-empresa", "codigo_cliente_fornecedor": "uuid-do-fornecedor", "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "2.04.01" }] }
```

**Lanc CC `/incluir`** (linha 312):
```json
{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": "codigo-da-conta-corrente", "dDtLanc": "21/03/2026", "nValorLanc": 123.46 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN", "nCodCliente": "codigo-do-cliente", "cObs": "Referente a jardinagem" } }
```

**Lanc CC `/upsert`** (linha 314):
```json
{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": "codigo-da-conta-corrente", "dDtLanc": "21/03/2026", "nValorLanc": 123.46 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN", "cObs": "Lançamento via API" } }
```

**Lanc CC `/upsert-lote`** (linha 315):
```json
{ "lote": 1, "lancamentos": [{ "cCodIntLanc": "LANC001", "cabecalho": { "nCodCC": "codigo-da-conta-corrente", "dDtLanc": "21/03/2026", "nValorLanc": 100 }, "detalhes": { "cCodCateg": "1.01.02", "cTipo": "DIN" } }] }
```

**CR `/incluir`** (linha 317):
```json
{ "codigo_lancamento_integracao": "CR-001", "codigo_cliente_fornecedor": "uuid-do-cliente", "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "1.01.02" }
```

**CR `/upsert`** (linha 319):
```json
{ "codigo_lancamento_integracao": "CR-001", "empresa_id": "uuid-da-empresa", "codigo_cliente_fornecedor": "uuid-do-cliente", "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "1.01.02" }
```

**CR `/upsert-lote`** (linha 320):
```json
{ "lote": 1, "conta_receber_cadastro": [{ "codigo_lancamento_integracao": "CR-001", "empresa_id": "uuid-da-empresa", "codigo_cliente_fornecedor": "uuid-do-cliente", "data_vencimento": "21/03/2026", "valor_documento": 100, "codigo_categoria": "1.01.02" }] }
```

### Templates que permanecem inalterados

Clientes, Empresas, Categorias, Departamentos, Projetos, Webhook, Parcelas, Portadores — ja usam valores descritivos adequados (strings, codigos de integracao). Nao precisam de alteracao.

## Resumo

- 9 templates corrigidos
- Numeros ERP hardcoded substituidos por placeholders descritivos
- Campos opcionais (`data_previsao`, `id_conta_corrente`) removidos dos templates CP/CR para alinhar com a Correcao 3
- Demais templates ja estao corretos

