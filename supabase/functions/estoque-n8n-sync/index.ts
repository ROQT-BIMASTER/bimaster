import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// =====================================================
// CONFIGURAÇÕES DE PERFORMANCE
// =====================================================
const BULK_BATCH_SIZE = 5000;
const MAX_PAYLOAD_SIZE = 50000;
const RECOMMENDED_CHUNK_SIZE = 10000;

interface DistribuidoraInput {
  nome: string;
  cnpj: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  telefone?: string;
  email?: string;
}

interface ProdutoMasterInput {
  nome: string;
  sku_master: string;
  unidade_medida?: string;
  categoria?: string;
  subcategoria?: string;
  descricao?: string;
}

interface VinculacaoInput {
  sku_master: string;
  cnpj_distribuidora: string;
  codigo_produto_distribuidora: string;
  nome_exibicao?: string;
  fator_conversao?: number;
}

interface MovimentacaoInput {
  cnpj_distribuidora: string;
  codigo_produto: string;
  tipo_movimento: 'entrada' | 'saida' | 'transferencia' | 'ajuste' | 'inventario';
  quantidade: number;
  lote?: string;
  localizacao?: string;
  data_validade?: string;
  custo_unitario?: number;
  documento_referencia?: string;
  observacao?: string;
  origem?: string;
  destino?: string;
}

interface SyncPayload {
  tipo: 'distribuidoras' | 'produtos_master' | 'vinculacoes' | 'movimentacoes' | 'completo' | 'bulk-movimentacoes';
  dados: {
    distribuidoras?: DistribuidoraInput[];
    produtos_master?: ProdutoMasterInput[];
    vinculacoes?: VinculacaoInput[];
    movimentacoes?: MovimentacaoInput[];
  };
  transaction_id?: string;
  sync_id?: string;
  chunk_number?: number;
  total_chunks?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const path = url.pathname;
  
  try {
    // Validar API Key
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('N8N_API_KEY');
    
    if (!apiKey || apiKey !== expectedKey) {
      console.error('❌ API Key inválida ou ausente');
      return new Response(
        JSON.stringify({ error: 'API Key inválida ou ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // =====================================================
    // GET /status - Status da API
    // =====================================================
    if (path.endsWith('/status') && req.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'online',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        config: {
          bulk_batch_size: BULK_BATCH_SIZE,
          max_payload_size: MAX_PAYLOAD_SIZE,
          recommended_chunk_size: RECOMMENDED_CHUNK_SIZE
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /bulk-movimentacoes - Sincronização em massa de movimentações
    // =====================================================
    if (path.endsWith('/bulk-movimentacoes') && req.method === 'POST') {
      const body = await req.json();
      const movimentacoes = body.movimentacoes || body.data || [];
      const syncId = body.sync_id || crypto.randomUUID();
      const chunkNumber = body.chunk_number || 1;
      const totalChunks = body.total_chunks;
      const transactionId = body.transaction_id;

      if (!Array.isArray(movimentacoes) || movimentacoes.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid payload - array expected' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (movimentacoes.length > MAX_PAYLOAD_SIZE) {
        return new Response(JSON.stringify({ 
          error: `Payload too large. Max: ${MAX_PAYLOAD_SIZE}, received: ${movimentacoes.length}` 
        }), {
          status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`📦 bulk-movimentacoes: Recebidos ${movimentacoes.length} registros (chunk ${chunkNumber})`);

      // Adicionar transaction_id aos registros
      const recordsWithTx = movimentacoes.map((m: MovimentacaoInput) => ({
        ...m,
        transaction_id: transactionId || syncId
      }));

      // Chamar função SQL otimizada
      const { data: result, error } = await supabase.rpc('bulk_upsert_estoque_movimentacoes_v2', {
        p_records: recordsWithTx
      });

      if (error) {
        console.error('❌ Erro bulk_upsert_estoque:', error);
        
        await supabase.from('sync_chunks_tracking').insert({
          sync_id: syncId,
          entidade: 'estoque_movimentacoes',
          chunk_number: chunkNumber,
          total_chunks: totalChunks,
          records_in_chunk: movimentacoes.length,
          status: 'error',
          error_message: error.message,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        });

        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const duration = Date.now() - startTime;

      // Registrar chunk processado
      await supabase.from('sync_chunks_tracking').insert({
        sync_id: syncId,
        entidade: 'estoque_movimentacoes',
        chunk_number: chunkNumber,
        total_chunks: totalChunks,
        records_in_chunk: movimentacoes.length,
        records_processed: result.processed,
        records_error: result.errors,
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: duration
      });

      console.log(`✅ bulk-movimentacoes: Chunk ${chunkNumber} processado em ${duration}ms - P:${result.processed} E:${result.errors}`);

      return new Response(JSON.stringify({
        success: true,
        sync_id: syncId,
        chunk_number: chunkNumber,
        statistics: {
          total_received: movimentacoes.length,
          processed: result.processed,
          errors: result.errors
        },
        duration_ms: duration,
        performance: {
          records_per_second: Math.round(movimentacoes.length / (duration / 1000))
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST /sync-complete - Finalizar sincronização
    // =====================================================
    if (path.endsWith('/sync-complete') && req.method === 'POST') {
      const { sync_id } = await req.json();

      if (!sync_id) {
        return new Response(JSON.stringify({ error: 'sync_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Buscar resumo dos chunks
      const { data: progress } = await supabase
        .from('sync_chunks_progress')
        .select('*')
        .eq('sync_id', sync_id)
        .single();

      // Registrar no log
      await supabase.from('estoque_sync_logs').insert({
        tipo: 'bulk-sync-complete',
        status: progress?.overall_status === 'completed' ? 'sucesso' : 'parcial',
        registros_processados: progress?.total_processed || 0,
        registros_erro: progress?.error_chunks || 0,
        detalhes: progress,
        duracao_ms: progress?.total_duration_ms || 0
      });

      console.log(`✅ sync-complete: Sincronização ${sync_id} finalizada`);

      return new Response(JSON.stringify({
        success: true,
        sync_id,
        summary: progress || { message: 'No chunks found for this sync_id' }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // POST / - Sincronização padrão (compatibilidade)
    // =====================================================
    const payload: SyncPayload = await req.json();
    console.log('📦 Payload recebido:', JSON.stringify({ tipo: payload.tipo, counts: {
      distribuidoras: payload.dados.distribuidoras?.length || 0,
      produtos_master: payload.dados.produtos_master?.length || 0,
      vinculacoes: payload.dados.vinculacoes?.length || 0,
      movimentacoes: payload.dados.movimentacoes?.length || 0
    }}, null, 2));

    const resultado = {
      sucesso: true,
      processados: 0,
      erros: [] as string[],
      detalhes: {} as Record<string, any>
    };

    // Processar distribuidoras (em batch)
    if (payload.dados.distribuidoras?.length) {
      console.log('🏢 Processando distribuidoras em batch...');
      const distResult = await processarDistribuidorasBatch(supabase, payload.dados.distribuidoras);
      resultado.detalhes.distribuidoras = distResult;
      resultado.processados += distResult.processados;
      resultado.erros.push(...distResult.erros);
    }

    // Processar produtos master (em batch)
    if (payload.dados.produtos_master?.length) {
      console.log('📦 Processando produtos master em batch...');
      const prodResult = await processarProdutosMasterBatch(supabase, payload.dados.produtos_master);
      resultado.detalhes.produtos_master = prodResult;
      resultado.processados += prodResult.processados;
      resultado.erros.push(...prodResult.erros);
    }

    // Processar vinculações
    if (payload.dados.vinculacoes?.length) {
      console.log('🔗 Processando vinculações...');
      const vincResult = await processarVinculacoes(supabase, payload.dados.vinculacoes);
      resultado.detalhes.vinculacoes = vincResult;
      resultado.processados += vincResult.processados;
      resultado.erros.push(...vincResult.erros);
    }

    // Processar movimentações (otimizado com função SQL)
    if (payload.dados.movimentacoes?.length) {
      console.log('📊 Processando movimentações...');
      
      if (payload.dados.movimentacoes.length > 100) {
        // Usar função SQL otimizada para grandes volumes
        const recordsWithTx = payload.dados.movimentacoes.map(m => ({
          ...m,
          transaction_id: payload.transaction_id
        }));

        const { data: result, error } = await supabase.rpc('bulk_upsert_estoque_movimentacoes_v2', {
          p_records: recordsWithTx
        });

        if (error) {
          resultado.erros.push(`Movimentações: ${error.message}`);
        } else {
          resultado.detalhes.movimentacoes = {
            processados: result.processed,
            erros: result.errors > 0 ? [`${result.errors} registros com erro`] : []
          };
          resultado.processados += result.processed;
        }
      } else {
        // Processamento tradicional para pequenos volumes
        const movResult = await processarMovimentacoes(supabase, payload.dados.movimentacoes, payload.transaction_id);
        resultado.detalhes.movimentacoes = movResult;
        resultado.processados += movResult.processados;
        resultado.erros.push(...movResult.erros);
      }
    }

    resultado.sucesso = resultado.erros.length === 0;
    const duracao = Date.now() - startTime;

    // Registrar log de sincronização
    await supabase.from('estoque_sync_logs').insert({
      tipo: payload.tipo,
      status: resultado.sucesso ? 'sucesso' : 'parcial',
      registros_enviados: getTotalRegistros(payload.dados),
      registros_processados: resultado.processados,
      registros_erro: resultado.erros.length,
      erros: resultado.erros,
      detalhes: resultado.detalhes,
      ip_origem: req.headers.get('x-forwarded-for') || 'unknown',
      duracao_ms: duracao
    });

    console.log(`✅ Sincronização concluída em ${duracao}ms - ${resultado.processados} processados`);

    return new Response(
      JSON.stringify({
        ...resultado,
        duration_ms: duracao,
        performance: {
          records_per_second: Math.round(resultado.processados / (duracao / 1000))
        }
      }),
      { 
        status: resultado.sucesso ? 200 : 207,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    const err = error as Error;
    console.error('❌ Erro na sincronização:', err);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('estoque_sync_logs').insert({
      tipo: 'erro',
      status: 'erro',
      erros: [err.message],
      duracao_ms: Date.now() - startTime
    });

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getTotalRegistros(dados: SyncPayload['dados']): number {
  return (dados.distribuidoras?.length || 0) +
         (dados.produtos_master?.length || 0) +
         (dados.vinculacoes?.length || 0) +
         (dados.movimentacoes?.length || 0);
}

// =====================================================
// FUNÇÕES DE PROCESSAMENTO EM BATCH
// =====================================================

async function processarDistribuidorasBatch(supabase: any, distribuidoras: DistribuidoraInput[]) {
  const result = { processados: 0, erros: [] as string[] };
  
  const records = distribuidoras.map(dist => ({
    nome: dist.nome,
    cnpj: dist.cnpj.replace(/\D/g, ''),
    endereco: dist.endereco,
    cidade: dist.cidade,
    uf: dist.uf,
    telefone: dist.telefone,
    email: dist.email,
    ativo: true
  }));

  const { error, count } = await supabase
    .from('estoque_distribuidoras')
    .upsert(records, { onConflict: 'cnpj', count: 'exact' });
  
  if (error) {
    result.erros.push(`Distribuidoras batch: ${error.message}`);
  } else {
    result.processados = count || records.length;
  }
  
  return result;
}

async function processarProdutosMasterBatch(supabase: any, produtos: ProdutoMasterInput[]) {
  const result = { processados: 0, erros: [] as string[] };
  
  const records = produtos.map(prod => ({
    nome: prod.nome,
    sku_master: prod.sku_master,
    unidade_medida: prod.unidade_medida || 'UN',
    categoria: prod.categoria,
    subcategoria: prod.subcategoria,
    descricao: prod.descricao,
    ativo: true
  }));

  const { error, count } = await supabase
    .from('estoque_produtos_master')
    .upsert(records, { onConflict: 'sku_master', count: 'exact' });
  
  if (error) {
    result.erros.push(`Produtos batch: ${error.message}`);
  } else {
    result.processados = count || records.length;
  }
  
  return result;
}

async function processarVinculacoes(supabase: any, vinculacoes: VinculacaoInput[]) {
  const result = { processados: 0, erros: [] as string[] };
  
  for (const vinc of vinculacoes) {
    try {
      const { data: produto } = await supabase
        .from('estoque_produtos_master')
        .select('id')
        .eq('sku_master', vinc.sku_master)
        .single();
      
      const { data: distribuidora } = await supabase
        .from('estoque_distribuidoras')
        .select('id')
        .eq('cnpj', vinc.cnpj_distribuidora.replace(/\D/g, ''))
        .single();
      
      if (!produto || !distribuidora) {
        throw new Error('Produto ou distribuidora não encontrado');
      }

      const { error } = await supabase
        .from('estoque_produtos_distribuidora')
        .upsert({
          produto_master_id: produto.id,
          distribuidora_id: distribuidora.id,
          codigo_produto_distribuidora: vinc.codigo_produto_distribuidora,
          nome_exibicao: vinc.nome_exibicao,
          fator_conversao: vinc.fator_conversao || 1.0,
          ativo: true
        }, { onConflict: 'distribuidora_id,codigo_produto_distribuidora' });
      
      if (error) throw error;
      result.processados++;
    } catch (e) {
      result.erros.push(`Vinculação ${vinc.sku_master}/${vinc.codigo_produto_distribuidora}: ${(e as Error).message}`);
    }
  }
  
  return result;
}

async function processarMovimentacoes(supabase: any, movimentacoes: MovimentacaoInput[], transactionId?: string) {
  const result = { processados: 0, erros: [] as string[] };
  
  for (const mov of movimentacoes) {
    try {
      const { data: distribuidora } = await supabase
        .from('estoque_distribuidoras')
        .select('id')
        .eq('cnpj', mov.cnpj_distribuidora.replace(/\D/g, ''))
        .single();
      
      if (!distribuidora) throw new Error('Distribuidora não encontrada');

      const { data: prodDist } = await supabase
        .from('estoque_produtos_distribuidora')
        .select('id')
        .eq('distribuidora_id', distribuidora.id)
        .eq('codigo_produto_distribuidora', mov.codigo_produto)
        .single();
      
      if (!prodDist) throw new Error('Produto não vinculado');

      let { data: saldo } = await supabase
        .from('estoque_saldos')
        .select('id, quantidade_disponivel')
        .eq('distribuidora_id', distribuidora.id)
        .eq('produto_distribuidora_id', prodDist.id)
        .eq('lote', mov.lote || '')
        .maybeSingle();

      if (!saldo) {
        const { data: novoSaldo, error: saldoError } = await supabase
          .from('estoque_saldos')
          .insert({
            distribuidora_id: distribuidora.id,
            produto_distribuidora_id: prodDist.id,
            quantidade_disponivel: 0,
            localizacao: mov.localizacao,
            lote: mov.lote || '',
            data_validade: mov.data_validade
          })
          .select()
          .single();
        
        if (saldoError) throw saldoError;
        saldo = novoSaldo;
      }

      const qtdAnterior = saldo.quantidade_disponivel || 0;
      let qtdNova = qtdAnterior;
      
      if (mov.tipo_movimento === 'entrada') {
        qtdNova = qtdAnterior + mov.quantidade;
      } else if (mov.tipo_movimento === 'saida') {
        qtdNova = qtdAnterior - mov.quantidade;
      } else if (mov.tipo_movimento === 'inventario') {
        qtdNova = mov.quantidade;
      } else if (mov.tipo_movimento === 'ajuste') {
        qtdNova = qtdAnterior + mov.quantidade;
      }

      await supabase.from('estoque_saldos')
        .update({ quantidade_disponivel: qtdNova })
        .eq('id', saldo.id);

      const { error: movError } = await supabase
        .from('estoque_movimentacoes')
        .insert({
          estoque_id: saldo.id,
          tipo_movimento: mov.tipo_movimento,
          quantidade: Math.abs(mov.quantidade),
          quantidade_anterior: qtdAnterior,
          quantidade_nova: qtdNova,
          custo_unitario: mov.custo_unitario,
          valor_total: mov.custo_unitario ? mov.custo_unitario * Math.abs(mov.quantidade) : null,
          documento_referencia: mov.documento_referencia,
          observacao: mov.observacao,
          origem: mov.origem,
          destino: mov.destino,
          n8n_transaction_id: transactionId
        });
      
      if (movError) throw movError;
      result.processados++;
    } catch (e) {
      result.erros.push(`Movimentação ${mov.codigo_produto}: ${(e as Error).message}`);
    }
  }
  
  return result;
}
