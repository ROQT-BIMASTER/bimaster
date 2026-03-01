import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Gerar hash para detectar alterações
async function generateHash(data: Record<string, unknown>): Promise<string> {
  const str = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Transformar dados do Power Query para formato da tabela
function transformPowerQueryData(record: Record<string, unknown>): Record<string, unknown> {
  // Mapeamento flexível de colunas
  const empresaId = record['ID Empresa'] ?? record['empresa_id'] ?? record['EmpresaId'] ?? record['id_empresa'] ?? 1;
  const empresaNome = record['Empresa'] ?? record['empresa_nome'] ?? record['empresa'] ?? '';
  const tipoDocumento = record['Tipo'] ?? record['tipo_documento'] ?? record['tipo'] ?? '';
  const numeroDocumento = record['Nota'] ?? record['numero_documento'] ?? record['nota'] ?? record['documento'] ?? '';
  const parcela = record['Seq'] ?? record['parcela'] ?? record['sequencia'] ?? 1;
  const clienteCodigo = record['Codigo'] ?? record['codigo'] ?? record['cliente_codigo'] ?? record['cod_cliente'] ?? '';
  const clienteNome = record['Cliente'] ?? record['cliente_nome'] ?? record['cliente'] ?? '';
  const valorOriginal = parseFloat(String(record['Valor_Trc'] ?? record['valor_original'] ?? record['valor'] ?? 0)) || 0;
  const valorAberto = parseFloat(String(record['Valor em Aberto'] ?? record['valor_aberto'] ?? record['saldo'] ?? 0)) || 0;
  const valorRecebido = parseFloat(String(record['Valor Pago'] ?? record['valor_recebido'] ?? record['valor_pago'] ?? 0)) || 0;
  const valorJuros = parseFloat(String(record['Valor Juros'] ?? record['valor_juros'] ?? record['juros'] ?? 0)) || 0;
  const valorDesconto = parseFloat(String(record['Valor Desconto'] ?? record['valor_desconto'] ?? record['desconto'] ?? 0)) || 0;
  const dataEmissao = record['Emissao'] ?? record['data_emissao'] ?? record['dt_emissao'] ?? null;
  const dataVencimento = record['Vencimento'] ?? record['data_vencimento'] ?? record['dt_vencimento'] ?? null;
  const dataRecebimento = record['Data Pgto'] ?? record['data_recebimento'] ?? record['dt_pagamento'] ?? null;
  const vendedor = record['Vendedor'] ?? record['vendedor'] ?? record['vendedor_nome'] ?? '';
  const portador = record['Nome Portador'] ?? record['portador'] ?? record['portador_nome'] ?? '';
  const tabela = record['Tabela'] ?? record['tabela'] ?? record['tabela_preco'] ?? '';
  const conta = record['Conta'] ?? record['conta'] ?? '';

  // Gerar ERP ID único
  const erpId = record['erp_id'] ?? record['ERP_ID'] ?? record['id'] ?? 
    `${empresaId}-${tipoDocumento}-${numeroDocumento}-${parcela}`.replace(/\s+/g, '');

  // Determinar status
  let status = 'aberto';
  if (valorAberto <= 0 && valorRecebido > 0) {
    status = 'pago';
  } else if (valorRecebido > 0 && valorAberto > 0) {
    status = 'parcial';
  }

  // Formatar datas
  const formatDate = (dateValue: unknown): string | null => {
    if (!dateValue) return null;
    try {
      const dateStr = String(dateValue);
      // Tentar diferentes formatos
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          // DD/MM/YYYY
          if (parts[0].length <= 2) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
          // YYYY/MM/DD
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }
      // ISO format
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      console.warn(`⚠️ Could not parse date: ${dateValue}`);
    }
    return null;
  };

  return {
    empresa_id: Number(empresaId) || 1,
    empresa_nome: String(empresaNome || ''),
    tipo_documento: String(tipoDocumento || ''),
    numero_documento: String(numeroDocumento || ''),
    parcela: Number(parcela) || 1,
    cliente_codigo: String(clienteCodigo || ''),
    cliente_nome: String(clienteNome || ''),
    valor_original: valorOriginal,
    valor_aberto: valorAberto,
    valor_recebido: valorRecebido,
    valor_juros: valorJuros,
    valor_desconto: valorDesconto,
    data_emissao: formatDate(dataEmissao),
    data_vencimento: formatDate(dataVencimento),
    data_recebimento: formatDate(dataRecebimento),
    vendedor: String(vendedor || ''),
    portador: String(portador || ''),
    tabela: String(tabela || ''),
    conta: String(conta || ''),
    erp_id: String(erpId),
    status,
    sincronizado_em: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ============= AUTENTICAÇÃO OBRIGATÓRIA =============
  // Aceita API key via x-api-key header OU JWT via Authorization header
  const apiKey = req.headers.get('x-api-key');
  const authHeader = req.headers.get('authorization');
  let authenticated = false;

  // Verificar API key (para Power Query / integrações externas)
  if (apiKey) {
    const validKeys = [
      Deno.env.get('N8N_API_KEY'),
      Deno.env.get('POWERQUERY_API_KEY'),
      Deno.env.get('POLLO_API_KEY'),
    ].filter(Boolean);
    
    if (validKeys.includes(apiKey)) {
      authenticated = true;
      console.log('🔑 Autenticado via API key');
    }
  }

  // Verificar JWT (para chamadas autenticadas do frontend)
  if (!authenticated && authHeader?.startsWith('Bearer ')) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const { createClient: createAnonClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const anonSupabase = createAnonClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await anonSupabase.auth.getClaims(token);
    if (!error && data?.claims?.sub) {
      authenticated = true;
      console.log(`🔑 Autenticado via JWT: ${data.claims.sub}`);
    }
  }

  if (!authenticated) {
    console.warn('❌ Requisição sem autenticação bloqueada');
    return new Response(
      JSON.stringify({ 
        error: 'Não autorizado. Envie x-api-key ou Authorization Bearer JWT.',
        hint: 'Configure o header x-api-key com a chave de API fornecida pelo administrador'
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Handle GET requests - return status/info (useful for testing connectivity)
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'online',
        message: 'Endpoint de sincronização Power Query ativo. Use POST para enviar dados.',
        usage: 'Envie um array JSON de registros via POST',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();
  console.log('🚀 Power Query Sync iniciado');

  try {
    // Validar método (aceitar apenas POST para dados)
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido. Use POST para enviar dados.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parsear body
    const body = await req.text();
    let records: Record<string, unknown>[];
    
    try {
      const parsed = JSON.parse(body);
      // Suportar array direto ou objeto com propriedade data/records
      if (Array.isArray(parsed)) {
        records = parsed;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        records = parsed.data;
      } else if (parsed.records && Array.isArray(parsed.records)) {
        records = parsed.records;
      } else {
        throw new Error('Formato inválido: esperado array ou objeto com propriedade data/records');
      }
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'JSON inválido', 
          details: String(parseError),
          hint: 'Envie um array de registros ou { "data": [...] }'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Recebidos ${records.length} registros do Power Query`);

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum registro para processar',
          statistics: { received: 0, processed: 0, inserted: 0, updated: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limite de segurança - AUMENTADO para suportar grandes volumes
    const MAX_RECORDS = 50000;
    if (records.length > MAX_RECORDS) {
      return new Response(
        JSON.stringify({ 
          error: `Limite excedido: máximo ${MAX_RECORDS} registros por requisição`,
          received: records.length,
          hint: 'Divida os dados em múltiplos batches menores'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Conectar ao Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Transformar registros
    console.log('🔄 Transformando registros...');
    const transformedRecords: Record<string, unknown>[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const transformed = transformPowerQueryData(records[i]);
        // Gerar hash para detectar alterações
        transformed.data_hash = await generateHash({
          erp_id: transformed.erp_id,
          valor_original: transformed.valor_original,
          valor_aberto: transformed.valor_aberto,
          status: transformed.status,
        });
        transformedRecords.push(transformed);
      } catch (transformError) {
        errors.push({ index: i, error: String(transformError) });
        console.warn(`⚠️ Erro ao transformar registro ${i}:`, transformError);
      }
    }

    console.log(`✅ ${transformedRecords.length} registros transformados, ${errors.length} erros`);

    // Upsert em batches
    const BATCH_SIZE = 1000;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < transformedRecords.length; i += BATCH_SIZE) {
      const batch = transformedRecords.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processando batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} registros`);

      // Buscar registros existentes para comparar hash
      const erpIds = batch.map(r => r.erp_id);
      const { data: existingRecords } = await supabase
        .from('contas_receber')
        .select('erp_id, data_hash')
        .in('erp_id', erpIds);

      const existingMap = new Map(
        (existingRecords || []).map(r => [r.erp_id, r.data_hash])
      );

      // Separar novos e atualizados
      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: Record<string, unknown>[] = [];

      for (const record of batch) {
        const existingHash = existingMap.get(record.erp_id);
        if (!existingHash) {
          toInsert.push(record);
        } else if (existingHash !== record.data_hash) {
          toUpdate.push(record);
        } else {
          skipped++;
        }
      }

      // Inserir novos
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('contas_receber')
          .insert(toInsert);
        
        if (insertError) {
          console.error('❌ Erro ao inserir:', insertError);
          // Tentar upsert como fallback
          const { error: upsertError } = await supabase
            .from('contas_receber')
            .upsert(toInsert, { onConflict: 'erp_id' });
          
          if (upsertError) {
            errors.push({ index: i, error: `Insert/Upsert error: ${upsertError.message}` });
          } else {
            inserted += toInsert.length;
          }
        } else {
          inserted += toInsert.length;
        }
      }

      // Atualizar existentes
      if (toUpdate.length > 0) {
        const { error: updateError } = await supabase
          .from('contas_receber')
          .upsert(toUpdate, { onConflict: 'erp_id' });
        
        if (updateError) {
          console.error('❌ Erro ao atualizar:', updateError);
          errors.push({ index: i, error: `Update error: ${updateError.message}` });
        } else {
          updated += toUpdate.length;
        }
      }
    }

    // Registrar sincronização no histórico
    const duration = Date.now() - startTime;
    await supabase.from('sync_history').insert({
      tipo_sync: 'powerquery',
      registros_processados: transformedRecords.length,
      registros_inseridos: inserted,
      registros_atualizados: updated,
      registros_ignorados: skipped,
      registros_erros: errors.length,
      duracao_segundos: Math.round(duration / 1000),
      status: errors.length === 0 ? 'completed' : 'partial',
      detalhes: { source: 'Power Query', errors: errors.slice(0, 10) },
    }).then(() => console.log('📝 Histórico registrado'));

    const result = {
      success: true,
      message: `Sincronização concluída em ${(duration / 1000).toFixed(1)}s`,
      statistics: {
        received: records.length,
        transformed: transformedRecords.length,
        inserted,
        updated,
        skipped,
        errors: errors.length,
        duration_ms: duration,
        rate_per_second: Math.round(transformedRecords.length / (duration / 1000)),
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    };

    console.log('✅ Sincronização finalizada:', result.statistics);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(error),
        hint: 'Verifique o formato dos dados e tente novamente'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
