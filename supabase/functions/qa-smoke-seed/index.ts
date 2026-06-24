// supabase/functions/qa-smoke-seed/index.ts
//
// Seed isolado para o smoke E2E "Submissão → Projeto" (Fluxos 1 e 2).
//
// Segurança (5 camadas):
//   1. JWT obrigatório (secureHandler auth: "jwt")
//   2. Caller precisa ter role 'admin' (has_role)
//   3. Secret de ambiente QA_SMOKE_ENABLED=true precisa estar setada — sem
//      ela a função responde 403 em qualquer ambiente. Em produção,
//      simplesmente NÃO setar a secret = função inerte.
//   4. Rate limit 5/min por usuário
//   5. Rows criadas SEMPRE têm numero_ordem com prefixo 'QA_SMOKE_' — usado
//      pelo cleanup como filtro defensivo.
//
// Cria 1 submissão China carimbada com `runId` no `numero_ordem`. Retorna o
// id. O smoke executa Fluxos 1 e 2 reusando essa mesma submissão (com
// `substituir=true` no segundo clique do Fluxo 2 se necessário).

import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const Body = z.object({
  runId: z.string().min(8).max(48).regex(/^[a-zA-Z0-9_-]+$/),
  produtoNome: z.string().min(1).max(200).optional(),
}).strict();

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 5, rateLimitPrefix: "qa-smoke-seed" },
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

    const numeroOrdem = `QA_SMOKE_${runId}`;
    const produtoCodigo = `SMOKE-${runId}`;
    const produtoNome = parsed.data.produtoNome ?? `QA Smoke ${runId}`;

    const { data, error } = await sb
      .from("china_produto_submissoes")
      .insert({
        produto_codigo: produtoCodigo,
        produto_nome: produtoNome,
        numero_ordem: numeroOrdem,
        status: "rascunho",
        created_by: ctx.userId,
      })
      .select("id, produto_codigo, produto_nome, numero_ordem")
      .single();

    if (error) return json(500, { error: error.message });

    return json(200, { submissao: data, runId });
  },
));
