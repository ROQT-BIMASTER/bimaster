

## Corrigir entrada de decimais como 0,05

### Problema
No `DecimalInput`, ao digitar "0,0" (etapa intermediária de "0,05"), o `parseFloat("0.0")` retorna `0`, apagando o que o usuário digitou. O campo volta para "0" e impede a digitação natural.

### Causa (linha 102)
```typescript
onChange(raw === "" ? 0 : raw.endsWith(".") ? raw : parseFloat(raw) || 0);
```
- `parseFloat("0.0")` → `0` → campo reseta para "0"
- Mesma coisa com "0.00" → perde o estado intermediário

### Solução
Manter o valor como **string crua** enquanto o usuário está digitando, e só converter para número quando o valor é "final" (não termina em "." e não termina em "0" após o ponto):

```typescript
onChange={(e) => {
  const raw = e.target.value.replace(",", ".");
  if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
    // Keep as string while user is still typing decimals
    if (raw === "" ) {
      onChange(0);
    } else if (raw.endsWith(".") || /\.\d*0$/.test(raw)) {
      onChange(raw); // preserve intermediate state like "0.0", "0.00"
    } else {
      onChange(parseFloat(raw) || 0);
    }
  }
}}
```

Também ajustar o `displayValue` para preservar strings intermediárias:
```typescript
const displayValue = typeof value === "string" ? value : (value === 0 ? "0" : String(value));
```

### Arquivo
- `src/components/fabrica/FichaCustoProdutoEditor.tsx` — componente `DecimalInput` (linhas 79-109)

