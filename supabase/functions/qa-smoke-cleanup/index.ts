// supabase/functions/qa-smoke-cleanup/index.ts
//
// Cleanup do smoke E2E "Submissão → Projeto".
//
// Segurança (mesmas 5 camadas do seed) + DELETE blindado:
//   - SÓ deleta linhas onde numero_ordem LIKE 'QA_SMOKE_%' (defensivo).
//   - SÓ deleta projetos vinculados a submissões QA_SMOKE_* (nunca toca
//     em dados reais).
//   - Aceita runId opcional para deletar APENAS aquele run. Sem runId,
//     deleta tudo com prefixo QA_SMOKE_ (uso emergencial — varredura
//     periódica em staging).
//
// Cascades aproveitadas:
//   - china_produto_submissoes → documentos, cores, china_submissao_projetos
//     todos com ON DELETE CASCADE.
//   - projetos → projeto_secoes, projeto_tarefas etc. via cascades existentes.

import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const Body = z.object({
  runId: z.string().min(8).max(48).regex(/^[a-zA-Z0-9_-]+$/).optional(),
}).strict();

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 5, rateLimitPrefix: "qa-smoke-cleanup" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (Deno.env.get("QA_SMOKE_ENABLED") !== "true") {
      return json(403, { error: "QA smoke disabled in this environment" });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isAdmin, error: roleErr } = await sb.rpc("has_role", {
      _user_id: ctx.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return json(403, { error: "admin role required" });
    }

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return json(400, { error: parsed.error.flatten() });
    }
    const { runId } = parsed.data;

    // 1) Localiza as submissões QA_SMOKE_* (com filtro de runId se houver)
    const ordemFilter = runId ? `QA_SMOKE_${runId}` : null;
    const subQ = sb
      .from("china_produto_submissoes")
      .select("id, numero_ordem")
      .like("numero_ordem", "QA_SMOKE_%");

    const { data: submissoes, error: subErr } = ordemFilter
      ? await subQ.eq("numero_ordem", ordemFilter)
      : await subQ;

    if (subErr) return json(500, { error: subErr.message });
    if (!submissoes || submissoes.length === 0) {
      return json(200, { deleted: { submissoes: 0, projetos: 0 }, runId: runId ?? null });
    }

    const submissaoIds = submissoes.map((s) => s.id);

    // 2) Coleta projetos vinculados (para apagá-los junto)
    const { data: vinculos, error: vincErr } = await sb
      .from("china_submissao_projetos")
      .select("projeto_id, submissao_id")
      .in("submissao_id", submissaoIds);
    if (vincErr) return json(500, { error: vincErr.message });

    const projetoIds = Array.from(new Set((vinculos ?? []).map((v) => v.projeto_id)));

    // 3) Deleta as submissões (cascade derruba documentos, cores e o link)
    const { error: delSubErr } = await sb
      .from("china_produto_submissoes")
      .delete()
      .in("id", submissaoIds);
    if (delSubErr) return json(500, { error: delSubErr.message });

    // 4) Deleta os projetos vinculados — defensivo: só toca em projetos que
    //    estavam linkados a uma submissão QA_SMOKE_*.
    let projetosDeleted = 0;
    if (projetoIds.length > 0) {
      const { error: delProjErr, count } = await sb
        .from("projetos")
        .delete({ count: "exact" })
        .in("id", projetoIds);
      if (delProjErr) return json(500, { error: delProjErr.message });
      projetosDeleted = count ?? projetoIds.length;
    }

    return json(200, {
      deleted: { submissoes: submissaoIds.length, projetos: projetosDeleted },
      runId: runId ?? null,
    });
  },
));
