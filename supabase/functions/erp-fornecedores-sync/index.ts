import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { validateJWT, AuthError } from "../_shared/auth.ts";
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

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const startMs = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/erp-fornecedores-sync\/?/, "/").replace(/\/+$/, "") || "/";

  if (req.method !== "POST") {
    return errorResp(405, "METHOD_NOT_ALLOWED", "Apenas POST é permitido", req, startMs);
  }

  // Authenticate via JWT
  let userId: string;
  try {
    const auth = await validateJWT(req);
    userId = auth.userId;
  } catch (e) {
    if (e instanceof AuthError) return errorResp(e.status, "UNAUTHORIZED", e.message, req, startMs);
    throw e;
  }

  // Rate limit
  try {
    await checkRateLimit({ prefix: "erp-forn-sync", limit: 30, req });
  } catch (e) {
    if (e instanceof RateLimitError) return errorResp(429, "RATE_LIMIT", e.message, req, startMs);
    throw e;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResp(400, "INVALID_JSON", "Corpo da requisição inválido", req, startMs);
  }

  const cnpj = (body.cnpj || "").replace(/\D/g, "");
  if (!cnpj || cnpj.length !== 14) {
    return errorResp(400, "INVALID_CNPJ", "CNPJ deve ter 14 dígitos", req, startMs);
  }

  try {
    // ==================== POST /check ====================
    if (path === "/check") {
      // Check if supplier exists in ERP (erp_config-based API)
      const { data: erpConfig } = await supabase
        .from("erp_config")
        .select("config_value")
        .eq("config_key", "api_url")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      const { data: erpApiKey } = await supabase
        .from("erp_config")
        .select("config_value")
        .eq("config_key", "api_key")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (!erpConfig?.config_value || !erpApiKey?.config_value) {
        // No ERP configured, check local only
        const { data: localForn } = await supabase
          .from("fornecedores")
          .select("id, cnpj, erp_code, razao_social, nome")
          .eq("cnpj", cnpj)
          .maybeSingle();

        return json({
          found_in_erp: false,
          found_locally: !!localForn,
          erp_code: localForn?.erp_code || null,
          fornecedor_id: localForn?.id || null,
          message: "ERP não configurado — verificação local apenas",
        }, 200, req, startMs);
      }

      // Call ERP API to check supplier by CNPJ
      const erpBaseUrl = erpConfig.config_value.replace(/\/$/, "");
      try {
        const erpResponse = await fetch(`${erpBaseUrl}/fornecedores/consultar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": erpApiKey.config_value,
          },
          body: JSON.stringify({ cnpj }),
        });

        if (erpResponse.ok) {
          const erpData = await erpResponse.json();
          const erpCode = erpData?.codigo_fornecedor || erpData?.erp_code || null;

          // Update local record if exists
          if (erpCode) {
            await supabase
              .from("fornecedores")
              .update({ erp_code: String(erpCode), erp_synced_at: new Date().toISOString() })
              .eq("cnpj", cnpj);
          }

          return json({
            found_in_erp: true,
            erp_code: erpCode,
            erp_data: erpData,
            message: "Fornecedor encontrado no ERP",
          }, 200, req, startMs);
        }

        if (erpResponse.status === 404) {
          return json({
            found_in_erp: false,
            erp_code: null,
            message: "Fornecedor não encontrado no ERP",
          }, 200, req, startMs);
        }

        const errText = await erpResponse.text();
        console.error("ERP check error:", erpResponse.status, errText);
        return json({
          found_in_erp: false,
          erp_code: null,
          erp_error: `ERP retornou status ${erpResponse.status}`,
          message: "Erro ao consultar ERP — prossiga com cadastro local",
        }, 200, req, startMs);
      } catch (fetchErr) {
        console.error("ERP fetch error:", fetchErr);
        return json({
          found_in_erp: false,
          erp_code: null,
          erp_error: "Não foi possível conectar ao ERP",
          message: "ERP indisponível — prossiga com cadastro local",
        }, 200, req, startMs);
      }
    }

    // ==================== POST /sync ====================
    if (path === "/sync") {
      const fornecedorId = body.fornecedor_id;
      if (!fornecedorId) {
        return errorResp(400, "MISSING_ID", "fornecedor_id é obrigatório para sync", req, startMs);
      }

      // Get local supplier data
      const { data: localForn, error: localErr } = await supabase
        .from("fornecedores")
        .select("*")
        .eq("id", fornecedorId)
        .maybeSingle();

      if (localErr || !localForn) {
        return errorResp(404, "NOT_FOUND", "Fornecedor não encontrado localmente", req, startMs);
      }

      // If already has erp_code, return it
      if (localForn.erp_code) {
        return json({
          synced: true,
          erp_code: localForn.erp_code,
          message: "Fornecedor já possui código ERP",
        }, 200, req, startMs);
      }

      // Get ERP config
      const { data: erpConfig } = await supabase
        .from("erp_config")
        .select("config_value")
        .eq("config_key", "api_url")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      const { data: erpApiKey } = await supabase
        .from("erp_config")
        .select("config_value")
        .eq("config_key", "api_key")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (!erpConfig?.config_value || !erpApiKey?.config_value) {
        // Log sync attempt but skip ERP
        await supabase.from("erp_sync_log").insert({
          entity_type: "fornecedor",
          entity_id: fornecedorId,
          action: "sync_cadastro",
          direction: "outbound",
          sync_status: "erro",
          tabela_origem: "fornecedores",
          registro_id: fornecedorId,
          operacao: "inclusao",
          error_message: "ERP não configurado",
        });

        return json({
          synced: false,
          erp_code: null,
          message: "ERP não configurado — fornecedor salvo apenas localmente",
        }, 200, req, startMs);
      }

      // Send to ERP
      const erpBaseUrl = erpConfig.config_value.replace(/\/$/, "");
      const erpPayload = {
        cnpj: localForn.cnpj,
        razao_social: localForn.razao_social || localForn.nome,
        nome_fantasia: localForn.nome_fantasia || localForn.nome,
        email: localForn.email,
        telefone: localForn.telefone,
        endereco: localForn.endereco,
        bairro: localForn.bairro,
        cidade: localForn.cidade,
        estado: localForn.estado,
        cep: localForn.cep,
        inscricao_estadual: localForn.inscricao_estadual,
      };

      try {
        const erpResponse = await fetch(`${erpBaseUrl}/fornecedores/incluir`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": erpApiKey.config_value,
          },
          body: JSON.stringify(erpPayload),
        });

        const erpData = await erpResponse.json().catch(() => ({}));
        const erpCode = erpData?.codigo_fornecedor || erpData?.erp_code || null;

        if (erpResponse.ok && erpCode) {
          // Update local with ERP code
          await supabase
            .from("fornecedores")
            .update({
              erp_code: String(erpCode),
              erp_synced_at: new Date().toISOString(),
            })
            .eq("id", fornecedorId);

          // Log success
          await supabase.from("erp_sync_log").insert({
            entity_type: "fornecedor",
            entity_id: fornecedorId,
            action: "sync_cadastro",
            direction: "outbound",
            sync_status: "sucesso",
            tabela_origem: "fornecedores",
            registro_id: fornecedorId,
            operacao: "inclusao",
            response_payload: erpData,
          });

          return json({
            synced: true,
            erp_code: String(erpCode),
            message: "Fornecedor cadastrado no ERP com sucesso",
          }, 200, req, startMs);
        }

        // ERP returned error
        await supabase.from("erp_sync_log").insert({
          entity_type: "fornecedor",
          entity_id: fornecedorId,
          action: "sync_cadastro",
          direction: "outbound",
          sync_status: "erro",
          tabela_origem: "fornecedores",
          registro_id: fornecedorId,
          operacao: "inclusao",
          error_message: erpData?.message || `ERP status ${erpResponse.status}`,
          response_payload: erpData,
        });

        return json({
          synced: false,
          erp_code: null,
          erp_error: erpData?.message || `ERP retornou status ${erpResponse.status}`,
          message: "Fornecedor salvo localmente, mas falhou no ERP. Tente sincronizar depois.",
        }, 200, req, startMs);
      } catch (fetchErr: any) {
        await supabase.from("erp_sync_log").insert({
          entity_type: "fornecedor",
          entity_id: fornecedorId,
          action: "sync_cadastro",
          direction: "outbound",
          sync_status: "erro",
          tabela_origem: "fornecedores",
          registro_id: fornecedorId,
          operacao: "inclusao",
          error_message: fetchErr.message || "Conexão com ERP falhou",
        });

        return json({
          synced: false,
          erp_code: null,
          erp_error: "Não foi possível conectar ao ERP",
          message: "Fornecedor salvo localmente. ERP indisponível.",
        }, 200, req, startMs);
      }
    }

    return errorResp(404, "NOT_FOUND", `Rota ${path} não encontrada`, req, startMs);
  } catch (err: any) {
    console.error("erp-fornecedores-sync error:", err);
    return errorResp(500, "INTERNAL_ERROR", err.message || "Erro interno", req, startMs);
  }
});
