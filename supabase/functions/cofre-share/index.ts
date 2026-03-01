import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate token
    const { data: shareToken, error: tokenError } = await supabase
      .from("cofre_share_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !shareToken) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(shareToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token expirado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check revoked
    if (shareToken.is_revoked) {
      return new Response(
        JSON.stringify({ error: "Token revogado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max access
    if (shareToken.access_count >= shareToken.max_access) {
      return new Response(
        JSON.stringify({ error: "Limite de acessos atingido" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment access count
    await supabase
      .from("cofre_share_tokens")
      .update({ access_count: shareToken.access_count + 1 })
      .eq("id", shareToken.id);

    // Fetch documents
    const documentIds = shareToken.document_ids as string[];
    const { data: docs, error: docsError } = await supabase
      .from("fabrica_revisao_documentos")
      .select("id, nome_arquivo, arquivo_path, tipo_arquivo, categoria, metadata, lote")
      .in("id", documentIds);

    if (docsError || !docs) {
      return new Response(
        JSON.stringify({ error: "Erro ao buscar documentos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed URLs for each doc (24h)
    const results = [];
    for (const doc of docs) {
      let signedUrl = null;
      if (doc.arquivo_path) {
        const { data } = await supabase.storage
          .from("fabrica-revisao-docs")
          .createSignedUrl(doc.arquivo_path, 86400);
        signedUrl = data?.signedUrl || null;
      }
      results.push({
        id: doc.id,
        nome_arquivo: doc.nome_arquivo,
        tipo_arquivo: doc.tipo_arquivo,
        categoria: doc.categoria,
        lote: doc.lote,
        metadata: doc.metadata,
        url: signedUrl,
      });
    }

    return new Response(
      JSON.stringify({
        produto_nome: shareToken.produto_nome,
        lote_nome: shareToken.lote_nome,
        expires_at: shareToken.expires_at,
        documentos: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("cofre-share error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
