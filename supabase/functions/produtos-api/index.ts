// produtos-api — CRUD de produtos da fábrica
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const route = pathParts[pathParts.length - 1] || "";

    // Health check (no auth)
    if (req.method === "GET" && route === "status") {
      return jsonResponse({ status: "ok", service: "produtos-api" }, 200, req, { startMs });
    }

    // Authenticate
    const auth = await validateAnyAuth(req);
    const userId = auth.userId;

    // Rate limit
    await checkRateLimit({ prefix: "produtos", limit: 60, req, userId });

    const produtoId = route !== "produtos-api" ? route : undefined;

    // GET — Listar todos ou buscar por ID
    if (req.method === "GET") {
      if (produtoId && produtoId !== "status") {
        const { data, error } = await supabase
          .from("fabrica_produtos")
          .select("*, formula:formula_id(id, versao), unidade:unidade_medida_id(sigla, nome)")
          .eq("id", produtoId)
          .single();
        if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
        return jsonResponse({ success: true, data }, 200, req, { startMs });
      }

      const tipo = url.searchParams.get("tipo");
      let query = supabase
        .from("fabrica_produtos")
        .select("*, formula:formula_id(id, versao), unidade:unidade_medida_id(sigla, nome)")
        .order("nome");
      if (tipo) query = query.eq("tipo", tipo);

      const { data, error } = await query;
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);
      return jsonResponse({ success: true, data }, 200, req, { startMs });
    }

    // POST — Criar novo produto
    if (req.method === "POST") {
      const body = await req.json();
      if (!body.codigo || !body.nome) {
        return errorResponse(400, "VALIDATION", "Código e nome são obrigatórios", req, startMs);
      }
      if (body.tipo === "ACABADO" && !body.formula_id) {
        return errorResponse(400, "VALIDATION", "Produto acabado deve ter uma fórmula vinculada", req, startMs);
      }

      const payload = {
        codigo: body.codigo.trim().toUpperCase(),
        nome: body.nome.trim(),
        descricao: body.descricao?.trim() || null,
        tipo: body.tipo || "ACABADO",
        formula_id: body.formula_id || null,
        unidade_medida_id: body.unidade_medida_id || null,
        tempo_producao_minutos: body.tempo_producao_minutos || null,
        rendimento: body.rendimento || null,
        foto_url: body.foto_url?.trim() || null,
        ativo: body.ativo ?? true,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from("fabrica_produtos")
        .insert([payload])
        .select()
        .single();
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      return jsonResponse({ success: true, data, message: "Produto criado com sucesso" }, 201, req, { startMs });
    }

    // PUT — Atualizar produto
    if (req.method === "PUT" && produtoId) {
      const body = await req.json();
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (body.codigo !== undefined) payload.codigo = body.codigo.trim().toUpperCase();
      if (body.nome !== undefined) payload.nome = body.nome.trim();
      if (body.descricao !== undefined) payload.descricao = body.descricao?.trim() || null;
      if (body.tipo !== undefined) payload.tipo = body.tipo;
      if (body.formula_id !== undefined) payload.formula_id = body.formula_id || null;
      if (body.unidade_medida_id !== undefined) payload.unidade_medida_id = body.unidade_medida_id || null;
      if (body.tempo_producao_minutos !== undefined) payload.tempo_producao_minutos = body.tempo_producao_minutos || null;
      if (body.rendimento !== undefined) payload.rendimento = body.rendimento || null;
      if (body.foto_url !== undefined) payload.foto_url = body.foto_url?.trim() || null;
      if (body.ativo !== undefined) payload.ativo = body.ativo;

      const { data, error } = await supabase
        .from("fabrica_produtos")
        .update(payload)
        .eq("id", produtoId)
        .select()
        .single();
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      return jsonResponse({ success: true, data, message: "Produto atualizado com sucesso" }, 200, req, { startMs });
    }

    // DELETE — Deletar produto
    if (req.method === "DELETE" && produtoId) {
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (!userRole || !["admin", "supervisor"].includes(userRole.role)) {
        return errorResponse(403, "FORBIDDEN", "Acesso negado - apenas administradores", req, startMs);
      }

      const { error } = await supabase
        .from("fabrica_produtos")
        .delete()
        .eq("id", produtoId);
      if (error) return errorResponse(500, "DB_ERROR", error.message, req, startMs);

      return jsonResponse({ success: true, message: "Produto deletado com sucesso" }, 200, req, { startMs });
    }

    return errorResponse(405, "METHOD_NOT_ALLOWED", "Método não suportado", req, startMs);
  } catch (err) {
    if (err instanceof RateLimitError) return errorResponse(429, "RATE_LIMIT", err.message, req, startMs);
    if (err instanceof AuthError) return errorResponse(err.status, "AUTH_ERROR", err.message, req, startMs);
    console.error("❌ produtos-api error:", err);
    return errorResponse(500, "INTERNAL_ERROR", err instanceof Error ? err.message : "Erro desconhecido", req, startMs);
  }
});
