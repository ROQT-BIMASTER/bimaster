// projeto-copilot-salvar-relatorio
// Marca relatório como salvo (não expira) e/ou vincula a uma tarefa
// copiando o arquivo para o bucket projeto-anexos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const Body = z.object({
  relatorio_id: z.string().uuid(),
  salvo: z.boolean().optional(),
  nome_personalizado: z.string().min(1).max(200).optional(),
  tarefa_id: z.string().uuid().optional(),
}).strict();

export default secureHandler({ auth: "jwt", rateLimitPrefix: "copilot-salvar-relatorio", rateLimit: 30 },
  async (req, ctx) => {
    const corsHeaders = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { relatorio_id, salvo, nome_personalizado, tarefa_id } = parsed.data;
    const userId = ctx.userId!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Carrega relatório validando ownership
    const { data: rel, error: relErr } = await admin.from("projeto_copilot_relatorios")
      .select("id, user_id, projeto_id, storage_path, formato, tipo, nome_personalizado, salvo, metadata")
      .eq("id", relatorio_id).maybeSingle();
    if (relErr || !rel) {
      return new Response(JSON.stringify({ error: "Relatório não encontrado." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rel.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Sem permissão." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Toggle salvo + nome
    if (typeof salvo === "boolean" || nome_personalizado) {
      const { error: rpcErr } = await userClient.rpc("copilot_set_relatorio_salvo", {
        _relatorio_id: relatorio_id,
        _salvo: salvo ?? rel.salvo ?? false,
        _nome_personalizado: nome_personalizado ?? null,
      });
      if (rpcErr) {
        return new Response(JSON.stringify({ error: rpcErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let anexo_id: string | null = null;
    if (tarefa_id) {
      // Verifica acesso à tarefa via RLS (userClient)
      const { data: tarefa, error: tErr } = await userClient.from("projeto_tarefas")
        .select("id, projeto_id, titulo").eq("id", tarefa_id).maybeSingle();
      if (tErr || !tarefa) {
        return new Response(JSON.stringify({ error: "Tarefa inacessível." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (tarefa.projeto_id !== rel.projeto_id) {
        return new Response(JSON.stringify({ error: "Tarefa pertence a outro projeto." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Baixa do bucket projeto-relatorios e sobe em projeto-anexos sob caminho do user
      if (!rel.storage_path) {
        return new Response(JSON.stringify({ error: "Relatório sem arquivo." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: file, error: dlErr } = await admin.storage.from("projeto-relatorios").download(rel.storage_path);
      if (dlErr || !file) {
        return new Response(JSON.stringify({ error: "Falha ao ler relatório." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ext = rel.formato === "xlsx" ? "xlsx" : "pdf";
      const baseName = (nome_personalizado || rel.nome_personalizado || `relatorio-${rel.tipo || "copiloto"}`).replace(/[^a-zA-Z0-9_\-\. ]/g, "_");
      const fileName = `${baseName}.${ext}`;
      const path = `${userId}/copilot/${tarefa_id}/${Date.now()}-${fileName}`;
      const contentType = ext === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";
      const { error: upErr } = await admin.storage.from("projeto-anexos").upload(path, file, { contentType, upsert: false });
      if (upErr) {
        return new Response(JSON.stringify({ error: "Falha ao salvar na tarefa: " + upErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: anexo, error: anxErr } = await admin.from("projeto_tarefa_anexos").insert({
        tarefa_id, user_id: userId, nome: fileName, storage_path: path,
        tipo_arquivo: contentType, tamanho: file.size,
      }).select("id").single();
      if (anxErr) {
        return new Response(JSON.stringify({ error: "Falha ao registrar anexo: " + anxErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      anexo_id = anexo.id;

      // Cria vínculo (service role bypassa RLS)
      await admin.from("projeto_copilot_relatorio_tarefas").upsert({
        relatorio_id, tarefa_id, anexo_id, criado_por: userId,
      }, { onConflict: "relatorio_id,tarefa_id" });

      // Garante que o relatório fica salvo
      await admin.from("projeto_copilot_relatorios")
        .update({ salvo: true, expires_at: new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000).toISOString() })
        .eq("id", relatorio_id);
    }

    return new Response(JSON.stringify({ ok: true, anexo_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  });
