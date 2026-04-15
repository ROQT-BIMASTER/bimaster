

# Correcao 8 — OpenAPI: Exemplos como String JSON

## Problema

A funcao `parseExample` (linha 1607) tenta `JSON.parse` nos response strings, mas falha silenciosamente quando encontra padroes invalidos como `[...]`, `{...}`, e `, ... }`. Resultado: o exemplo fica como string no OpenAPI, quebrando Swagger UI e Postman.

Padroes invalidos encontrados:
- `[...]` — 117 ocorrencias (arrays truncados)
- `{...}` — 5 ocorrencias (objetos truncados)
- `, ... }` — 5 ocorrencias (propriedades truncadas)
- `"..."` — strings com reticencias (valido como JSON, nao precisa correcao)

## Solucao

Em vez de editar 27+ response strings individualmente, corrigir o `parseExample` para sanitizar os padroes antes do `JSON.parse`.

**Arquivo: `src/components/erp/ApiDocumentation.tsx`**

### Alteracao unica — `parseExample` (linhas 1607-1611)

```typescript
const parseExample = (str: string | undefined) => {
  if (!str) return undefined;
  if (typeof str === "object") return str;
  try {
    // Sanitize common shorthand patterns that break JSON.parse
    const sanitized = str
      .replace(/\[\.\.\.\]/g, "[]")        // [...] → []
      .replace(/\{\.\.\.\}/g, "{}")         // {...} → {}
      .replace(/,\s*\.\.\.\s*\}/g, " }");  // , ... } → }
    return JSON.parse(sanitized);
  } catch {
    return str;
  }
};
```

Isso resolve todos os 27 endpoints de uma vez, sem tocar nos dados de cada endpoint.

