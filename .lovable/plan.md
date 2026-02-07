
# Correcao da Queda de Conexao na API de Clientes

## Diagnostico

A API de importacao de clientes (`/importar-clientes`) esta com 35.997 registros. O N8N envia chunks de 8.000-9.500 registros cada.

### A Causa Raiz

Quando o chunk tem mais de 5.000 registros, a funcao usa `EdgeRuntime.waitUntil()` para processar em background e retorna imediatamente (674ms). O problema:

```text
N8N envia Chunk 1 (8500 registros)
  --> Edge Function retorna OK em 674ms (background rodando: ~12s)
N8N envia Chunk 2 (8500 registros)  
  --> Edge Function retorna OK (background 1 AINDA rodando + background 2 inicia)
N8N envia Chunk 3 (8500 registros)
  --> 3 processos background competindo por recursos
N8N envia Chunk 4 (8500 registros)
  --> 4 processos concorrentes, instancia sobrecarregada
N8N envia Chunk 5 (~2000 registros)
  --> Instancia reciclada ou timeout = CONEXAO CAI
```

Alem disso, a funcao RPC `importar_clientes` processa registro por registro em loop PL/pgSQL (FOR loop com INSERT individual), o que e lento (~700 registros/segundo).

### Numeros dos Logs

- Chunks processando em 10-28 segundos cada
- Taxa: 334-816 registros/segundo
- Todos retornam 200, mas o background pode ser interrompido silenciosamente

## Solucao

### 1. Eliminar o processamento em background

Remover completamente o `EdgeRuntime.waitUntil()`. Processar TUDO de forma sincrona com batches menores. Assim o N8N so recebe a resposta quando o processamento realmente terminou e nao envia o proximo chunk antes da hora.

### 2. Reduzir batch interno de 5.000 para 2.000

Batches menores = RPCs mais rapidos = menos risco de timeout. Com 2.000 registros por RPC, cada chamada leva ~3 segundos.

### 3. Adicionar progresso incremental e logs detalhados

Registrar cada batch processado com estatisticas para facilitar debug.

### Fluxo Corrigido

```text
N8N envia Chunk 1 (8500 registros)
  --> Edge Function processa sincrono:
      Batch 1/5: 2000 registros (3s)
      Batch 2/5: 2000 registros (3s)
      Batch 3/5: 2000 registros (3s)
      Batch 4/5: 2000 registros (3s)
      Batch 5/5: 500 registros (1s)
  --> Retorna resultado completo em ~13s
N8N recebe OK, envia Chunk 2 (8500 registros)
  --> Mesmo processo, sem concorrencia
  ...
N8N envia ultimo Chunk (~2000 registros)
  --> Batch unico de 2000 registros (3s)
  --> Retorna OK = SUCESSO GARANTIDO
```

## Detalhes Tecnicos

### Arquivo modificado: `supabase/functions/cobranca-automation-api/index.ts`

Mudancas no endpoint `/importar-clientes` (linhas 565-668):

1. **Remover** o bloco `if (clientes.length > 5000)` com `EdgeRuntime.waitUntil()`
2. **Unificar** para um unico caminho sincrono que processa em batches de 2.000
3. **Adicionar** tratamento de erro por batch com continuacao (se um batch falha, os proximos continuam)
4. **Adicionar** logging progressivo para monitoramento

### Logica do novo endpoint

```text
1. Recebe array de clientes (qualquer tamanho)
2. Define BATCH_SIZE = 2000
3. Para cada batch de 2000:
   a. Chama supabase.rpc("importar_clientes", { p_clientes: batch })
   b. Acumula estatisticas (inseridos, atualizados, erros)
   c. Loga progresso: "Batch 3/5: 2000 processados"
   d. Se erro, loga e continua para proximo batch
4. Retorna resultado consolidado com todas as estatisticas
5. N8N recebe resposta APENAS quando tudo terminou
```

### Configuracao recomendada no N8N

Como a funcao agora e sincrona e pode levar ate 30 segundos por chunk de 8000 registros, o N8N deve ter:
- **Timeout**: 120 segundos (suficiente para chunks de ate 20.000)
- **Chunk size no N8N**: Pode manter 8.000-10.000 (funciona bem com a nova logica)

### Impacto esperado

| Antes | Depois |
|-------|--------|
| Background concorrente | Sincrono sequencial |
| Ultimo chunk perde conexao | Todos os chunks completam |
| Sem visibilidade do resultado real | Resultado detalhado por batch |
| 5.000 registros por RPC | 2.000 registros por RPC |
| Instancia sobrecarregada | Uma operacao por vez |

### Risco

- **Baixo**: A logica de processamento (RPC `importar_clientes`) nao muda
- **Unica diferenca**: O N8N vai esperar mais pela resposta de cada chunk (~13s em vez de 674ms), mas isso e o comportamento correto
- **Nenhuma alteracao no frontend**: Apenas o endpoint da edge function muda
