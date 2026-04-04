// projetos-api
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { validateAnyAuth } from "../_shared/auth.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { enqueueWebhookEvent } from "../_shared/webhook-enqueue.ts";
import { wafCheck, wafBlockResponse } from "../_shared/waf.ts";

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "";
  return String(d).substring(0, 10);
}

function formatTime(d: string | null): string {
  if (!d) return "";
  return String(d).substring(11, 19);
}

function mapRowToHuggs(row: Record<string, unknown>): Record<string, unknown> {
  return {
    codigo: row.id || "",
    codInt: row.codigo_integracao || "",
    nome: row.nome || "",
    inativo: row.status === "finalizado" ? "S" : "N",
    info: {
      data_inc: formatDate(row.created_at as string | null),
      hora_inc: formatTime(row.created_at as string | null),
      user_inc: "",
      data_alt: formatDate(row.updated_at as string | null),
      hora_alt: formatTime(row.updated_at as string | null),
      user_alt: "",
    },
  };
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function findProjeto(supabase: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const codigo = body.codigo as string | undefined;
  const codInt = body.codInt as string | undefined;

  if (codigo) {
    const { data } = await supabase.from("projetos").select("*").eq("id", codigo).maybeSingle();
    return data;
  }
  if (codInt) {
    const { data } = await supabase.from("projetos").select("*").eq("codigo_integracao", codInt).maybeSingle();
    return data;
  }
  return null;
}

function statusResponse(row: Record<string, unknown>, status: string, descricao: string) {
  return {
    codigo: row.id || "",
    codInt: row.codigo_integracao || "",
    status,
    descricao,
  };
}

// ── Router ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/projetos-api/, "").replace(/\/$/, "") || "/";

  // Health check
  if (req.method === "GET" && path === "/status") {
    return jsonResponse({ status: "ok", service: "projetos-api", timestamp: new Date().toISOString() }, 200, req, { startMs });
  }

  try {
    // Auth
    const { empresaId } = await validateAnyAuth(req);
    await checkRateLimit({ prefix: "projetos", limit: 60, req });
    const supabase = getSupabase();

    if (req.method !== "POST") {
      return errorResponse(405, "method_not_allowed", "Apenas POST é aceito", req, startMs);
    }

    const body = (await req.json()) as Record<string, unknown>;

    // ── POST /incluir ────────────────────────────────────────
    if (path === "/incluir") {
      const codInt = body.codInt as string | undefined;
      const nome = body.nome as string | undefined;
      if (!codInt || !nome) {
        return errorResponse(400, "campos_obrigatorios", "codInt e nome são obrigatórios", req, startMs);
      }

      const inativo = (body.inativo as string) === "S";
      const { data, error } = await supabase.from("projetos").insert({
        nome,
        codigo_integracao: codInt,
        status: inativo ? "finalizado" : "em_andamento",
        criador_id: "00000000-0000-0000-0000-000000000000",
      }).select().single();

      if (error) {
        if (error.code === "23505") {
          return errorResponse(409, "duplicado", "Projeto com este codInt já existe", req, startMs);
        }
        throw error;
      }

      enqueueWebhookEvent("projeto.criado", { id: data.id, nome: data.nome, codInt: data.codigo_integracao });
      return jsonResponse(statusResponse(data, "0", "Projeto incluído com sucesso!"), 201, req, { startMs });
    }

    // ── POST /alterar ────────────────────────────────────────
    if (path === "/alterar") {
      const existing = await findProjeto(supabase, body);
      if (!existing) {
        return errorResponse(404, "nao_encontrado", "Projeto não encontrado", req, startMs);
      }

      const updates: Record<string, unknown> = {};
      if (body.nome !== undefined) updates.nome = body.nome;
      if (body.inativo !== undefined) updates.status = body.inativo === "S" ? "finalizado" : "em_andamento";
      if (body.codInt !== undefined) updates.codigo_integracao = body.codInt;

      if (Object.keys(updates).length === 0) {
        return errorResponse(400, "sem_alteracoes", "Nenhum campo para alterar", req, startMs);
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase.from("projetos").update(updates).eq("id", existing.id).select().single();
      if (error) throw error;

      enqueueWebhookEvent("projeto.alterado", { id: data.id, nome: data.nome, codInt: data.codigo_integracao });
      return jsonResponse(statusResponse(data, "0", "Projeto alterado com sucesso!"), 200, req, { startMs });
    }

    // ── POST /consultar ──────────────────────────────────────
    if (path === "/consultar") {
      const existing = await findProjeto(supabase, body);
      if (!existing) {
        return errorResponse(404, "nao_encontrado", "Projeto não encontrado", req, startMs);
      }
      return jsonResponse(mapRowToHuggs(existing), 200, req, { startMs });
    }

    // ── POST /excluir ────────────────────────────────────────
    if (path === "/excluir") {
      const existing = await findProjeto(supabase, body);
      if (!existing) {
        return errorResponse(404, "nao_encontrado", "Projeto não encontrado", req, startMs);
      }

      const { data, error } = await supabase.from("projetos").update({ status: "finalizado", updated_at: new Date().toISOString() }).eq("id", existing.id).select().single();
      if (error) throw error;

      return jsonResponse(statusResponse(data, "0", "Projeto excluído com sucesso!"), 200, req, { startMs });
    }

    // ── POST /listar ─────────────────────────────────────────
    if (path === "/listar") {
      const pagina = Math.max(1, Number(body.pagina) || 1);
      const registros = Math.min(500, Math.max(1, Number(body.registros_por_pagina) || 50));
      const offset = (pagina - 1) * registros;

      let query = supabase.from("projetos").select("*", { count: "exact" });

      // Filtros
      if (body.nome_projeto) {
        query = query.ilike("nome", `%${body.nome_projeto}%`);
      }
      if (body.filtrar_por_data_de) {
        query = query.gte("updated_at", body.filtrar_por_data_de);
      }
      if (body.filtrar_por_data_ate) {
        query = query.lte("updated_at", body.filtrar_por_data_ate);
      }
      if (body.apenas_importado_api === "S") {
        query = query.not("codigo_integracao", "is", null);
      }

      // Ordenação
      const ordenarPor = (body.ordenar_por as string) || "nome";
      const colMap: Record<string, string> = { nome: "nome", codigo: "id", data_inc: "created_at", data_alt: "updated_at" };
      const col = colMap[ordenarPor] || "nome";
      const desc = body.ordem_descrescente === "S";
      query = query.order(col, { ascending: !desc });

      query = query.range(offset, offset + registros - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      const total = count || 0;
      return jsonResponse({
        pagina,
        total_de_paginas: Math.ceil(total / registros),
        registros: data?.length || 0,
        total_de_registros: total,
        cadastro: (data || []).map(mapRowToHuggs),
      }, 200, req, { startMs });
    }

    // ── POST /upsert ─────────────────────────────────────────
    if (path === "/upsert") {
      const codInt = body.codInt as string | undefined;
      const nome = body.nome as string | undefined;
      if (!codInt) {
        return errorResponse(400, "campos_obrigatorios", "codInt é obrigatório", req, startMs);
      }

      const existing = await findProjeto(supabase, { codInt });

      if (existing) {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (nome !== undefined) updates.nome = nome;
        if (body.inativo !== undefined) updates.status = body.inativo === "S" ? "finalizado" : "em_andamento";

        const { data, error } = await supabase.from("projetos").update(updates).eq("id", existing.id).select().single();
        if (error) throw error;
        return jsonResponse(statusResponse(data, "0", "Projeto alterado com sucesso!"), 200, req, { startMs });
      }

      if (!nome) {
        return errorResponse(400, "campos_obrigatorios", "nome é obrigatório para inclusão", req, startMs);
      }

      const inativo = (body.inativo as string) === "S";
      const { data, error } = await supabase.from("projetos").insert({
        nome,
        codigo_integracao: codInt,
        status: inativo ? "finalizado" : "em_andamento",
        criador_id: "00000000-0000-0000-0000-000000000000",
      }).select().single();
      if (error) throw error;

      return jsonResponse(statusResponse(data, "0", "Projeto incluído com sucesso!"), 201, req, { startMs });
    }

    return errorResponse(404, "rota_nao_encontrada", `Rota ${path} não encontrada`, req, startMs);
  } catch (err) {
    console.error("projetos-api error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    const status = (err as { status?: number }).status || 500;
    return errorResponse(status, "erro", message, req, startMs);
  }
});
