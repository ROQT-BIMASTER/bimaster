import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { validateApiKey, AuthError } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

function json(body: unknown, status: number, req: Request, startMs: number) {
  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json" },
    status === 401 || status === 403
  );
  const meta = { processed_at: new Date().toISOString(), duration_ms: Date.now() - startMs };
  const responseBody = typeof body === "object" && body !== null && !Array.isArray(body)
    ? { ...body as Record<string, unknown>, meta }
    : { data: body, meta };
  return new Response(JSON.stringify(responseBody), { status, headers });
}

function errorResp(status: number, code: string, message: string, req: Request, startMs: number) {
  return json({ error: code, message }, status, req, startMs);
}

// Map DB row to Omie-style response
function rowToOmie(row: any, parentCode?: string): any {
  return {
    codigo: row.code,
    descricao: row.name,
    descricao_padrao: row.descricao_padrao || "",
    tipo_categoria: row.tipo_categoria || "",
    conta_inativa: row.is_active ? "N" : "S",
    definida_pelo_usuario: row.definida_pelo_usuario || "S",
    id_conta_contabil: row.id_conta_contabil || 0,
    tag_conta_contabil: row.tag_conta_contabil || "",
    conta_despesa: (row.account_type === "expense" || row.account_type === "cost_center") ? "S" : "N",
    conta_receita: row.account_type === "revenue" ? "S" : "N",
    nao_exibir: row.nao_exibir || "N",
    natureza: row.description || "",
    totalizadora: row.is_group ? "S" : "N",
    transferencia: row.transferencia || "N",
    codigo_dre: row.codigo_dre || "",
    categoria_superior: parentCode || "",
    dadosDRE: {
      codigoDRE: row.codigo_dre || "",
      descricaoDRE: row.categoria_dre || "",
      naoExibirDRE: "N",
      nivelDRE: 0,
      sinalDRE: "",
      totalizaDRE: "N",
    },
  };
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/categorias-api\/?/, "/").replace(/\/+$/, "") || "/";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // --- Health check (no auth) ---
  if (req.method === "GET" && (path === "/status" || path === "/")) {
    return json({ status: "online", service: "categorias-api", timestamp: new Date().toISOString() }, 200, req, startMs);
  }

  // --- Authenticate ---
  let empresaId: string;
  try {
    const auth = await validateApiKey(req);
    empresaId = auth.empresaId;
  } catch (e) {
    if (e instanceof AuthError) return errorResp(e.status, "UNAUTHORIZED", e.message, req, startMs);
    throw e;
  }

  // --- Rate limit ---
  try {
    await checkRateLimit({ prefix: "categorias", limit: 60, req });
  } catch (e) {
    if (e instanceof RateLimitError) return errorResp(429, "RATE_LIMIT", e.message, req, startMs);
    throw e;
  }

  try {
    // ==================== POST /incluir ====================
    if (req.method === "POST" && path === "/incluir") {
      const body = await req.json();
      const { descricao, tipo_categoria, natureza, codigo_dre, categoria_superior } = body;

      if (!descricao) return errorResp(400, "VALIDATION", "Campo 'descricao' é obrigatório", req, startMs);

      // Resolve parent
      let parentId: string | null = null;
      if (categoria_superior) {
        const { data: parent } = await supabase
          .from("trade_chart_of_accounts").select("id").eq("code", categoria_superior).maybeSingle();
        if (!parent) return errorResp(404, "NOT_FOUND", `Categoria superior '${categoria_superior}' não encontrada`, req, startMs);
        parentId = parent.id;
      }

      // Generate code
      const code = body.codigo || `CAT-${Date.now()}`;

      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .insert({
          code,
          name: descricao,
          description: natureza || null,
          account_type: tipo_categoria === "R" ? "revenue" : tipo_categoria === "D" ? "expense" : tipo_categoria || "expense",
          tipo_categoria: tipo_categoria || null,
          codigo_dre: codigo_dre || null,
          parent_account_id: parentId,
          is_active: true,
          is_group: false,
        })
        .select("code")
        .single();

      if (error) return errorResp(500, "DB_ERROR", error.message, req, startMs);

      return json({
        codigo: data.code,
        codigo_status: "0",
        descricao_status: "Categoria incluída com sucesso!",
      }, 201, req, startMs);
    }

    // ==================== POST /incluir-grupo ====================
    if (req.method === "POST" && path === "/incluir-grupo") {
      const body = await req.json();
      const { descricao, tipo_grupo, natureza } = body;

      if (!descricao) return errorResp(400, "VALIDATION", "Campo 'descricao' é obrigatório", req, startMs);

      const accountType = tipo_grupo === "R" ? "revenue" : "expense";
      const code = body.codigo || `GRP-${Date.now()}`;

      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .insert({
          code,
          name: descricao,
          description: natureza || null,
          account_type: accountType,
          is_active: true,
          is_group: true,
        })
        .select("code")
        .single();

      if (error) return errorResp(500, "DB_ERROR", error.message, req, startMs);

      return json({
        codigo: data.code,
        codigo_status: "0",
        descricao_status: "Grupo de categoria incluído com sucesso!",
      }, 201, req, startMs);
    }

    // ==================== POST /alterar ====================
    if (req.method === "POST" && path === "/alterar") {
      const body = await req.json();
      const { codigo, descricao, natureza, tipo_categoria, codigo_dre, conta_inativa } = body;

      if (!codigo) return errorResp(400, "VALIDATION", "Campo 'codigo' é obrigatório", req, startMs);

      const updates: Record<string, unknown> = {};
      if (descricao !== undefined) updates.name = descricao;
      if (natureza !== undefined) updates.description = natureza;
      if (tipo_categoria !== undefined) {
        updates.tipo_categoria = tipo_categoria;
        updates.account_type = tipo_categoria === "R" ? "revenue" : tipo_categoria === "D" ? "expense" : tipo_categoria;
      }
      if (codigo_dre !== undefined) updates.codigo_dre = codigo_dre;
      if (conta_inativa !== undefined) updates.is_active = conta_inativa !== "S";

      if (Object.keys(updates).length === 0) return errorResp(400, "VALIDATION", "Nenhum campo para alterar", req, startMs);

      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .update(updates)
        .eq("code", codigo)
        .select("code, name")
        .single();

      if (error) return errorResp(500, "DB_ERROR", error.message, req, startMs);
      if (!data) return errorResp(404, "NOT_FOUND", `Categoria '${codigo}' não encontrada`, req, startMs);

      return json({
        codigo: data.code,
        descricao: data.name,
        codigo_status: "0",
        descricao_status: "Categoria alterada com sucesso!",
      }, 200, req, startMs);
    }

    // ==================== POST /alterar-grupo ====================
    if (req.method === "POST" && path === "/alterar-grupo") {
      const body = await req.json();
      const { codigo, descricao, natureza } = body;

      if (!codigo) return errorResp(400, "VALIDATION", "Campo 'codigo' é obrigatório", req, startMs);

      const updates: Record<string, unknown> = {};
      if (descricao !== undefined) updates.name = descricao;
      if (natureza !== undefined) updates.description = natureza;

      if (Object.keys(updates).length === 0) return errorResp(400, "VALIDATION", "Nenhum campo para alterar", req, startMs);

      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .update(updates)
        .eq("code", codigo)
        .eq("is_group", true)
        .select("code, name")
        .single();

      if (error) return errorResp(500, "DB_ERROR", error.message, req, startMs);
      if (!data) return errorResp(404, "NOT_FOUND", `Grupo '${codigo}' não encontrado`, req, startMs);

      return json({
        codigo: data.code,
        descricao: data.name,
        codigo_status: "0",
        descricao_status: "Grupo alterado com sucesso!",
      }, 200, req, startMs);
    }

    // ==================== POST /consultar ====================
    if (req.method === "POST" && path === "/consultar") {
      const body = await req.json();
      const { codigo } = body;

      if (!codigo) return errorResp(400, "VALIDATION", "Campo 'codigo' é obrigatório", req, startMs);

      const { data, error } = await supabase
        .from("trade_chart_of_accounts")
        .select("*, parent:parent_account_id(code)")
        .eq("code", codigo)
        .maybeSingle();

      if (error) return errorResp(500, "DB_ERROR", error.message, req, startMs);
      if (!data) return errorResp(404, "NOT_FOUND", `Categoria '${codigo}' não encontrada`, req, startMs);

      const parentCode = (data as any).parent?.code || "";
      return json({ categoria_cadastro: rowToOmie(data, parentCode) }, 200, req, startMs);
    }

    // ==================== POST /listar ====================
    if (req.method === "POST" && path === "/listar") {
      const body = await req.json().catch(() => ({}));
      const pagina = Math.max(1, body.pagina || 1);
      const registros = Math.min(500, Math.max(1, body.registros_por_pagina || 50));
      const offset = (pagina - 1) * registros;

      let query = supabase
        .from("trade_chart_of_accounts")
        .select("*, parent:parent_account_id(code)", { count: "exact" });

      // Filters
      if (body.filtrar_apenas_ativo === "S") {
        query = query.eq("is_active", true);
      }
      if (body.filtrar_por_tipo === "R") {
        query = query.eq("account_type", "revenue");
      } else if (body.filtrar_por_tipo === "D") {
        query = query.in("account_type", ["expense", "cost_center"]);
      }

      query = query.order("code", { ascending: true }).range(offset, offset + registros - 1);

      const { data, count, error } = await query;

      if (error) return errorResp(500, "DB_ERROR", error.message, req, startMs);

      const total = count || 0;
      const categorias = (data || []).map((row: any) => {
        const parentCode = row.parent?.code || "";
        return rowToOmie(row, parentCode);
      });

      return json({
        pagina,
        total_de_paginas: Math.ceil(total / registros),
        registros: categorias.length,
        total_de_registros: total,
        categoria_cadastro: categorias,
      }, 200, req, startMs);
    }

    // ==================== 404 ====================
    return errorResp(404, "NOT_FOUND", `Rota ${req.method} ${path} não encontrada`, req, startMs);
  } catch (err: any) {
    return errorResp(500, "INTERNAL_ERROR", err.message || "Erro interno", req, startMs);
  }
});
