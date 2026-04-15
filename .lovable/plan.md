

# Correcao — Validacao de Referencias + Catch Informativo nas APIs CP e CR

## Contexto do Problema

Quando um payload e sintaticamente valido mas contem um `empresa_id` inexistente, a API retorna 500 generico. O catch global no CP retorna `"Unknown error"` em alguns caminhos.

## Descobertas da Analise de Schema

| Campo | Tipo no banco | FK real? | Tabela referenciada |
|---|---|---|---|
| `empresa_id` | integer | SIM (verificavel) | `empresas.id` |
| `codigo_cliente_fornecedor` | bigint | NAO | Codigo ERP legado, sem tabela referenciada |
| `id_conta_corrente` | bigint | NAO | Codigo ERP legado, sem tabela |
| `categoria_codigo` (CP) / `categoria` (CR) | varchar | NAO | Campo texto livre |

**Resultado**: Apenas `empresa_id` pode ser validado contra uma tabela real (`empresas`). Os demais campos sao codigos ERP legados sem FK no banco — validar contra tabelas inexistentes causaria novos erros.

## Plano de Correcao (2 arquivos)

### Arquivo 1: `supabase/functions/contas-pagar-api/index.ts`

**A. Criar funcao helper `validateReferences`** (~30 linhas):
- Recebe `supabase`, `body`, `corsHeaders`
- Valida `empresa_id` contra `empresas.id` (se informado)
- Retorna `Response | null` (null = OK, Response = erro 400 com mensagem clara)

**B. Inserir chamada nos handlers de mutacao**:
- `/incluir` (linha ~1965): apos Zod parse, antes do INSERT
- `/upsert` (linha ~2166): apos Zod parse, antes do UPSERT
- `/upsert-lote` (linha ~2247): dentro do loop, apos Zod parse de cada item
- `/alterar` (linha ~2026): apos Zod parse, antes do UPDATE
- `/lancar-pagamento` (linha ~2287): titulo ja e buscado e validado — OK, nao precisa

**C. Melhorar catch global** (linha 2564):
```typescript
// ANTES:
error: error instanceof Error ? error.message : 'Unknown error',
// DEPOIS:
error: error instanceof Error ? error.message : 'Erro interno desconhecido',
error_detail: error instanceof Error ? error.message : String(error),
codigo_status: '1',
descricao_status: `Erro interno: ${error instanceof Error ? error.message : 'erro desconhecido'}`
```

### Arquivo 2: `supabase/functions/contas-receber-api/index.ts`

**A. Criar funcao helper `validateReferences`** (mesma logica):
- Valida `empresa_id` contra `empresas.id`

**B. Inserir nos handlers**:
- `/incluir` (linha ~161)
- `/upsert` (linha ~284)
- `/upsert-lote` (linha ~319): validar empresa_id do primeiro item ou todos
- `/alterar` — nao recebe empresa_id, skip

**C. O catch global do CR** (linha 658) ja retorna `error.message` — esta melhor que o CP, mas adicionar `codigo_status` e `descricao_status` para consistencia com o formato Huggs.

### Detalhes da funcao `validateReferences`

```typescript
async function validateReferences(
  supabase: any,
  body: { empresa_id?: number; codigo_lancamento_integracao?: string },
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  if (body.empresa_id) {
    const { data: emp } = await supabase
      .from('empresas').select('id')
      .eq('id', body.empresa_id).maybeSingle();
    if (!emp) {
      return new Response(JSON.stringify({
        codigo_lancamento_integracao: body.codigo_lancamento_integracao || null,
        codigo_status: '1',
        descricao_status: `Empresa não encontrada: empresa_id '${body.empresa_id}' não existe no cadastro`
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
  return null;
}
```

### Por que NAO validar os outros campos

- `codigo_cliente_fornecedor`: bigint no banco, codigo numerico ERP. Nao existe tabela `fornecedores` com coluna bigint para lookup. A tabela `fornecedores` usa UUID como PK e `codigo_externo` (varchar). Nao ha mapeamento direto.
- `id_conta_corrente`: bigint, codigo ERP legado. Nao ha tabela `contas_correntes`.
- `categoria_codigo`/`categoria`: varchar livre, sem tabela de categorias.

Forcar validacao nesses campos quebraria a compatibilidade com integradores que usam codigos ERP validos no sistema externo.

## Testes pos-deploy

1. CP `/incluir` com `empresa_id` inexistente → 400 com mensagem clara
2. CP `/incluir` com `empresa_id` valido → 201 sucesso
3. CR `/incluir` com `empresa_id` inexistente → 400
4. CP/CR catch generico → mensagem real, nao "Unknown error"

