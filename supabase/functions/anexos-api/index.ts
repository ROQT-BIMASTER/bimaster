// anexos-api/index.ts — API de Anexos de Documentos padrão Omie
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateApiKey, validateJWT, AuthError } from "../_shared/auth.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function authenticate(req: Request) {
  try {
    const apiResult = await validateApiKey(req);
    return { empresaId: apiResult.empresaId, source: "api_key" };
  } catch {
    try {
      const jwtResult = await validateJWT(req);
      return { empresaId: null, userId: jwtResult.userId, source: "jwt" };
    } catch {
      throw new AuthError("Autenticação necessária (x-api-key ou Bearer token)", 401);
    }
  }
}

// === MD5 helper ===
async function computeMd5(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// === ROUTE HANDLERS ===

async function handleIncluir(req: Request, auth: any): Promise<Response> {
  const startMs = Date.now();
  const body = await req.json();
  const { cCodIntAnexo, cTabela, nId, cNomeArquivo, cTipoArquivo, cArquivo, cMd5 } = body;

  if (!cTabela || !nId) {
    return errorResponse(400, "VAL-001", "cTabela e nId são obrigatórios", req, startMs);
  }
  if (!cNomeArquivo || !cArquivo) {
    return errorResponse(400, "VAL-002", "cNomeArquivo e cArquivo são obrigatórios", req, startMs);
  }

  const supabase = getSupabase();
  const empresaId = auth.empresaId || "default";

  // Decode base64 content
  let fileBytes: Uint8Array;
  try {
    const binaryStr = atob(cArquivo);
    fileBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      fileBytes[i] = binaryStr.charCodeAt(i);
    }
  } catch {
    return errorResponse(400, "VAL-003", "cArquivo não é um base64 válido", req, startMs);
  }

  // Validate MD5 if provided
  if (cMd5) {
    const computedMd5 = await computeMd5(fileBytes);
    if (computedMd5.toLowerCase() !== cMd5.toLowerCase()) {
      return errorResponse(400, "VAL-004", `MD5 não confere. Esperado: ${cMd5}, Calculado: ${computedMd5}`, req, startMs);
    }
  }

  // Upload to storage
  const storagePath = `${empresaId}/${cTabela}/${nId}/${Date.now()}_${cNomeArquivo}`;
  const { error: uploadError } = await supabase.storage
    .from("documento-anexos")
    .upload(storagePath, fileBytes, {
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return errorResponse(500, "STR-001", `Erro no upload: ${uploadError.message}`, req, startMs);
  }

  // Insert metadata
  const insertData: Record<string, unknown> = {
    empresa_id: empresaId,
    c_tabela: cTabela,
    n_id: nId,
    c_nome_arquivo: cNomeArquivo,
    c_tipo_arquivo: cTipoArquivo || null,
    c_md5: cMd5 || null,
    storage_path: storagePath,
    file_size: fileBytes.length,
    importado_api: true,
  };
  if (cCodIntAnexo) insertData.c_cod_int_anexo = cCodIntAnexo;

  const { data: inserted, error: insertError } = await supabase
    .from("documento_anexos")
    .insert(insertData)
    .select("id, n_id_anexo")
    .single();

  if (insertError) {
    // Cleanup uploaded file
    await supabase.storage.from("documento-anexos").remove([storagePath]);
    return errorResponse(500, "DB-001", `Erro ao registrar anexo: ${insertError.message}`, req, startMs);
  }

  return jsonResponse({
    cCodIntAnexo: cCodIntAnexo || "",
    cTabela,
    nId,
    nIdAnexo: inserted.n_id_anexo || 0,
    cNomeArquivo,
    cCodStatus: "0",
    cDesStatus: "Anexo incluído com sucesso!",
  }, 201, req, { startMs });
}

async function handleConsultar(req: Request, auth: any): Promise<Response> {
  const startMs = Date.now();
  const url = new URL(req.url);
  const cCodIntAnexo = url.searchParams.get("cCodIntAnexo");
  const cTabela = url.searchParams.get("cTabela");
  const nId = url.searchParams.get("nId");
  const nIdAnexo = url.searchParams.get("nIdAnexo");
  const cNomeArquivo = url.searchParams.get("cNomeArquivo");

  const supabase = getSupabase();
  let query = supabase.from("documento_anexos").select("*");

  if (cCodIntAnexo) query = query.eq("c_cod_int_anexo", cCodIntAnexo);
  if (cTabela) query = query.eq("c_tabela", cTabela);
  if (nId) query = query.eq("n_id", parseInt(nId));
  if (nIdAnexo) query = query.eq("n_id_anexo", parseInt(nIdAnexo));
  if (cNomeArquivo) query = query.eq("c_nome_arquivo", cNomeArquivo);

  const { data, error } = await query.maybeSingle();

  if (error) {
    return errorResponse(500, "DB-001", error.message, req, startMs);
  }
  if (!data) {
    return errorResponse(404, "NOT-001", "Anexo não encontrado", req, startMs);
  }

  return jsonResponse({
    cCodIntAnexo: data.c_cod_int_anexo || "",
    cTabela: data.c_tabela,
    nId: data.n_id,
    nIdAnexo: data.n_id_anexo || 0,
    cNomeArquivo: data.c_nome_arquivo || "",
    cTipoArquivo: data.c_tipo_arquivo || "",
    info: {
      dInc: data.created_at ? new Date(data.created_at).toLocaleDateString("pt-BR") : "",
      dAlt: data.updated_at ? new Date(data.updated_at).toLocaleDateString("pt-BR") : "",
      cImpAPI: data.importado_api ? "S" : "N",
    },
  }, 200, req, { startMs });
}

async function handleObter(req: Request, auth: any): Promise<Response> {
  const startMs = Date.now();
  const url = new URL(req.url);
  const cCodIntAnexo = url.searchParams.get("cCodIntAnexo");
  const nIdAnexo = url.searchParams.get("nIdAnexo");
  const cTabela = url.searchParams.get("cTabela");
  const nId = url.searchParams.get("nId");
  const cNomeArquivo = url.searchParams.get("cNomeArquivo");

  const supabase = getSupabase();
  let query = supabase.from("documento_anexos").select("*");

  if (cCodIntAnexo) query = query.eq("c_cod_int_anexo", cCodIntAnexo);
  if (nIdAnexo) query = query.eq("n_id_anexo", parseInt(nIdAnexo));
  if (cTabela) query = query.eq("c_tabela", cTabela);
  if (nId) query = query.eq("n_id", parseInt(nId));
  if (cNomeArquivo) query = query.eq("c_nome_arquivo", cNomeArquivo);

  const { data, error } = await query.maybeSingle();

  if (error) {
    return errorResponse(500, "DB-001", error.message, req, startMs);
  }
  if (!data || !data.storage_path) {
    return errorResponse(404, "NOT-001", "Anexo não encontrado", req, startMs);
  }

  // Generate signed URL (1h expiry)
  const expiresIn = 3600;
  const { data: signedData, error: signError } = await supabase.storage
    .from("documento-anexos")
    .createSignedUrl(data.storage_path, expiresIn);

  if (signError || !signedData?.signedUrl) {
    return errorResponse(500, "STR-002", "Erro ao gerar link de download", req, startMs);
  }

  const expirationDate = new Date(Date.now() + expiresIn * 1000);

  return jsonResponse({
    cCodIntAnexo: data.c_cod_int_anexo || "",
    cTabela: data.c_tabela,
    nId: data.n_id,
    nIdAnexo: data.n_id_anexo || 0,
    cNomeArquivo: data.c_nome_arquivo || "",
    cLinkDownload: signedData.signedUrl,
    dDtExpiracao: expirationDate.toLocaleDateString("pt-BR"),
    cCodStatus: "0",
    cDesStatus: "Link gerado com sucesso!",
  }, 200, req, { startMs });
}

async function handleListar(req: Request, auth: any): Promise<Response> {
  const startMs = Date.now();
  const url = new URL(req.url);
  const nPagina = parseInt(url.searchParams.get("nPagina") || "1");
  const nRegPorPagina = Math.min(parseInt(url.searchParams.get("nRegPorPagina") || "50"), 200);
  const nId = url.searchParams.get("nId");
  const cTabela = url.searchParams.get("cTabela");
  const dDtIncDe = url.searchParams.get("dDtIncDe");
  const dDtIncAte = url.searchParams.get("dDtIncAte");

  if (!nId || !cTabela) {
    return errorResponse(400, "VAL-001", "nId e cTabela são obrigatórios para listagem", req, startMs);
  }

  const supabase = getSupabase();
  const offset = (nPagina - 1) * nRegPorPagina;

  let query = supabase
    .from("documento_anexos")
    .select("*", { count: "exact" })
    .eq("c_tabela", cTabela)
    .eq("n_id", parseInt(nId))
    .order("created_at", { ascending: false })
    .range(offset, offset + nRegPorPagina - 1);

  if (dDtIncDe) query = query.gte("created_at", dDtIncDe);
  if (dDtIncAte) query = query.lte("created_at", dDtIncAte);

  const { data, error, count } = await query;

  if (error) {
    return errorResponse(500, "DB-001", error.message, req, startMs);
  }

  const totalRegistros = count || 0;
  const totalPaginas = Math.ceil(totalRegistros / nRegPorPagina);

  const listaAnexos = (data || []).map((a: any) => ({
    cCodIntAnexo: a.c_cod_int_anexo || "",
    cTipoArquivo: a.c_tipo_arquivo || "",
    nId: a.n_id,
    nIdAnexo: a.n_id_anexo || 0,
    cNomeArquivo: a.c_nome_arquivo || "",
    cTabela: a.c_tabela,
    info: {
      dInc: a.created_at ? new Date(a.created_at).toLocaleDateString("pt-BR") : "",
      dAlt: a.updated_at ? new Date(a.updated_at).toLocaleDateString("pt-BR") : "",
      cImpAPI: a.importado_api ? "S" : "N",
    },
  }));

  return jsonResponse({
    nPagina,
    nTotPaginas: totalPaginas,
    nRegistros: listaAnexos.length,
    nTotRegistros: totalRegistros,
    listaAnexos,
  }, 200, req, { startMs });
}

async function handleExcluir(req: Request, auth: any): Promise<Response> {
  const startMs = Date.now();
  const body = await req.json();
  const { cCodIntAnexo, cTabela, nId, nIdAnexo, cNomeArquivo } = body;

  const supabase = getSupabase();
  let query = supabase.from("documento_anexos").select("id, storage_path");

  if (cCodIntAnexo) query = query.eq("c_cod_int_anexo", cCodIntAnexo);
  if (cTabela) query = query.eq("c_tabela", cTabela);
  if (nId) query = query.eq("n_id", nId);
  if (nIdAnexo) query = query.eq("n_id_anexo", nIdAnexo);
  if (cNomeArquivo) query = query.eq("c_nome_arquivo", cNomeArquivo);

  const { data: anexo, error: findError } = await query.maybeSingle();

  if (findError) {
    return errorResponse(500, "DB-001", findError.message, req, startMs);
  }
  if (!anexo) {
    return errorResponse(404, "NOT-001", "Anexo não encontrado", req, startMs);
  }

  // Delete from storage
  if (anexo.storage_path) {
    await supabase.storage.from("documento-anexos").remove([anexo.storage_path]);
  }

  // Delete metadata
  const { error: deleteError } = await supabase
    .from("documento_anexos")
    .delete()
    .eq("id", anexo.id);

  if (deleteError) {
    return errorResponse(500, "DB-002", `Erro ao excluir: ${deleteError.message}`, req, startMs);
  }

  return jsonResponse({
    cCodIntAnexo: cCodIntAnexo || "",
    cTabela: cTabela || "",
    nId: nId || 0,
    nIdAnexo: nIdAnexo || 0,
    cNomeArquivo: cNomeArquivo || "",
    cCodStatus: "0",
    cDesStatus: "Anexo excluído com sucesso!",
  }, 200, req, { startMs });
}

function handleStatus(req: Request): Response {
  return jsonResponse({
    status: "online",
    service: "anexos-api",
    version: "1.0.0",
    endpoints: ["/incluir", "/consultar", "/obter", "/listar", "/excluir", "/status"],
  }, 200, req);
}

// === MAIN ROUTER ===
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/anexos-api")[1] || "/";

  try {
    // Health check — no auth required
    if (path === "/status" || path === "/") {
      return handleStatus(req);
    }

    // Authenticate
    const auth = await authenticate(req);

    // Route
    switch (path) {
      case "/incluir":
        if (req.method !== "POST") return errorResponse(405, "MTD-001", "Use POST para /incluir", req);
        return await handleIncluir(req, auth);

      case "/consultar":
        if (req.method !== "GET") return errorResponse(405, "MTD-001", "Use GET para /consultar", req);
        return await handleConsultar(req, auth);

      case "/obter":
        if (req.method !== "GET") return errorResponse(405, "MTD-001", "Use GET para /obter", req);
        return await handleObter(req, auth);

      case "/listar":
        if (req.method !== "GET") return errorResponse(405, "MTD-001", "Use GET para /listar", req);
        return await handleListar(req, auth);

      case "/excluir":
        if (req.method !== "DELETE") return errorResponse(405, "MTD-001", "Use DELETE para /excluir", req);
        return await handleExcluir(req, auth);

      default:
        return errorResponse(404, "ROUTE-001", `Rota não encontrada: ${path}`, req);
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, "AUTH-001", err.message, req);
    }
    console.error("[anexos-api] Unexpected error:", err);
    return errorResponse(500, "SRV-001", "Erro interno do servidor", req);
  }
});
