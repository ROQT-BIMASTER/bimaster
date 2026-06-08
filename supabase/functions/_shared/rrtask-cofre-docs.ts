// supabase/functions/_shared/rrtask-cofre-docs.ts
// Helpers para espelhar documentos do Cofre de Briefing (briefing_documentos +
// bucket briefing-cofre) dentro da página de RR-Tasks da agência.
//
// Reutilizado por:
//   - rrtask-create-task (envio inicial + reenvio Round N)
//   - rrtask-sync-documentos (push incremental ao subir/aprovar doc)
import { notion } from "./notion-client.ts";

export interface CofreDocRow {
  id: string;
  nome: string;
  categoria: string | null;
  status: string | null;
  fornecedor_nome: string | null;
  lote: string | null;
  tamanho_bytes: number | null;
  storage_path: string | null;
  mime_type: string | null;
  enviado_notion_em: string | null;
  updated_at: string | null;
}

export interface PreparedCofreDoc extends CofreDocRow {
  signed_url: string | null;
}

const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7; // 7 dias

function brDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isFileMimeForNotion(mime: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith("image/") || mime === "application/pdf";
}

/**
 * Busca docs do cofre + assina URLs do bucket `briefing-cofre`.
 * Se `onlyNew = true`, retorna só docs nunca enviados ou atualizados após o
 * último envio (idempotência).
 */
export async function loadCofreDocs(
  sb: any,
  briefingId: string,
  opts: { onlyNew?: boolean } = {},
): Promise<PreparedCofreDoc[]> {
  const { data, error } = await sb
    .from("briefing_documentos")
    .select(
      "id, nome, categoria, status, fornecedor_nome, lote, tamanho_bytes, storage_path, mime_type, enviado_notion_em, updated_at",
    )
    .eq("briefing_id", briefingId)
    .in("status", ["recebido", "aprovado"])
    .order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) return [];

  const filtered = opts.onlyNew
    ? (data as CofreDocRow[]).filter(
        (d) =>
          !d.enviado_notion_em ||
          (d.updated_at &&
            new Date(d.updated_at).getTime() >
              new Date(d.enviado_notion_em).getTime()),
      )
    : (data as CofreDocRow[]);

  const out: PreparedCofreDoc[] = [];
  for (const d of filtered) {
    let signed_url: string | null = null;
    if (d.storage_path) {
      const { data: signed } = await sb.storage
        .from("briefing-cofre")
        .createSignedUrl(d.storage_path, SIGNED_URL_TTL_SEC);
      signed_url = signed?.signedUrl ?? null;
    }
    out.push({ ...d, signed_url });
  }
  return out;
}

/**
 * Constrói os blocos Notion para uma lista de documentos do cofre.
 * - `heading`: título do bloco (ex.: "Documentos do Cofre", "Documentos adicionados em dd/mm").
 * - Cada doc vira um `bulleted_list_item` com link nomeado;
 *   PDFs e imagens recebem também um bloco `file` external (preview no Notion).
 */
export function buildCofreDocBlocks(
  docs: PreparedCofreDoc[],
  heading: string,
): unknown[] {
  if (!docs.length) return [];

  const blocks: unknown[] = [
    {
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [{ type: "text", text: { content: `📎 ${heading}` } }],
      },
    },
  ];

  for (const d of docs) {
    const meta: string[] = [];
    if (d.categoria) meta.push(d.categoria);
    if (d.fornecedor_nome) meta.push(d.fornecedor_nome);
    if (d.lote) meta.push(`lote ${d.lote}`);
    const size = fmtSize(d.tamanho_bytes);
    if (size) meta.push(size);
    if (d.status) meta.push(d.status);
    const suffix = meta.length ? `  (${meta.join(" · ")})` : "";

    if (d.signed_url) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            {
              type: "text",
              text: { content: d.nome, link: { url: d.signed_url } },
              annotations: { bold: true },
            },
            { type: "text", text: { content: suffix } },
          ],
        },
      });

      if (isFileMimeForNotion(d.mime_type) && d.signed_url) {
        blocks.push({
          object: "block",
          type: "file",
          file: {
            type: "external",
            external: { url: d.signed_url },
            caption: [{ type: "text", text: { content: d.nome } }],
          },
        });
      }
    } else {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            {
              type: "text",
              text: { content: `${d.nome}${suffix}  (sem arquivo)` },
            },
          ],
        },
      });
    }
  }

  return blocks;
}

/**
 * Após sucesso de envio ao Notion, marca docs como sincronizados.
 */
export async function markDocsEnviados(
  sb: any,
  docs: PreparedCofreDoc[],
  pageId: string,
): Promise<number> {
  const nowIso = new Date().toISOString();
  let n = 0;
  for (const d of docs) {
    if (!d.signed_url) continue;
    await sb
      .from("briefing_documentos")
      .update({
        enviado_notion_em: nowIso,
        notion_file_url: d.signed_url,
        notion_page_id: pageId,
      })
      .eq("id", d.id);
    n += 1;
  }
  return n;
}

/**
 * Append incremental: faz PATCH /blocks/{pageId}/children com heading + blocks.
 * Notion limita 100 children por chamada — paginamos.
 */
export async function appendDocsToPage(
  token: string,
  pageId: string,
  blocks: unknown[],
): Promise<{ ok: boolean; errorText?: string; status?: number }> {
  if (!blocks.length) return { ok: true };
  for (let i = 0; i < blocks.length; i += 100) {
    const chunk = blocks.slice(i, i + 100);
    const r = await notion(token, `/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: chunk }),
    });
    if (!r.ok) return { ok: false, status: r.status, errorText: r.errorText };
  }
  return { ok: true };
}

export function headingAdicionadoEm(): string {
  return `Documentos adicionados em ${brDate(new Date().toISOString())}`;
}
