import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

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
  tipo: 'distribuidoras' | 'produtos_master' | 'vinculacoes' | 'movimentacoes' | 'completo';
  dados: {
    distribuidoras?: DistribuidoraInput[];
    produtos_master?: ProdutoMasterInput[];
    vinculacoes?: VinculacaoInput[];
    movimentacoes?: MovimentacaoInput[];
  };
  transaction_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
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

    const payload: SyncPayload = await req.json();
    console.log('📦 Payload recebido:', JSON.stringify(payload, null, 2));

    const resultado = {
      sucesso: true,
      processados: 0,
      erros: [] as string[],
      detalhes: {} as Record<string, any>
    };

    // Processar distribuidoras
    if (payload.dados.distribuidoras?.length) {
      console.log('🏢 Processando distribuidoras...');
      const distResult = await processarDistribuidoras(supabase, payload.dados.distribuidoras);
      resultado.detalhes.distribuidoras = distResult;
      resultado.processados += distResult.processados;
      resultado.erros.push(...distResult.erros);
    }

    // Processar produtos master
    if (payload.dados.produtos_master?.length) {
      console.log('📦 Processando produtos master...');
      const prodResult = await processarProdutosMaster(supabase, payload.dados.produtos_master);
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

    // Processar movimentações
    if (payload.dados.movimentacoes?.length) {
      console.log('📊 Processando movimentações...');
      const movResult = await processarMovimentacoes(supabase, payload.dados.movimentacoes, payload.transaction_id);
      resultado.detalhes.movimentacoes = movResult;
      resultado.processados += movResult.processados;
      resultado.erros.push(...movResult.erros);
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

    console.log(`✅ Sincronização concluída em ${duracao}ms`);

    return new Response(
      JSON.stringify(resultado),
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

async function processarDistribuidoras(supabase: any, distribuidoras: DistribuidoraInput[]) {
  const result = { processados: 0, erros: [] as string[] };
  
  for (const dist of distribuidoras) {
    try {
      const { error } = await supabase
        .from('estoque_distribuidoras')
        .upsert(
          {
            nome: dist.nome,
            cnpj: dist.cnpj.replace(/\D/g, ''),
            endereco: dist.endereco,
            cidade: dist.cidade,
            uf: dist.uf,
            telefone: dist.telefone,
            email: dist.email,
            ativo: true
          },
          { onConflict: 'cnpj' }
        );
      
      if (error) throw error;
      result.processados++;
    } catch (e) {
      result.erros.push(`Distribuidora ${dist.cnpj}: ${(e as Error).message}`);
    }
  }
  
  return result;
}

async function processarProdutosMaster(supabase: any, produtos: ProdutoMasterInput[]) {
  const result = { processados: 0, erros: [] as string[] };
  
  for (const prod of produtos) {
    try {
      const { error } = await supabase
        .from('estoque_produtos_master')
        .upsert(
          {
            nome: prod.nome,
            sku_master: prod.sku_master,
            unidade_medida: prod.unidade_medida || 'UN',
            categoria: prod.categoria,
            subcategoria: prod.subcategoria,
            descricao: prod.descricao,
            ativo: true
          },
          { onConflict: 'sku_master' }
        );
      
      if (error) throw error;
      result.processados++;
    } catch (e) {
      result.erros.push(`Produto ${prod.sku_master}: ${(e as Error).message}`);
    }
  }
  
  return result;
}

async function processarVinculacoes(supabase: any, vinculacoes: VinculacaoInput[]) {
  const result = { processados: 0, erros: [] as string[] };
  
  for (const vinc of vinculacoes) {
    try {
      // Buscar IDs
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
        .upsert(
          {
            produto_master_id: produto.id,
            distribuidora_id: distribuidora.id,
            codigo_produto_distribuidora: vinc.codigo_produto_distribuidora,
            nome_exibicao: vinc.nome_exibicao,
            fator_conversao: vinc.fator_conversao || 1.0,
            ativo: true
          },
          { onConflict: 'distribuidora_id,codigo_produto_distribuidora' }
        );
      
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
      // Buscar distribuidora
      const { data: distribuidora } = await supabase
        .from('estoque_distribuidoras')
        .select('id')
        .eq('cnpj', mov.cnpj_distribuidora.replace(/\D/g, ''))
        .single();
      
      if (!distribuidora) throw new Error('Distribuidora não encontrada');

      // Buscar produto distribuidora
      const { data: prodDist } = await supabase
        .from('estoque_produtos_distribuidora')
        .select('id')
        .eq('distribuidora_id', distribuidora.id)
        .eq('codigo_produto_distribuidora', mov.codigo_produto)
        .single();
      
      if (!prodDist) throw new Error('Produto não vinculado a esta distribuidora');

      // Buscar ou criar saldo
      let { data: saldo } = await supabase
        .from('estoque_saldos')
        .select('id, quantidade_disponivel')
        .eq('distribuidora_id', distribuidora.id)
        .eq('produto_distribuidora_id', prodDist.id)
        .eq('lote', mov.lote || '')
        .maybeSingle();

      if (!saldo) {
        // Criar saldo inicial
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

      // Calcular nova quantidade
      const qtdAnterior = saldo.quantidade_disponivel || 0;
      let qtdNova = qtdAnterior;
      
      if (mov.tipo_movimento === 'entrada') {
        qtdNova = qtdAnterior + mov.quantidade;
      } else if (mov.tipo_movimento === 'saida') {
        qtdNova = qtdAnterior - mov.quantidade;
      } else if (mov.tipo_movimento === 'inventario') {
        qtdNova = mov.quantidade;
      } else if (mov.tipo_movimento === 'ajuste') {
        qtdNova = qtdAnterior + mov.quantidade; // pode ser negativo
      }

      // Registrar movimentação
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
