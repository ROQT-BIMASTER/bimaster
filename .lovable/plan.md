

# Correcao 10 — Dados de Teste e Robustez do /incluir CP

## Problema Raiz

O endpoint `POST /contas-pagar-api/incluir` retorna 500 porque:
1. A coluna `erp_id` (varchar, NOT NULL, sem default) nao e preenchida pelo `/incluir` — o insert falha no Postgres
2. Nao ha validacao de referencias (`codigo_cliente_fornecedor`, `codigo_categoria`) antes do insert — erros de FK caem no catch generico como 500

## Dados Existentes no Banco

- **Empresas**: IDs numericos (3, 4, 5, 10, 11...) com coluna `nome` (nao `razao_social`)
- **Fornecedores**: UUIDs com `razao_social` — ex: `34f876f8-...` (Destro Brasil), `a1b2c3d4-...` (SANDBOX Teste)
- **Contas Bancarias**: tabela `contas_bancarias` — 1 registro (id `7b38a2da-...`, banco 337, empresa_id 1)
- **Plano de Contas**: tabela `plano_contas` — vazia (0 registros com tipo_categoria D)
- **contas_pagar.codigo_cliente_fornecedor**: tipo `bigint` (nao UUID)
- **contas_pagar.id_conta_corrente**: tipo `bigint`
- **contas_pagar.erp_id**: varchar NOT NULL, sem default

## Solucao (4 partes)

### Parte 1 — Fix `/incluir` no Edge Function (`supabase/functions/contas-pagar-api/index.ts`)

**1a.** Gerar `erp_id` automaticamente quando nao fornecido pelo sync:
```typescript
// Linha ~2006, antes do insert
const erp_id = `API-${codigo_lancamento_integracao}-${Date.now()}`;
// Adicionar ao insertData
insertData.erp_id = erp_id;
```

**1b.** Melhorar error handling no insert para retornar 400 em vez de 500 para erros de constraint:
```typescript
if (error) {
  if (error.code === '23505') { /* já existe */ }
  if (error.code === '23503') { /* FK inválida */ }
  if (error.code === '23502') { /* NOT NULL violation */ }
  // Retornar 400 com mensagem descritiva em vez de throw
}
```

### Parte 2 — Inserir Dados de Teste via SQL

Inserir uma categoria de teste no `plano_contas` (tabela vazia atualmente):
```sql
INSERT INTO plano_contas (id, codigo, descricao, tipo, tipo_categoria, is_active, empresa_id)
VALUES (gen_random_uuid(), '9.99.99', '[TESTE] Categoria Integracao API', 'analitica', 'D', true, 5);
```

Verificar se `contas_bancarias` tem `n_cod_cc` preenchido (o campo `id_conta_corrente` em contas_pagar e bigint, referencia `n_cod_cc`).

### Parte 3 — Atualizar Exemplos na Documentacao

Atualizar bodies em `ApiDocumentation.tsx` para usar dados reais descobertos:
- `codigo_cliente_fornecedor`: usar bigint real de um fornecedor (consultar `n_cod_cc` ou codigo equivalente)
- Remover campos que causam confusao nos exemplos

### Parte 4 — Validacao Checklist

Testar via `curl_edge_functions`:
1. `GET /contas-pagar-api/status` → 200
2. `GET /contas-pagar-api/listar` → 200
3. `POST /contas-pagar-api/incluir` com dados validos → 201
4. `POST /contas-pagar-api/incluir` com fornecedor invalido → 400
5. `POST /contas-pagar-api/incluir` sem `data_previsao` → 201
6. `POST /contas-pagar-api/incluir` sem `id_conta_corrente` → 201

## Arquivos Alterados

- `supabase/functions/contas-pagar-api/index.ts` — fix erp_id + error handling
- `src/components/erp/ApiDocumentation.tsx` — exemplos com dados reais (se necessario apos testes)
- SQL insert para dados de teste

## Resumo

- Causa raiz: `erp_id` NOT NULL sem valor no `/incluir`
- Fix principal: gerar `erp_id` automatico + error handling robusto
- Dados de teste: 1 categoria no plano_contas
- Validacao: 6 cenarios testados via curl

