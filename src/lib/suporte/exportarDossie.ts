import jsPDF from "jspdf";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchEvidenciaBlobForExport,
  type SuporteEvidencia,
  CATEGORIA_LABEL,
} from "@/hooks/suporte/useEvidencias";

function fmt(dtISO?: string | null) {
  if (!dtISO) return "—";
  return new Date(dtISO).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function stripHtml(s: string | null | undefined) {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchTicket(ticketId: string) {
  const { data } = await (supabase as any)
    .from("suporte_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  return data;
}
async function fetchPareceres(ticketId: string) {
  const { data } = await (supabase as any)
    .from("suporte_pareceres")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  return (data ?? []) as any[];
}
async function fetchTrilha(ticketId: string) {
  const { data } = await (supabase as any)
    .from("suporte_ticket_departamentos")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("entrou_em", { ascending: true });
  return (data ?? []) as any[];
}
async function fetchFilas() {
  const { data } = await (supabase as any).from("suporte_filas").select("id,nome");
  const m = new Map<string, string>();
  (data ?? []).forEach((f: any) => m.set(f.id, f.nome));
  return m;
}
async function fetchProfiles(ids: string[]) {
  if (ids.length === 0) return new Map<string, { nome: string; email: string }>();
  const { data } = await supabase
    .from("profiles")
    .select("id, nome, email")
    .in("id", ids);
  const m = new Map<string, { nome: string; email: string }>();
  (data ?? []).forEach((p: any) =>
    m.set(p.id, { nome: p.nome ?? p.email ?? p.id, email: p.email ?? "" }),
  );
  return m;
}
async function fetchAcessos(evidenciaIds: string[]) {
  if (evidenciaIds.length === 0) return [];
  const { data } = await (supabase as any)
    .from("suporte_evidencia_acessos")
    .select("*")
    .in("evidencia_id", evidenciaIds)
    .order("created_at", { ascending: true });
  return (data ?? []) as any[];
}

function addSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, 40, y);
  doc.setDrawColor(200);
  doc.line(40, y + 4, 555, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return y + 20;
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

function ensureRoom(doc: jsPDF, y: number, needed = 40): number {
  if (y + needed > 780) {
    doc.addPage();
    return 50;
  }
  return y;
}

export interface DossieProgress {
  step: string;
  pct: number;
}

export async function gerarDossieJuridico(
  ticketId: string,
  evidencias: SuporteEvidencia[],
  onProgress?: (p: DossieProgress) => void,
): Promise<{ blob: Blob; filename: string }> {
  onProgress?.({ step: "Carregando dados do chamado…", pct: 5 });
  const [ticket, pareceres, trilha, filas] = await Promise.all([
    fetchTicket(ticketId),
    fetchPareceres(ticketId),
    fetchTrilha(ticketId),
    fetchFilas(),
  ]);

  const profileIds = Array.from(
    new Set([
      ...(ticket ? [ticket.requester_id, ticket.owner_id].filter(Boolean) : []),
      ...pareceres.map((p) => p.autor_id).filter(Boolean),
      ...evidencias.map((e) => e.uploaded_by),
    ]),
  );
  const profiles = await fetchProfiles(profileIds);
  const acessos = await fetchAcessos(evidencias.map((e) => e.id));

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 50;

  // ------ Capa ------
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Dossiê Jurídico — Chamado de Suporte", 40, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Gerado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    40,
    y,
  );
  y += 20;

  y = addSectionTitle(doc, "1. Chamado", y);
  if (ticket) {
    const linhas = [
      `ID: ${ticket.id}`,
      `Título: ${ticket.titulo ?? "—"}`,
      `Status: ${ticket.status ?? "—"}`,
      `Prioridade: ${ticket.prioridade ?? "—"}`,
      `Requerente: ${profiles.get(ticket.requester_id)?.nome ?? "—"}`,
      `Responsável: ${profiles.get(ticket.owner_id)?.nome ?? "—"}`,
      `Aberto em: ${fmt(ticket.created_at)}`,
      `Encerrado em: ${fmt(ticket.closed_at)}`,
    ];
    linhas.forEach((l) => {
      y = ensureRoom(doc, y);
      doc.text(l, 40, y);
      y += 14;
    });
    if (ticket.descricao) {
      y += 6;
      y = ensureRoom(doc, y, 40);
      doc.setFont("helvetica", "bold");
      doc.text("Descrição:", 40, y);
      doc.setFont("helvetica", "normal");
      y += 14;
      const desc = wrapText(doc, stripHtml(ticket.descricao), 515);
      desc.forEach((l) => {
        y = ensureRoom(doc, y);
        doc.text(l, 40, y);
        y += 12;
      });
    }
  } else {
    doc.text("Chamado não encontrado", 40, y);
    y += 14;
  }
  y += 10;

  // ------ Pareceres ------
  y = ensureRoom(doc, y, 40);
  y = addSectionTitle(doc, `2. Pareceres (${pareceres.length})`, y);
  if (pareceres.length === 0) {
    doc.text("Nenhum parecer registrado.", 40, y);
    y += 14;
  } else {
    pareceres.forEach((p, i) => {
      y = ensureRoom(doc, y, 80);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${i + 1}. ${p.titulo || CATEGORIA_LABEL.documento || "Parecer"} — ${p.tipo}`,
        40,
        y,
      );
      doc.setFont("helvetica", "normal");
      y += 14;
      doc.text(
        `Autor: ${profiles.get(p.autor_id)?.nome ?? "—"}   Departamento: ${filas.get(p.fila_id) ?? "—"}`,
        40,
        y,
      );
      y += 12;
      doc.text(
        `Visibilidade: ${p.visibilidade}   Status: ${p.status_departamento}   Registrado: ${fmt(p.created_at)}`,
        40,
        y,
      );
      y += 14;
      const conteudo = wrapText(doc, stripHtml(p.conteudo), 515);
      conteudo.forEach((l) => {
        y = ensureRoom(doc, y);
        doc.text(l, 40, y);
        y += 12;
      });
      if (p.acao_tomada) {
        y = ensureRoom(doc, y);
        doc.setFont("helvetica", "bold");
        doc.text("Ação tomada:", 40, y);
        doc.setFont("helvetica", "normal");
        y += 12;
        wrapText(doc, stripHtml(p.acao_tomada), 515).forEach((l) => {
          y = ensureRoom(doc, y);
          doc.text(l, 40, y);
          y += 12;
        });
      }
      y += 8;
    });
  }

  // ------ Trilha ------
  y = ensureRoom(doc, y, 60);
  y = addSectionTitle(doc, `3. Trilha de Departamentos (${trilha.length})`, y);
  if (trilha.length === 0) {
    doc.text("Sem movimentações registradas.", 40, y);
    y += 14;
  } else {
    trilha.forEach((t, i) => {
      y = ensureRoom(doc, y, 30);
      const linha =
        `${i + 1}. ${filas.get(t.fila_id) ?? "—"}   ` +
        `Status: ${t.status}   ` +
        `Entrou: ${fmt(t.entrou_em)}` +
        (t.saiu_em ? `   Saiu: ${fmt(t.saiu_em)}` : "");
      doc.text(linha, 40, y);
      y += 12;
      if (t.acao_resumo) {
        wrapText(doc, `→ ${stripHtml(t.acao_resumo)}`, 500).forEach((l) => {
          y = ensureRoom(doc, y);
          doc.text(l, 55, y);
          y += 12;
        });
      }
    });
  }

  // ------ Evidências (tabela) ------
  y = ensureRoom(doc, y, 60);
  y = addSectionTitle(doc, `4. Evidências (${evidencias.length})`, y);
  evidencias.forEach((e, i) => {
    y = ensureRoom(doc, y, 60);
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. ${e.nome_arquivo}`, 40, y);
    doc.setFont("helvetica", "normal");
    y += 12;
    doc.text(
      `Categoria: ${CATEGORIA_LABEL[e.categoria]}   Tamanho: ${
        e.tamanho ? (e.tamanho / 1024).toFixed(0) + " KB" : "—"
      }   ${e.locked_juridico ? "[RETENÇÃO JURÍDICA]" : ""}`,
      40,
      y,
    );
    y += 12;
    doc.text(`SHA-256: ${e.hash_sha256}`, 40, y);
    y += 12;
    doc.text(
      `Enviado por: ${profiles.get(e.uploaded_by)?.nome ?? "—"} em ${fmt(e.created_at)}`,
      40,
      y,
    );
    y += 12;
    const vinculos: string[] = [];
    if (e.parecer_id) vinculos.push(`Parecer #${e.parecer_id.slice(0, 8)}`);
    if (e.trilha_id) vinculos.push(`Trilha #${e.trilha_id.slice(0, 8)}`);
    if (vinculos.length) {
      doc.text(`Vínculos: ${vinculos.join(", ")}`, 40, y);
      y += 12;
    }
    if (e.descricao) {
      wrapText(doc, `Descrição: ${e.descricao}`, 515).forEach((l) => {
        y = ensureRoom(doc, y);
        doc.text(l, 40, y);
        y += 12;
      });
    }
    y += 6;
  });

  // ------ Cadeia de custódia ------
  y = ensureRoom(doc, y, 60);
  y = addSectionTitle(doc, `5. Cadeia de custódia (${acessos.length} acessos)`, y);
  if (acessos.length === 0) {
    doc.text("Sem acessos registrados.", 40, y);
    y += 14;
  } else {
    acessos.forEach((a) => {
      y = ensureRoom(doc, y, 20);
      const nomeEvid = evidencias.find((e) => e.id === a.evidencia_id)?.nome_arquivo ?? a.evidencia_id;
      doc.text(
        `${fmt(a.created_at)} · ${a.acao.toUpperCase()} · ${profiles.get(a.user_id)?.nome ?? a.user_id} · ${nomeEvid}`,
        40,
        y,
      );
      y += 12;
    });
  }

  onProgress?.({ step: "Empacotando evidências…", pct: 40 });

  // ------ ZIP ------
  const zip = new JSZip();
  zip.file("dossie.pdf", doc.output("blob"));
  const readme = [
    "Dossiê Jurídico gerado pelo sistema de Suporte.",
    "",
    `Chamado: ${ticketId}`,
    `Data de emissão: ${new Date().toISOString()}`,
    "",
    "Este pacote contém:",
    "  - dossie.pdf       Relatório consolidado (chamado, pareceres, trilha, evidências).",
    "  - evidencias/      Arquivos originais das evidências.",
    "  - manifesto.json   Metadados e hashes SHA-256 para verificação.",
    "",
    "Verificação de integridade: cada arquivo em evidencias/ pode ser validado",
    "comparando seu SHA-256 com o campo hash_sha256 do manifesto.json.",
  ].join("\n");
  zip.file("README.txt", readme);

  const manifesto = {
    generated_at: new Date().toISOString(),
    ticket_id: ticketId,
    evidencias: evidencias.map((e) => ({
      id: e.id,
      nome_arquivo: e.nome_arquivo,
      categoria: e.categoria,
      mime: e.mime,
      tamanho: e.tamanho,
      hash_sha256: e.hash_sha256,
      uploaded_by: e.uploaded_by,
      uploaded_at: e.created_at,
      locked_juridico: e.locked_juridico,
      parecer_id: e.parecer_id,
      trilha_id: e.trilha_id,
      arquivo_no_pacote: `evidencias/${e.hash_sha256.slice(0, 12)}_${e.nome_arquivo.replace(/[^\w.\-]/g, "_")}`,
    })),
    acessos: acessos.map((a) => ({
      evidencia_id: a.evidencia_id,
      user_id: a.user_id,
      acao: a.acao,
      created_at: a.created_at,
    })),
  };
  zip.file("manifesto.json", JSON.stringify(manifesto, null, 2));

  const evidDir = zip.folder("evidencias")!;
  for (let i = 0; i < evidencias.length; i++) {
    const e = evidencias[i];
    onProgress?.({
      step: `Baixando ${i + 1}/${evidencias.length}: ${e.nome_arquivo}`,
      pct: 40 + Math.round((i / Math.max(evidencias.length, 1)) * 50),
    });
    try {
      const blob = await fetchEvidenciaBlobForExport(e);
      const safeName = e.nome_arquivo.replace(/[^\w.\-]/g, "_");
      evidDir.file(`${e.hash_sha256.slice(0, 12)}_${safeName}`, blob);
    } catch (err) {
      evidDir.file(
        `ERRO_${e.hash_sha256.slice(0, 12)}.txt`,
        `Falha ao baixar ${e.nome_arquivo}: ${String(err)}`,
      );
    }
  }

  onProgress?.({ step: "Compactando dossiê…", pct: 95 });
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `dossie_juridico_${ticketId.slice(0, 8)}_${new Date()
    .toISOString()
    .slice(0, 10)}.zip`;
  onProgress?.({ step: "Concluído", pct: 100 });
  return { blob, filename };
}
