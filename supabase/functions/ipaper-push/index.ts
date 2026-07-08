// Push do arquivo de dados do catálogo para o iPaper via Backend API.
// Gera o XLSX (mesmas colunas da planilha manual) a partir de ipaper_produtos +
// erp_estoque_live e sobrescreve o arquivo na Media library do iPaper
// (Media.UploadFile sobrescreve por nome). O Auto Update do iPaper re-executa a
// Enrichment Automation com esse arquivo — catálogo atualiza sem ação humana.
// Auth: x-cron-secret (pg_cron) OU Bearer service-role (disparo manual/Lovable).
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { buildIpaperRows } from "../_shared/ipaper-data.ts";

// Endpoints reais são web services .NET: /V2/<Serviço>.asmx/<Método> (a doc
// omite o caminho — verificado empiricamente em 08/07/2026: POST form-encoded
// em /V2/Media.asmx/UploadFile responde XML; na raiz dá 404).
const IPAPER_API_BASE = "https://ipaper.api.ipapercms.dk/V2";
const ARQUIVO_NOME = "ESTOQUE-CATALOGOS-HUUGS-AUTO.xlsx";
const PASTA_NOME = "Data"; // pasta da Media library onde vivem os arquivos de dados

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function ipaperCall(method: string, apiKey: string, params: Record<string, string>): Promise<string> {
  const [servico, metodo] = method.split("."); // "Media.UploadFile" → /Media.asmx/UploadFile
  // Cada Web Service .NET do iPaper usa nomes de credencial diferentes
  // (verificado empiricamente): Paper.* → plUsername/plPassword;
  // Media.*  → username/password (lowercase). Enviamos todas as variantes;
  // parâmetros extras são ignorados pelo servidor.
  const form = new URLSearchParams({
    Username: "APIKey", Password: apiKey,
    username: "APIKey", password: apiKey,
    plUsername: "APIKey", plPassword: apiKey,
    ...params,
  });

  const resp = await fetch(`${IPAPER_API_BASE}/${servico}.asmx/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const xml = await resp.text();
  if (!resp.ok) throw new Error(`iPaper ${method} HTTP ${resp.status}: ${xml.slice(0, 300)}`);
  return xml;
}

// Localiza a pasta de dados na Media library. Fallback: raiz (0).
async function resolveParentId(apiKey: string): Promise<number> {
  const override = Deno.env.get("IPAPER_PARENT_ID");
  if (override && !isNaN(Number(override))) return Number(override);
  try {
    const xml = await ipaperCall("Media.GetTree", apiKey, {});
    for (const tag of xml.match(/<[^>]*(?:directory|folder)[^>]*>/gi) ?? []) {
      const nome = tag.match(/name="([^"]+)"/i)?.[1];
      const id = tag.match(/\bid="(\d+)"/i)?.[1];
      if (nome?.trim().toLowerCase() === PASTA_NOME.toLowerCase() && id) return Number(id);
    }
  } catch (_) { /* cai para a raiz */ }
  return 0;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 10, rateLimitPrefix: "ipaper-push", skipWaf: true },
  async (req) => {
    const startMs = Date.now();
    const cors = getCorsHeaders(req);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    // Cron secret OU service-role bearer (mesmo padrão do erp-sync-engine)
    const cronSecret = req.headers.get("x-cron-secret") ?? "";
    const expectedCron = Deno.env.get("CRON_SECRET") ?? "";
    const bearer = req.headers.get("Authorization")?.startsWith("Bearer ")
      ? req.headers.get("Authorization")!.slice(7)
      : "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authorized =
      (!!cronSecret && !!expectedCron && constantTimeEquals(cronSecret, expectedCron)) ||
      (!!bearer && !!serviceKey && constantTimeEquals(bearer, serviceKey));
    if (!authorized) return json(401, { error: "unauthorized" });

    const apiKey = Deno.env.get("IPAPER_API_KEY");
    if (!apiKey) return json(500, { error: "server_misconfigured", details: "IPAPER_API_KEY ausente" });

    // Diagnóstico: valida acesso Backend API com uma chamada de leitura pura.
    let diagnose = false;
    try {
      const body = await req.clone().json();
      diagnose = body?.action === "diagnose";
    } catch (_) { /* body vazio ok */ }
    if (diagnose) {
      try {
        const xml = await ipaperCall("Paper.GetAllPapers", apiKey, {});
        const code = xml.match(/<code[^>]*>(?:<!\[CDATA\[)?([^<\]]*)/i)?.[1]?.trim() ?? "";
        return json(200, {
          diagnose: true,
          endpoint: "Paper.GetAllPapers",
          code,
          backend_api_ativo: !code || code === "OK",
          resposta: xml.slice(0, 1200),
        });
      } catch (e) {
        return json(200, { diagnose: true, endpoint: "Paper.GetAllPapers", erro: String(e) });
      }
    }


    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const registrar = async (status: string, total: number, erro?: string) => {
      await supabase.from("sync_control").insert({
        entidade: "ipaper_push",
        empresa_id: 1,
        ultima_sync: new Date().toISOString(),
        total_registros: total,
        registros_inseridos: status === "success" ? total : 0,
        registros_atualizados: 0,
        registros_ignorados: 0,
        duracao_ms: Date.now() - startMs,
        status,
        erro_mensagem: erro ?? null,
      });
    };

    try {
      const linhas = await buildIpaperRows(supabase);
      if (linhas.length === 0) {
        await registrar("error", 0, "Nenhum produto ativo em ipaper_produtos");
        return json(500, { error: "no_rows" });
      }

      // Guarda de dado velho: não empurra estoque congelado para o catálogo.
      const { data: syncRow } = await supabase
        .from("erp_estoque_live")
        .select("sincronizado_em")
        .order("sincronizado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      const idadeMin = syncRow
        ? (Date.now() - new Date(syncRow.sincronizado_em).getTime()) / 60_000
        : Infinity;
      if (idadeMin > 24 * 60) {
        await registrar("error", linhas.length, `erp_estoque_live sem sync há ${Math.round(idadeMin / 60)}h`);
        return json(409, { error: "stale_stock", horas_sem_sync: Math.round(idadeMin / 60) });
      }

      const header = ["ID", "NAME", "STOCK", "DESCRIPTION", "CODHB", "PRICE", "PACKAGE SIZE"];
      const aoa: (string | number | null)[][] = [
        header,
        ...linhas.map((l) => [l.ID, l.NAME, l.STOCK, l.DESCRIPTION, l.CODHB, l.PRICE, l["PACKAGE SIZE"]]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Planilha1");
      const base64File = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;

      const parentID = await resolveParentId(apiKey);
      const xml = await ipaperCall("Media.UploadFile", apiKey, {
        parentID: String(parentID),
        name: ARQUIVO_NOME,
        base64File,
      });

      const code = xml.match(/<code>\s*([A-Z_]+)/i)?.[1] ?? "";
      const fileId = xml.match(/fileid[^>]*>?\s*"?(\d+)/i)?.[1] ?? null;
      if (code.toUpperCase() !== "SUCCESS") {
        await registrar("error", linhas.length, `iPaper retornou ${code || "resposta inesperada"}: ${xml.slice(0, 200)}`);
        return json(502, { error: "ipaper_upload_failed", code, resposta: xml.slice(0, 300) });
      }

      await registrar("success", linhas.length);
      return json(200, {
        success: true,
        arquivo: ARQUIVO_NOME,
        parentID,
        fileId,
        linhas: linhas.length,
        estoque_sync_ha_min: Math.round(idadeMin),
      });
    } catch (e) {
      const msg = (e as Error).message;
      await registrar("error", 0, msg);
      return json(500, { error: "push_failed", details: msg });
    }
  },
));
