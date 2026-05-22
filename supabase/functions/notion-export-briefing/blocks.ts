// supabase/functions/notion-export-briefing/blocks.ts
// Builds Notion blocks that mirror the briefing canvas.

import { SLA_STATUS_LABEL, type BriefingSla } from "../_shared/briefing-sla.ts";
import { FREE_ZONE_START_LABEL } from "../_shared/notion-client.ts";

const NOTION_RT_LIMIT = 1800; // safety under 2000 char limit per rich_text

function rt(text: string, bold = false) {
  return [{
    type: "text",
    text: { content: text.slice(0, NOTION_RT_LIMIT) },
    annotations: { bold },
  }];
}

function paragraph(text: string) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: rt(text) } };
}

function heading2(text: string) {
  return { object: "block", type: "heading_2", heading_2: { rich_text: rt(text) } };
}

function heading3(text: string) {
  return { object: "block", type: "heading_3", heading_3: { rich_text: rt(text) } };
}

function callout(emoji: string, text: string, color: string = "default") {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: rt(text),
      icon: { type: "emoji", emoji },
      color,
    },
  };
}

function divider() {
  return { object: "block", type: "divider", divider: {} };
}

function bullet(text: string) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: rt(text) },
  };
}

function fieldBlock(label: string, value: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        ...rt(`${label}: `, true),
        ...rt(value || "—"),
      ],
    },
  };
}

export interface BuildBlocksInput {
  briefing: {
    titulo: string;
    codigo: string | null;
    tipo: string;
    status: string;
    completude: number;
    payload: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
  sections: Array<{ key: string; label: string; required?: boolean }>;
  projetoNome: string | null;
  autorNome: string | null;
  autorEmail: string | null;
  sla: BriefingSla;
  resumo?: { resumo: string; mensagem_chave: string; riscos: string[] } | null;
  aprovacoes?: Array<{
    ordem: number;
    nome: string;
    status: string;
    responsaveis: string[];
  }>;
  documentos?: Array<{
    nome: string;
    categoria: string;
    status: string;
    fornecedor_nome: string | null;
    lote: string | null;
    tamanho_bytes: number | null;
    signed_url: string | null;
    is_oficial: boolean;
  }>;
  bimasterUrl: string;
}

const TZ_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function buildBriefingBlocks(input: BuildBlocksInput): unknown[] {
  const blocks: unknown[] = [];

  // Header callout with creator + dates + SLA
  const headerParts: string[] = [];
  if (input.autorNome) headerParts.push(`Criado por ${input.autorNome}`);
  headerParts.push(`em ${TZ_FMT.format(new Date(input.briefing.created_at))}`);
  if (input.sla.prazo) {
    headerParts.push(
      `SLA: ${TZ_FMT.format(new Date(input.sla.prazo))} (${SLA_STATUS_LABEL[input.sla.statusSla]})`,
    );
  } else {
    headerParts.push("SLA: sem prazo definido");
  }
  blocks.push(callout("📋", headerParts.join(" · "), "blue_background"));

  // Meta
  const metaParts = [
    `Tipo: ${input.briefing.tipo}`,
    `Status: ${input.briefing.status}`,
    `Completude: ${input.briefing.completude}%`,
  ];
  if (input.projetoNome) metaParts.push(`Projeto: ${input.projetoNome}`);
  if (input.briefing.codigo) metaParts.push(`Código: ${input.briefing.codigo}`);
  blocks.push(paragraph(metaParts.join(" · ")));

  // Executive summary
  if (input.resumo?.resumo) {
    blocks.push(heading2("Resumo executivo"));
    blocks.push(paragraph(input.resumo.resumo));
  }
  if (input.resumo?.mensagem_chave) {
    blocks.push(callout("💡", input.resumo.mensagem_chave, "yellow_background"));
  }
  if (input.resumo?.riscos?.length) {
    blocks.push(heading3("Riscos e dependências"));
    for (const r of input.resumo.riscos) blocks.push(bullet(r));
  }

  // Canvas sections
  blocks.push(divider());
  blocks.push(heading2("Conteúdo do briefing"));
  for (const sec of input.sections) {
    const raw = input.briefing.payload?.[sec.key];
    const value = typeof raw === "string" ? raw.trim() : raw ? String(raw) : "";
    blocks.push(fieldBlock(sec.label + (sec.required ? " *" : ""), value));
  }

  // Approvals
  if (input.aprovacoes?.length) {
    blocks.push(divider());
    blocks.push(heading2("Fluxo de aprovações"));
    for (const ap of input.aprovacoes) {
      const resp = ap.responsaveis.length
        ? ap.responsaveis.join(", ")
        : "sem responsáveis";
      blocks.push(bullet(`${ap.ordem}. ${ap.nome} — ${ap.status} (${resp})`));
    }
  }

  // Documentos do cofre
  if (input.documentos?.length) {
    blocks.push(divider());
    blocks.push(heading2("Documentos do cofre"));
    blocks.push(paragraph(
      `Total: ${input.documentos.length} documento(s). Links assinados válidos por 7 dias — reenvie para renovar.`,
    ));
    for (const d of input.documentos) {
      const sizeKb = d.tamanho_bytes ? `${(d.tamanho_bytes / 1024 / 1024).toFixed(2)} MB` : "";
      const meta = [
        d.categoria,
        d.status,
        d.is_oficial ? "oficial" : null,
        d.fornecedor_nome,
        d.lote ? `lote ${d.lote}` : null,
        sizeKb || null,
      ].filter(Boolean).join(" · ");
      if (d.signed_url) {
        blocks.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                type: "text",
                text: { content: d.nome.slice(0, NOTION_RT_LIMIT), link: { url: d.signed_url } },
                annotations: { bold: true },
              },
              ...rt(meta ? ` — ${meta}` : ""),
            ],
          },
        });
      } else {
        blocks.push(bullet(`${d.nome} — ${meta} (sem arquivo anexado)`));
      }
    }
  }

  // Footer — wrapped with explicit markers so pull can identify the user-editable zone
  blocks.push(divider());
  blocks.push(heading3(FREE_ZONE_START_LABEL));
  // Hint paragraph (also lives in the free zone so it's editable / deletable by the user)
  blocks.push(paragraph(
    "Tudo que você escrever entre este título e o próximo divisor será trazido de volta para o bimaster na próxima sincronização.",
  ));
  blocks.push(divider());
  blocks.push(paragraph(`Abrir no bimaster: ${input.bimasterUrl}`));

  return blocks;
}

/** Re-exported from shared so notion-pull-briefing can import from _shared. */
export { FREE_ZONE_START_LABEL } from "../_shared/notion-client.ts";

/** Properties for a database row in the "Briefings bimaster" database. */
export function buildPageProperties(input: BuildBlocksInput): Record<string, unknown> {
  const titleProp = (input.briefing.titulo || "Briefing").slice(0, 1900);
  const props: Record<string, unknown> = {
    "Título": { title: [{ text: { content: titleProp } }] },
    "Tipo": { select: { name: input.briefing.tipo } },
    "Status": { select: { name: input.briefing.status } },
    "Completude": { number: input.briefing.completude },
    "Criado em": { date: { start: input.briefing.created_at } },
    "Atualizado em": { date: { start: input.briefing.updated_at } },
    "Link bimaster": { url: input.bimasterUrl },
  };
  if (input.briefing.codigo) {
    props["Código"] = { rich_text: [{ text: { content: input.briefing.codigo } }] };
  }
  if (input.projetoNome) {
    props["Projeto"] = { rich_text: [{ text: { content: input.projetoNome } }] };
  }
  if (input.autorNome || input.autorEmail) {
    const txt = [input.autorNome, input.autorEmail].filter(Boolean).join(" · ");
    props["Criado por"] = { rich_text: [{ text: { content: txt } }] };
  }
  if (input.sla.prazo) {
    props["SLA / Prazo"] = { date: { start: input.sla.prazo } };
  }
  props["Status do SLA"] = { select: { name: SLA_STATUS_LABEL[input.sla.statusSla] } };
  if (input.sla.diasRestantes !== null) {
    props["Dias até SLA"] = { number: input.sla.diasRestantes };
  }
  return props;
}

/** Schema for creating the database the first time. */
export function buildDatabaseSchema(): Record<string, unknown> {
  return {
    "Título": { title: {} },
    "Tipo": {
      select: {
        options: [
          { name: "pdv", color: "blue" },
          { name: "embalagem", color: "orange" },
          { name: "evento", color: "purple" },
          { name: "campanha", color: "pink" },
          { name: "ecommerce", color: "green" },
          { name: "presskit", color: "yellow" },
          { name: "catalogo", color: "red" },
          { name: "material_interno", color: "gray" },
        ],
      },
    },
    "Status": {
      select: {
        options: [
          { name: "rascunho", color: "gray" },
          { name: "em_andamento", color: "yellow" },
          { name: "final", color: "green" },
          { name: "arquivado", color: "brown" },
        ],
      },
    },
    "Completude": { number: { format: "percent" } },
    "Projeto": { rich_text: {} },
    "Código": { rich_text: {} },
    "Criado por": { rich_text: {} },
    "Criado em": { date: {} },
    "Atualizado em": { date: {} },
    "SLA / Prazo": { date: {} },
    "Status do SLA": {
      select: {
        options: [
          { name: "No prazo", color: "green" },
          { name: "Em risco", color: "yellow" },
          { name: "Vencido", color: "red" },
          { name: "Sem SLA", color: "gray" },
        ],
      },
    },
    "Dias até SLA": { number: { format: "number" } },
    "Link bimaster": { url: {} },
  };
}
