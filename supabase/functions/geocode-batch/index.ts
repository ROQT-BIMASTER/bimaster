import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';


interface GeocodeResult {
  id: string;
  latitude: number;
  longitude: number;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_API_KEY}&region=br&language=pt-BR`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results?.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
    
    console.log(`⚠️ Geocode falhou para "${address}": ${data.status}`);
    return null;
  } catch (error) {
    console.error(`❌ Erro geocodificando "${address}":`, error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  try {
    console.log('🌍 geocode-batch: Iniciando');

    // ===== AUTHENTICATION: Verify JWT and admin role =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify user identity with their token
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !caller) {
      console.error('❌ Auth failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Use service role to check admin status
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      console.log(`❌ Usuário ${caller.id} não é admin`);
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem executar geocodificação em lote" }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 403 }
      );
    }
    // ===== END AUTHENTICATION =====

    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_PLACES_API_KEY não configurado');
    }

    const body = await req.json().catch(() => ({}));
    const table = body.table || 'clientes'; // 'clientes' or 'prospects'
    const batchSize = Math.min(body.batch_size || 100, 200);

    console.log(`📊 Processando tabela: ${table}, batch: ${batchSize}, admin: ${caller.id}`);

    // Fetch records without coordinates
    let query;
    if (table === 'clientes') {
      query = supabaseAdmin
        .from('clientes')
        .select('id, endereco, cidade, uf, bairro, cep')
        .is('latitude', null)
        .not('cidade', 'is', null)
        .not('uf', 'is', null)
        .limit(batchSize);
    } else {
      query = supabaseAdmin
        .from('prospects')
        .select('id, endereco, municipio, uf, bairro, logradouro, tipo_logradouro, numero, cep')
        .is('latitude', null)
        .limit(batchSize);
    }

    const { data: records, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!records || records.length === 0) {
      console.log('✅ Nenhum registro pendente para geocodificação');
      return new Response(
        JSON.stringify({ message: 'Nenhum registro pendente', processed: 0, success: 0 }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📍 ${records.length} registros para geocodificar`);

    const results: GeocodeResult[] = [];
    let errors = 0;

    // Process in mini-batches of 10 (parallel within batch, sequential between batches)
    for (let i = 0; i < records.length; i += 10) {
      const batch = records.slice(i, i + 10);
      
      const batchPromises = batch.map(async (record: any) => {
        let address = '';
        
        if (table === 'clientes') {
          const parts = [record.endereco, record.bairro, record.cidade, record.uf].filter(p => p && p.trim());
          address = parts.join(', ') + ', Brasil';
        } else {
          const parts = [
            record.tipo_logradouro, record.logradouro, record.numero,
            record.bairro, record.municipio, record.uf
          ].filter(p => p && p.trim());
          address = parts.length > 2 ? parts.join(', ') + ', Brasil' : (record.endereco || '') + ', Brasil';
        }

        if (address.length < 10) return null;

        const coords = await geocodeAddress(address);
        if (coords) {
          return { id: record.id, latitude: coords.lat, longitude: coords.lng };
        }
        errors++;
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is GeocodeResult => r !== null));

      // Small delay between batches to respect rate limits
      if (i + 10 < records.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Update coordinates in database
    let updated = 0;
    for (const result of results) {
      const { error: updateError } = await supabaseAdmin
        .from(table)
        .update({ latitude: result.latitude, longitude: result.longitude })
        .eq('id', result.id);

      if (!updateError) updated++;
      else console.error(`❌ Erro atualizando ${result.id}:`, updateError.message);
    }

    const summary = {
      table,
      processed: records.length,
      success: updated,
      errors,
      remaining_estimate: 'unknown'
    };

    console.log('✅ Geocodificação concluída:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro na função:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
