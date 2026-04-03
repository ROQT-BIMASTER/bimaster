import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { brand_id, brand_data, products } = await req.json();

    if (!brand_id || !brand_data) {
      return new Response(
        JSON.stringify({ error: 'brand_id e brand_data são obrigatórios' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💾 Salvando análise para brand_id: ${brand_id}`);

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Atualizar marca no banco
    const brandDescription = `${brand_data.description}\n\n${brand_data.mission || ''}`.trim();
    
    const { error: updateError } = await supabase
      .from('our_brands')
      .update({
        description: brandDescription,
      })
      .eq('id', brand_id);

    if (updateError) {
      console.error('Erro ao atualizar marca:', updateError);
      throw updateError;
    }

    console.log('✅ Marca atualizada no banco de dados');

    // Criar produtos no banco (se houver)
    let productsInserted = 0;
    if (products && products.length > 0) {
      const productsToInsert = products.map((product: any) => ({
        name: product.name,
        description: product.description || null,
        category: product.category || null,
        sku: product.sku || null,
        active: true,
      }));

      const { error: productsError, data: insertedProducts } = await supabase
        .from('our_products')
        .insert(productsToInsert)
        .select();

      if (productsError) {
        console.error('Erro ao inserir produtos:', productsError);
        throw productsError;
      }
      
      productsInserted = insertedProducts?.length || 0;
      console.log(`✅ ${productsInserted} produtos inseridos no banco de dados`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        products_inserted: productsInserted,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao salvar:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});
