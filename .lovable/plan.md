

# Busca por CNPJ no Formulário Público com Vinculação Automática

## Resumo

No modo público do `MaterialRequestCard`, substituir o campo de texto livre por um campo de CNPJ com busca automática na Receita Federal (reutilizando a edge function `opencnpj-consulta` existente). Após a consulta, exibir os dados da empresa (razão social, endereço, cidade/UF). No backend, ao salvar a solicitação, tentar vincular automaticamente a uma loja já cadastrada pelo CNPJ.

## Fluxo

```text
Usuário digita CNPJ → clica "Buscar" →
  opencnpj-consulta retorna dados →
  Exibe: razão social, endereço, cidade/UF →
  Usuário confirma solicitação →
  Backend verifica se CNPJ existe em stores →
    Sim → loja_id = store.id
    Não → loja_id = null, salva cnpj + razão social para vinculação futura
```

## Alterações

### `src/components/forms/MaterialRequestCard.tsx`

No modo `isPublic`:
- Substituir input de texto livre por input de CNPJ + botão "Buscar"
- Ao digitar 14 dígitos (limpos), habilitar botão de busca
- Busca chama `supabase.functions.invoke("opencnpj-consulta", { body: { cnpj } })` — mesma edge function já existente
- Exibir card com dados retornados (razão social, endereço, cidade/UF)
- Novos states: `cnpjInput`, `cnpjData`, `cnpjLoading`
- No `handleConfirm`, buscar loja existente com `supabase.from("stores").select("id, name").eq("cnpj", cnpjClean).maybeSingle()` para vincular automaticamente
- Salvar `loja_cnpj` no campo de observações ou metadata para rastreabilidade

### Detalhes técnicos

- A edge function `opencnpj-consulta` requer autenticação JWT. No modo público o usuário não está autenticado, então a busca será feita **sem auth** — precisamos ajustar para aceitar chamadas sem token OU criar uma versão simplificada
- **Solução**: Chamar a API BrasilAPI/ViaCEP diretamente do frontend (como já fazemos no `CepAddressField`) em vez da edge function, evitando problema de autenticação. Usar `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` que é pública e gratuita

### API escolhida para modo público

BrasilAPI CNPJ: `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`
- Pública, sem auth, CORS habilitado
- Retorna: `razao_social`, `nome_fantasia`, `logradouro`, `municipio`, `uf`, `cep`

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/forms/MaterialRequestCard.tsx` | Adicionar busca CNPJ no modo público + vinculação automática |

Nenhuma migration necessária.

