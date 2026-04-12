

# Ajustes Finais SDKs v2.2.1 — Paridade Completa

## Escopo

Alterações em **2 arquivos**:
- `src/components/erp/SdkDownloadButtons.tsx` — adicionar metodos/dataclasses faltantes nos SDKs Python e JS
- `src/components/erp/ApiDocumentation.tsx` — adicionar entrada changelog v2.2.1

## Alteracoes no SDK Python (dentro de `generatePySDK`)

### 1. Adicionar `fornecedores_alterar` (linha ~1258, apos `fornecedores_incluir`)
```python
def fornecedores_alterar(self, body: FornecedorPayload, id: int) -> Dict:
    payload = self._to_dict(body)
    payload["id"] = id
    return self._request("POST", "/erp-fornecedores-sync/alterar", payload)
```

### 2. Adicionar `categorias_incluir` (linha ~1274, apos `categorias_consultar`)
```python
def categorias_incluir(self, body: Dict) -> Dict:
    return self._request("POST", "/categorias-api/incluir", body)
```

### 3. Adicionar `portadores_consultar` (linha ~1284, apos `portadores_listar`)
```python
def portadores_consultar(self, id: int) -> Dict:
    return self._request("GET", f"/portadores-api/consultar?id={id}")
```

### 4. Adicionar `cp_cancelar_pagamento` (linha ~1165, apos `cp_lancar_pagamento`)
```python
def cp_cancelar_pagamento(self, codigo_baixa: str) -> Dict:
    return self._request("POST", "/contas-pagar-api/cancelar-pagamento", {"codigo_baixa": codigo_baixa})
```

### 5. Adicionar dataclasses `EmpresaIncluirPayload` e `EmpresaAlterarPayload` (apos `WebhookSubscribePayload`, linha ~1031)
Atualizar assinaturas de `empresas_incluir` e `empresas_alterar` para usar as novas dataclasses com `self._to_dict(body)`.

## Alteracoes no SDK JavaScript (dentro de `generateJsSDK`)

### 6. Expandir JSDoc em metodos auxiliares
Substituir JSDoc de uma linha nos metodos de Categorias, Portadores, Plano de Contas, Departamentos, Projetos e Fornecedores por versoes completas com `@param` e `@returns`, conforme especificado no prompt.

## Changelog (ApiDocumentation.tsx)

### 7. Adicionar entrada v2.2.1 antes de v2.2.0
Com as 4 mudancas listadas no prompt.

## Atualizacao de versao

Alterar `SDK_VERSION` de `"2.2.0"` para `"2.2.1"` na linha 6.

## Detalhes Tecnicos

- Todas as alteracoes sao em strings geradas por `generatePySDK()` e `generateJsSDK()` dentro de `SdkDownloadButtons.tsx`
- Nenhum metodo existente sera modificado (apenas adicoes e atualizacao de assinatura nos 2 metodos de empresas)
- Nenhum arquivo fora dos 2 listados sera alterado

