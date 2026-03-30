

# Auto-preenchimento de Endereço por CEP nos Formulários Dinâmicos

## Análise de APIs

Existem 3 APIs públicas confiáveis para consulta de CEP no Brasil:

1. **ViaCEP** (`viacep.com.br`) — Gratuita, sem autenticação, sem limite oficial. Retorna logradouro, bairro, cidade, UF. Formato: `https://viacep.com.br/ws/{cep}/json/`
2. **BrasilAPI** (`brasilapi.com.br/api/cep/v2/{cep}`) — Gratuita, agrega múltiplas fontes (Correios, ViaCEP, WideNet). Mais resiliente.
3. **Correios** (API oficial) — Requer cadastro e token. Menos prática.

**Recomendação:** Usar **BrasilAPI como primária** com **ViaCEP como fallback**. Ambas são gratuitas, sem necessidade de API key, e podem ser chamadas diretamente do frontend (CORS habilitado). Isso elimina a necessidade de edge function.

## Solução

Adicionar o tipo de campo `address` (endereço) ao sistema de formulários dinâmicos. Quando o usuário digita um CEP, o sistema busca automaticamente e preenche logradouro, bairro, cidade e UF.

## Alterações

### 1. Novo componente `src/components/forms/CepAddressField.tsx`

Campo composto que renderiza:
- Input de CEP com máscara `00000-000`
- Ao digitar 8 dígitos, dispara busca automática (BrasilAPI → fallback ViaCEP)
- Spinner de loading durante a consulta
- Preenche automaticamente: Logradouro, Bairro, Cidade, UF
- Todos os campos editáveis após preenchimento
- O valor salvo é um objeto JSON: `{ cep, logradouro, bairro, cidade, uf, numero, complemento }`

```text
Fluxo:
  CEP digitado (8 dígitos) →
    fetch brasilapi.com.br/api/cep/v2/{cep} →
      sucesso? → preenche campos
      falha? → fetch viacep.com.br/ws/{cep}/json/ →
        sucesso? → preenche campos
        falha? → toast "CEP não encontrado"
```

### 2. Atualizar `src/components/forms/DynamicFormRenderer.tsx`

- Importar `CepAddressField`
- Adicionar case `field.field_type === "address"` que renderiza o componente
- O valor é armazenado como objeto JSON no `values[field.id]`

### 3. Atualizar `src/components/forms/FormFieldCard.tsx`

- Adicionar `"address"` à lista de tipos disponíveis no dropdown com label "Endereço (CEP)"

### 4. Atualizar `src/pages/DynamicFormBuilder.tsx`

- Adicionar `"address"` ao array de tipos de campo disponíveis

### 5. Atualizar `supabase/functions/suggest-form-fields/index.ts`

- Adicionar `"address"` como tipo válido no prompt da IA, instruindo que campos de endereço devem usar este tipo

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/forms/CepAddressField.tsx` | Novo — campo composto com busca CEP |
| `src/components/forms/DynamicFormRenderer.tsx` | Adicionar case `address` |
| `src/components/forms/FormFieldCard.tsx` | Adicionar tipo `address` ao dropdown |
| `src/pages/DynamicFormBuilder.tsx` | Adicionar tipo na lista |
| `supabase/functions/suggest-form-fields/index.ts` | Incluir `address` no prompt |

Nenhuma migration necessária — o valor é salvo como JSONB no `dynamic_form_answers.value`.

