import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, GripVertical, Save, FileText, Info, Printer, Download, History, AlertTriangle, ChevronDown, ChevronRight, ArrowRight, Paperclip, Upload, X, Eye, MessageSquare, ShieldCheck, CheckCircle2, PackageOpen, Loader2, RefreshCw, Link2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CustoInsumo, CustoConfig, Totais, BaseCalculoMarkup, CustoFilho } from "@/hooks/useFichaCustoProduto";
import { AdicionarInsumoCustoDialog } from "./AdicionarInsumoCustoDialog";
import { ImportarInsumosIA } from "./ImportarInsumosIA";
import { DisplayGradePopover } from "./DisplayGradePopover";
import { HistoricoCustosInsumoDialog } from "./HistoricoCustosInsumoDialog";
import { AlterarCustoDialog } from "./AlterarCustoDialog";
import { CotacoesInsumoPanel } from "./CotacoesInsumoPanel";
import { VincularXmlInsumoDialog } from "./VincularXmlInsumoDialog";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resolveStorageUrl } from "@/lib/utils/storage-url";
import { downloadStorageBlob } from "@/lib/utils/storage-download";

import { FichaAprovacaoBanner } from "./FichaAprovacaoBanner";
import { FichaApontamentosPanel } from "./FichaApontamentosPanel";
import { RevisaoChatPanel } from "./RevisaoChatPanel";
import type { StatusAprovacao, RevisaoItem, Revisao } from "@/hooks/useFichaRevisao";
import { SendHorizonal } from "lucide-react";
import { RequisitosHistoricoTimeline } from "./RequisitosHistoricoTimeline";
import { InsumosOrigemPanel } from "./InsumosOrigemPanel";

interface Props {
  produto: any;
  insumos: CustoInsumo[];
  config: CustoConfig | null;
  totais: Totais;
  saving: boolean;
  tiposInsumo: { value: string; label: string }[];
  onAdicionarInsumo: (insumo: Partial<CustoInsumo>) => void;
  onAtualizarInsumo: (id: string, campo: keyof CustoInsumo, valor: any) => void;
  onRemoverInsumo: (id: string) => void;
  onAtualizarConfig: (campo: keyof CustoConfig, valor: any) => void;
  onSalvar: () => void;
  statusAprovacao?: StatusAprovacao;
  revisaoAtiva?: Revisao | null;
  apontamentos?: RevisaoItem[];
  requisitos?: any[];
  submitting?: boolean;
  onSubmeterAprovacao?: () => void;
  custosFilhos?: CustoFilho[];
  loadingFilhos?: boolean;
  onImportarCustosFilhos?: () => Promise<void>;
  onRecarregarCustosFilhos?: () => Promise<void>;
  isDisplayComKit?: boolean;
  todosInsumosKit?: boolean;
}

function DecimalInput({
  value,
  onChange,
  placeholder = "0.000",
  className = "",
  id,
}: {
  value: number | string;
  onChange: (val: number | string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const displayValue = typeof value === "string" ? value : (value === 0 ? "0" : String(value));
  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
          if (raw === "") {
            onChange(0);
          } else if (raw.endsWith(".") || /\.\d*0$/.test(raw)) {
            onChange(raw);
          } else {
            onChange(parseFloat(raw) || 0);
          }
        }
      }}
      className={className}
      placeholder={placeholder}
    />
  );
}

export function FichaCustoProdutoEditor({
  produto,
  insumos,
  config,
  totais,
  saving,
  tiposInsumo,
  onAdicionarInsumo,
  onAtualizarInsumo,
  onRemoverInsumo,
  onAtualizarConfig,
  onSalvar,
  statusAprovacao = "rascunho",
  revisaoAtiva,
  apontamentos = [],
  requisitos = [],
  submitting = false,
  onSubmeterAprovacao,
  custosFilhos = [],
  loadingFilhos = false,
  onImportarCustosFilhos,
  onRecarregarCustosFilhos,
  isDisplayComKit = false,
  todosInsumosKit = false,
}: Props) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [importDialogAberto, setImportDialogAberto] = useState(false);
  const [importando, setImportando] = useState(false);
  const [historicoInsumo, setHistoricoInsumo] = useState<{ id: string; nome: string } | null>(null);
  const [expandedInsumos, setExpandedInsumos] = useState<Set<string>>(new Set());
  const [evidencias, setEvidencias] = useState<Record<string, any[]>>({});
  const [historicoRecente, setHistoricoRecente] = useState<Record<string, any[]>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [alteracaoCusto, setAlteracaoCusto] = useState<{
    insumoId: string;
    insumoNome: string;
    campo: string;
    valorAnterior: number;
    valorNovo: number;
  } | null>(null);
  // Contestation state
  const [contestacaoReq, setContestacaoReq] = useState<any | null>(null);
  const [contestacaoMotivo, setContestacaoMotivo] = useState("");
  const [contestandoId, setContestandoId] = useState<string | null>(null);
  // Resolution state
  const [resolucaoReq, setResolucaoReq] = useState<any | null>(null);
  const [resolucaoDescricao, setResolucaoDescricao] = useState("");
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);
  // Acknowledgment term state
  const [showTermoCiencia, setShowTermoCiencia] = useState(false);
  const [termoCienciaAceito, setTermoCienciaAceito] = useState(false);
  const [submittingComTermo, setSubmittingComTermo] = useState(false);
  const [uploadingEvidenciaGeral, setUploadingEvidenciaGeral] = useState(false);
  const evidenciaFileRef = useRef<HTMLInputElement>(null);
  const [xmlVincularInsumo, setXmlVincularInsumo] = useState<{ id: string; nome: string; mp_id: string | null } | null>(null);

  const isLocked = statusAprovacao === "em_revisao" || statusAprovacao === "aprovada";

  const handleEvidenciaGeral = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingEvidenciaGeral(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Usuário não autenticado"); return; }

      let uploaded = 0;
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${produto.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("fabrica-custo-evidencias").upload(path, file);
        if (uploadError) { console.error(uploadError); continue; }

        const { data: signedData } = await supabase.storage.from("fabrica-custo-evidencias").createSignedUrl(path, 31536000);
        const fileUrl = signedData?.signedUrl || path;

        await supabase.from("fabrica_custo_evidencias" as any).insert({
          produto_id: produto.id,
          nome_arquivo: file.name,
          url_arquivo: fileUrl,
          tipo_arquivo: file.type,
          tamanho_bytes: file.size,
          descricao: "Evidência geral",
          usuario_id: user.id,
          usuario_nome: user.user_metadata?.nome || user.email || "Usuário",
        });
        uploaded++;
      }
      toast.success(`${uploaded} evidência(s) enviada(s) com sucesso`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar evidências");
    } finally {
      setUploadingEvidenciaGeral(false);
      if (evidenciaFileRef.current) evidenciaFileRef.current.value = "";
    }
  };

  // Map de insumo_id -> apontamentos
  const apontamentosPorInsumo = useMemo(() => {
    const map = new Map<string, RevisaoItem[]>();
    apontamentos.forEach((a) => {
      if (a.insumo_id) {
        if (!map.has(a.insumo_id)) map.set(a.insumo_id, []);
        map.get(a.insumo_id)!.push(a);
      }
    });
    return map;
  }, [apontamentos]);

  // Refs para debounce do motivo dialog
  const custoChangeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCustoChangeRef = useRef<{insumoId: string; campo: string; valorAnterior: number; valorNovo: number} | null>(null);

  // Handler para campos de custo com justificativa (debounced)
  const handleCustoChange = (insumoId: string, campo: string, valorNovo: number | string) => {
    const insumo = insumos.find((i) => i.id === insumoId);
    if (!insumo) return;
    const valorAnterior = Number(insumo[campo as keyof CustoInsumo]) || 0;

    // Sempre atualizar o valor no estado (para o input refletir)
    onAtualizarInsumo(insumoId, campo as keyof CustoInsumo, valorNovo);

    // Se é string parcial (digitando decimais), não pedir justificativa ainda
    if (typeof valorNovo === "string" && (valorNovo.endsWith(".") || valorNovo === "" || /\.\d*0$/.test(valorNovo))) {
      // Cancelar timer anterior se existir
      if (custoChangeTimerRef.current) clearTimeout(custoChangeTimerRef.current);
      pendingCustoChangeRef.current = null;
      return;
    }

    const novoNum = typeof valorNovo === "string" ? parseFloat(valorNovo) || 0 : valorNovo;

    // Se valor anterior era 0 ou é primeira vez, não pedir justificativa
    if (valorAnterior === 0 || novoNum === valorAnterior) {
      if (custoChangeTimerRef.current) clearTimeout(custoChangeTimerRef.current);
      pendingCustoChangeRef.current = null;
      return;
    }

    // Debounce: espera 1.5s sem digitar para abrir dialog de justificativa
    if (custoChangeTimerRef.current) clearTimeout(custoChangeTimerRef.current);
    pendingCustoChangeRef.current = { insumoId, campo, valorAnterior, valorNovo: novoNum };
    custoChangeTimerRef.current = setTimeout(() => {
      if (pendingCustoChangeRef.current) {
        const pending = pendingCustoChangeRef.current;
        setAlteracaoCusto({
          insumoId: pending.insumoId,
          insumoNome: insumo.nome,
          campo: pending.campo,
          valorAnterior: pending.valorAnterior,
          valorNovo: pending.valorNovo,
        });
        pendingCustoChangeRef.current = null;
      }
    }, 1500);
  };

  const handleConfirmarAlteracao = async (motivo: string) => {
    if (!alteracaoCusto) return;
    const { insumoId, campo, valorNovo } = alteracaoCusto;

    // Atualizar o insumo (trigger no banco registra o histórico)
    onAtualizarInsumo(insumoId, campo as keyof CustoInsumo, valorNovo);

    // Também atualizar o motivo no histórico (via update no registro mais recente)
    // O trigger insere sem motivo, então atualizamos logo em seguida
    const user = (await supabase.auth.getUser()).data.user;
    setTimeout(async () => {
      await supabase
        .from("fabrica_insumo_custo_historico" as any)
        .update({ motivo, usuario_nome: user?.user_metadata?.nome || user?.email || "" } as any)
        .eq("produto_custo_id", insumoId)
        .eq("campo", campo)
        .is("motivo", null)
        .order("created_at", { ascending: false })
        .limit(1);
    }, 500);

    setAlteracaoCusto(null);
  };
  // Toggle expanded row
  const toggleExpanded = (insumoId: string) => {
    setExpandedInsumos((prev) => {
      const next = new Set(prev);
      if (next.has(insumoId)) next.delete(insumoId);
      else next.add(insumoId);
      return next;
    });
    // Carregar evidências e histórico quando expande
    if (!expandedInsumos.has(insumoId)) {
      carregarEvidencias(insumoId);
      carregarHistoricoRecente(insumoId);
    }
  };

  // Carregar histórico recente de um insumo
  const carregarHistoricoRecente = useCallback(async (produtoCustoId: string) => {
    const { data } = await supabase
      .from("fabrica_insumo_custo_historico" as any)
      .select("*")
      .eq("produto_custo_id", produtoCustoId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) {
      setHistoricoRecente((prev) => ({ ...prev, [produtoCustoId]: data as any[] }));
    }
  }, []);

  // Carregar evidências de um insumo
  const carregarEvidencias = useCallback(async (produtoCustoId: string) => {
    const { data } = await supabase
      .from("fabrica_custo_evidencias" as any)
      .select("*")
      .eq("produto_custo_id", produtoCustoId)
      .order("created_at", { ascending: false });
    if (data) {
      setEvidencias((prev) => ({ ...prev, [produtoCustoId]: data as any[] }));
    }
  }, []);

  // Upload de evidência
  const handleUploadEvidencia = async (insumoId: string, file: File) => {
    if (!produto?.id) return;
    setUploadingFor(insumoId);
    try {
      const ext = file.name.split('.').pop();
      const path = `${produto.id}/${insumoId}/${crypto.randomUUID()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("fabrica-custo-evidencias")
        .upload(path, file);
      if (uploadError) throw uploadError;

      // Gerar signed URL em vez de URL pública
      const { data: signedData, error: signError } = await supabase.storage
        .from("fabrica-custo-evidencias")
        .createSignedUrl(path, 31536000); // 1 ano

      if (signError || !signedData?.signedUrl) throw signError || new Error('Failed to generate signed URL');

      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("fabrica_custo_evidencias" as any).insert({
        produto_custo_id: insumoId,
        produto_id: produto.id,
        nome_arquivo: file.name,
        url_arquivo: signedData.signedUrl,
        tipo_arquivo: file.type,
        tamanho_bytes: file.size,
        usuario_id: user?.id,
        usuario_nome: user?.user_metadata?.nome || user?.email || "",
      } as any);

      toast.success("Evidência enviada");
      carregarEvidencias(insumoId);
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setUploadingFor(null);
    }
  };

  // Remover evidência
  const handleRemoverEvidencia = async (evidenciaId: string, insumoId: string) => {
    await supabase.from("fabrica_custo_evidencias" as any).delete().eq("id", evidenciaId);
    carregarEvidencias(insumoId);
    toast.success("Evidência removida");
  };

  // Contestar requisito
  const handleContestar = async () => {
    if (!contestacaoReq || !contestacaoMotivo.trim()) return;
    setContestandoId(contestacaoReq.id);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("fabrica_revisao_requisitos" as any).update({
        contestado: true,
        contestacao_motivo: contestacaoMotivo.trim(),
        contestado_por: user?.id,
        contestado_em: new Date().toISOString(),
      } as any).eq("id", contestacaoReq.id);
      toast.success("Contestação registrada. A Diretoria será notificada.");
      setContestacaoReq(null);
      setContestacaoMotivo("");
    } catch (err: any) {
      toast.error("Erro ao contestar: " + err.message);
    } finally {
      setContestandoId(null);
    }
  };

  // Resolver requisito manualmente
  const handleResolver = async () => {
    if (!resolucaoReq || !resolucaoDescricao.trim()) return;
    setResolvendoId(resolucaoReq.id);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("fabrica_revisao_requisitos" as any).update({
        cumprido: true,
        resolvido_manualmente: true,
        resolucao_descricao: resolucaoDescricao.trim(),
        resolvido_por: user?.id,
        resolvido_em: new Date().toISOString(),
      } as any).eq("id", resolucaoReq.id);
      toast.success("Requisito marcado como resolvido!");
      setResolucaoReq(null);
      setResolucaoDescricao("");
    } catch (err: any) {
      toast.error("Erro ao resolver: " + err.message);
    } finally {
      setResolvendoId(null);
    }
  };

  // Submeter com termo de ciência (bypass requisitos pendentes)
  const handleSubmeterComTermo = async () => {
    if (!onSubmeterAprovacao || !config?.id || !revisaoAtiva?.id) return;
    setSubmittingComTermo(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const pendentes = requisitos.filter((r: any) => !r.cumprido && !r.contestado);
      await supabase.from("fabrica_ficha_custo_revisoes" as any).update({
        termo_ciencia_assinado: true,
        termo_ciencia_texto: `Eu, ${user?.user_metadata?.nome || user?.email}, declaro estar ciente de que existem ${pendentes.length} requisito(s) pendente(s) não atendido(s). Assumo total responsabilidade por prosseguir com a submissão nestas condições.`,
        termo_ciencia_assinado_por: user?.id,
        termo_ciencia_assinado_em: new Date().toISOString(),
        requisitos_pendentes_ao_submeter: pendentes.map((r: any) => ({ id: r.id, descricao: r.descricao, tipo: r.tipo })),
      } as any).eq("id", revisaoAtiva.id);
      // Proceed with submission
      await onSubmeterAprovacao();
      setShowTermoCiencia(false);
      setTermoCienciaAceito(false);
    } catch (err: any) {
      toast.error("Erro ao submeter: " + err.message);
    } finally {
      setSubmittingComTermo(false);
    }
  };

  const formatarValor = (valor: number) => {
    return valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 6,
    });
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const getTipoLabel = (value: string) => {
    const found = tiposInsumo.find(t => t.value === value);
    return found?.label || value;
  };

  const handlePrintPDF = () => {
    const baseMarkupLabel = config?.base_calculo_markup === 'nf' ? 'sobre NF' 
      : config?.base_calculo_markup === 'servico' ? 'sobre Serviço' 
      : config?.base_calculo_markup === 'nf_servico' ? 'sobre NF+Serviço' 
      : 'sobre Totais';

    const html = `
      <html>
      <head>
        <title>Ficha de Custos - ${produto?.nome || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; color: #333; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .subtitle { color: #666; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          .text-right { text-align: right; }
          .config { display: flex; gap: 24px; margin: 12px 0; flex-wrap: wrap; }
          .config-item label { font-weight: 600; display: block; font-size: 11px; color: #666; }
          .totais { display: flex; gap: 16px; margin: 16px 0; }
          .total-box { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 12px; text-align: center; }
          .total-box.destaque { border: 2px solid #3b82f6; background: #eff6ff; }
          .total-box .label { font-size: 11px; color: #666; }
          .total-box .valor { font-size: 18px; font-weight: 700; }
          .markup-info { background: #f9fafb; padding: 8px 12px; border-radius: 4px; margin: 8px 0; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Ficha de Custos - ${produto?.nome || ''}</h1>
        <div class="subtitle">Código: ${produto?.codigo || ''} | Origem: ${produto?.origem === 'importado' ? 'Importado' : 'Nacional'}</div>
        <div class="config">
          <div class="config-item"><label>Fornecedor M.O.</label>${config?.fornecedor_mao_obra || '-'}</div>
          <div class="config-item"><label>M.O. NF</label>R$ ${formatarValor(Number(config?.custo_mao_obra_nf) || 0)}</div>
          <div class="config-item"><label>M.O. Serviço</label>R$ ${formatarValor(Number(config?.custo_mao_obra_servico) || 0)}</div>
          <div class="config-item"><label>Markup</label>${config?.percentual_markup || 0}% (${baseMarkupLabel})</div>
        </div>
        <table>
          <thead><tr>
            <th>Código</th><th>Insumo</th><th>Tipo</th><th>Fornecedor</th>
            <th class="text-right">NF (R$)</th><th class="text-right">Serviço (R$)</th><th class="text-right">Condição (R$)</th><th>NF Ref.</th>
          </tr></thead>
          <tbody>
            ${insumos.map(i => `<tr>
              <td>${i.codigo}</td><td>${i.nome}</td><td>${getTipoLabel(i.tipo_insumo)}</td><td>${i.fornecedor || '-'}</td>
              <td class="text-right">${formatarValor(Number(i.custo_nf) || 0)}</td>
              <td class="text-right">${formatarValor(Number(i.custo_servico) || 0)}</td>
              <td class="text-right">${formatarValor(Number(i.custo_condicao) || 0)}</td>
              <td>${i.nf_referencia || '-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${Number(config?.percentual_markup) > 0 ? `<div class="markup-info">Markup ${config?.percentual_markup}% (${baseMarkupLabel}) — NF: ${formatarMoeda(totais.markupNF)} | Serviço: ${formatarMoeda(totais.markupServico)} | Condição: ${formatarMoeda(totais.markupCondicao)}</div>` : ''}
        <div class="totais">
          <div class="total-box"><div class="label">NF</div><div class="valor">${formatarMoeda(totais.totalNF + totais.markupNF)}</div></div>
          <div class="total-box"><div class="label">Serviço</div><div class="valor">${formatarMoeda(totais.totalServico + totais.markupServico)}</div></div>
          <div class="total-box"><div class="label">Condição</div><div class="valor">${formatarMoeda(totais.totalCondicao + totais.markupCondicao)}</div></div>
          <div class="total-box destaque"><div class="label">Custo Total</div><div class="valor">${formatarMoeda(totais.custoTotal)}</div></div>
        </div>
      </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BiMaster';
    const ws = workbook.addWorksheet('Ficha de Custos');

    ws.mergeCells('A1:H1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `Ficha de Custos - ${produto?.nome || ''}`;
    titleCell.font = { bold: true, size: 14 };
    
    ws.mergeCells('A2:H2');
    ws.getCell('A2').value = `Código: ${produto?.codigo || ''} | Origem: ${produto?.origem === 'importado' ? 'Importado' : 'Nacional'}`;
    ws.getCell('A2').font = { color: { argb: 'FF666666' } };

    ws.getCell('A4').value = 'Fornecedor M.O.';
    ws.getCell('B4').value = config?.fornecedor_mao_obra || '-';
    ws.getCell('C4').value = 'M.O. NF';
    ws.getCell('D4').value = Number(config?.custo_mao_obra_nf) || 0;
    ws.getCell('E4').value = 'M.O. Serviço';
    ws.getCell('F4').value = Number(config?.custo_mao_obra_servico) || 0;
    ws.getCell('G4').value = 'Markup';
    ws.getCell('H4').value = `${config?.percentual_markup || 0}%`;
    ['A4','C4','E4','G4'].forEach(c => { ws.getCell(c).font = { bold: true }; });

    const headers = ['Código', 'Insumo', 'Tipo', 'Fornecedor', 'NF (R$)', 'Serviço (R$)', 'Condição (R$)', 'NF Ref.'];
    ws.addRow([]);
    ws.addRow(headers);
    const hRow = ws.getRow(ws.rowCount);
    hRow.font = { bold: true };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    insumos.forEach(i => {
      ws.addRow([
        i.codigo, i.nome, getTipoLabel(i.tipo_insumo), i.fornecedor || '',
        Number(i.custo_nf) || 0, Number(i.custo_servico) || 0, Number(i.custo_condicao) || 0,
        i.nf_referencia || '',
      ]);
    });

    ws.addRow([]);
    const totRow = ws.addRow(['', '', '', 'TOTAIS', totais.totalNF + totais.markupNF, totais.totalServico + totais.markupServico, totais.totalCondicao + totais.markupCondicao, '']);
    totRow.font = { bold: true };
    ws.addRow(['', '', '', 'CUSTO TOTAL', totais.custoTotal]);
    ws.getRow(ws.rowCount).font = { bold: true, size: 12 };

    ws.columns = [
      { width: 12 }, { width: 30 }, { width: 18 }, { width: 18 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `ficha-custos-${produto?.codigo || 'produto'}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Banner de status de aprovação */}
      {config?.id && (
        <FichaAprovacaoBanner
          status={statusAprovacao}
          parecer={revisaoAtiva?.parecer}
        />
      )}

      {/* Apontamentos da diretoria */}
      {statusAprovacao === "revisao_solicitada" && apontamentos.length > 0 && (
        <FichaApontamentosPanel apontamentos={apontamentos} insumos={insumos} />
      )}

      {/* Requisitos obrigatórios e painel de resubmissão */}
      {statusAprovacao === "revisao_solicitada" && (
        <Card className="border-accent/50 bg-accent/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Requisitos Obrigatórios para Resubmissão
              </CardTitle>
              <div className="flex gap-2">
                {onSubmeterAprovacao && config?.id && (() => {
                  const pendentes = requisitos.filter((r: any) => !r.cumprido && !r.contestado);
                  const todosCumpridos = pendentes.length === 0;
                  return todosCumpridos ? (
                    <Button onClick={onSubmeterAprovacao} disabled={submitting} size="sm">
                      <SendHorizonal className="h-4 w-4 mr-2" />
                      {submitting ? "Submetendo..." : "Resubmeter para Aprovação"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTermoCiencia(true)}
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Avançar com Termo de Ciência ({pendentes.length} pendente{pendentes.length > 1 ? 's' : ''})
                    </Button>
                  );
                })()}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {requisitos.length > 0 ? (
              <>
                {requisitos.map((req: any) => {
                  const insumoNome = req.insumo_id ? insumos.find(i => i.id === req.insumo_id) : null;
                  const canUpload = !req.cumprido && !req.contestado && (req.tipo === "evidencia" || req.tipo === "orcamentos");
                  const isContestado = req.contestado;
                  const isResolvido = req.cumprido;
                  
                  return (
                    <div key={req.id} className={`p-3 rounded-lg border space-y-2 ${
                      isResolvido ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" 
                      : isContestado ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
                      : "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800"
                    }`}>
                      <div className="flex items-center gap-3">
                        <Badge variant={isResolvido ? "default" : isContestado ? "secondary" : "destructive"} className="text-xs shrink-0">
                          {isResolvido ? "✓ Cumprido" : isContestado ? "⚖ Contestado" : "Pendente"}
                        </Badge>
                        <span className="text-sm flex-1">
                          {req.descricao}
                          {req.quantidade_minima > 1 && ` (mín. ${req.quantidade_minima})`}
                          {insumoNome && <span className="text-muted-foreground"> — {(insumoNome as any).codigo} {(insumoNome as any).nome}</span>}
                        </span>
                        {!isResolvido && !isContestado && (
                          <div className="flex gap-1.5 shrink-0">
                            {/* Resolver */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() => { setResolucaoReq(req); setResolucaoDescricao(""); }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Resolver
                            </Button>
                            {/* Upload for evidence/quotes */}
                            {canUpload && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-xs"
                                  disabled={uploadingFor === req.id}
                                  onClick={() => document.getElementById(`req-upload-${req.id}`)?.click()}
                                >
                                  {uploadingFor === req.id ? <span className="animate-spin">⏳</span> : <Upload className="h-3.5 w-3.5" />}
                                  {req.tipo === "orcamentos" ? "Orçamento" : "Evidência"}
                                </Button>
                                <input
                                  id={`req-upload-${req.id}`}
                                  type="file"
                                  multiple
                                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const files = e.target.files;
                                    if (!files || !produto?.id) return;
                                    setUploadingFor(req.id);
                                    try {
                                      for (const file of Array.from(files)) {
                                        const ext = file.name.split('.').pop();
                                        const targetId = req.insumo_id || 'geral';
                                        const path = `${produto.id}/${targetId}/${crypto.randomUUID()}.${ext}`;
                                        const { error: uploadError } = await supabase.storage.from("fabrica-custo-evidencias").upload(path, file);
                                        if (uploadError) throw uploadError;
                                        const { data: signedData, error: signError } = await supabase.storage.from("fabrica-custo-evidencias").createSignedUrl(path, 31536000);
                                        if (signError || !signedData?.signedUrl) throw signError || new Error('Falha ao gerar URL');
                                        const user = (await supabase.auth.getUser()).data.user;
                                         await supabase.from("fabrica_custo_evidencias" as any).insert({
                                          produto_custo_id: req.insumo_id || config?.id,
                                          produto_id: produto.id,
                                          nome_arquivo: file.name,
                                          url_arquivo: signedData.signedUrl,
                                          tipo_arquivo: file.type,
                                          tamanho_bytes: file.size,
                                          usuario_id: user?.id,
                                          usuario_nome: user?.user_metadata?.nome || user?.email || "",
                                          requisito_id: req.id,
                                        } as any);
                                      }
                                      toast.success("Arquivo(s) enviado(s)!");
                                      if (req.insumo_id) carregarEvidencias(req.insumo_id);
                                    } catch (err: any) {
                                      toast.error("Erro ao enviar: " + err.message);
                                    } finally {
                                      setUploadingFor(null);
                                      e.target.value = "";
                                    }
                                  }}
                                />
                              </>
                            )}
                            {/* Contestar */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs text-muted-foreground"
                              onClick={() => { setContestacaoReq(req); setContestacaoMotivo(""); }}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              Contestar
                            </Button>
                          </div>
                        )}
                      </div>
                      {/* Show contestation reason */}
                      {isContestado && req.contestacao_motivo && (
                        <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded ml-6">
                          <strong>Defesa apresentada:</strong> {req.contestacao_motivo}
                        </div>
                      )}
                      {/* Show resolution description */}
                      {isResolvido && req.resolvido_manualmente && req.resolucao_descricao && (
                        <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded ml-6">
                          <strong>Resolução:</strong> {req.resolucao_descricao}
                        </div>
                      )}
                    </div>
                  );
                })}
                {(() => {
                  const pendentes = requisitos.filter((r: any) => !r.cumprido && !r.contestado);
                  const contestados = requisitos.filter((r: any) => r.contestado);
                  return pendentes.length > 0 ? (
                    <p className="text-xs text-destructive font-medium mt-1">
                      ⚠ {pendentes.length} requisito(s) pendente(s){contestados.length > 0 ? ` e ${contestados.length} contestado(s)` : ''}. Resolva-os ou avance com Termo de Ciência.
                    </p>
                  ) : (
                    <p className="text-xs text-green-600 font-medium mt-1">
                      ✓ Todos os requisitos foram cumpridos ou contestados! Clique em "Resubmeter para Aprovação".
                    </p>
                  );
                })()}
              </>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Nenhum requisito específico definido pela Diretoria. Você pode resubmeter quando estiver pronto.
                </p>
                {onSubmeterAprovacao && config?.id && (
                  <Button onClick={onSubmeterAprovacao} disabled={submitting} size="sm">
                    <SendHorizonal className="h-4 w-4 mr-2" />
                    {submitting ? "Submetendo..." : "Resubmeter para Aprovação"}
                  </Button>
                )}
              </div>
            )}

            {/* Upload geral de evidências */}
            <div className="pt-2 border-t">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={uploadingFor === 'geral-requisito'}
                  onClick={() => document.getElementById('req-upload-geral')?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Enviar Evidência / Comprovante Geral
                </Button>
                <input
                  id="req-upload-geral"
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || !produto?.id || !config?.id) return;
                    setUploadingFor('geral-requisito');
                    try {
                      for (const file of Array.from(files)) {
                        const ext = file.name.split('.').pop();
                        const path = `${produto.id}/geral/${crypto.randomUUID()}.${ext}`;
                        const { error: uploadError } = await supabase.storage.from("fabrica-custo-evidencias").upload(path, file);
                        if (uploadError) throw uploadError;
                        const { data: signedData, error: signError } = await supabase.storage.from("fabrica-custo-evidencias").createSignedUrl(path, 31536000);
                        if (signError || !signedData?.signedUrl) throw signError || new Error('Falha ao gerar URL');
                        const user = (await supabase.auth.getUser()).data.user;
                        await supabase.from("fabrica_custo_evidencias" as any).insert({
                          produto_custo_id: config.id,
                          produto_id: produto.id,
                          nome_arquivo: file.name,
                          url_arquivo: signedData.signedUrl,
                          tipo_arquivo: file.type,
                          tamanho_bytes: file.size,
                          usuario_id: user?.id,
                          usuario_nome: user?.user_metadata?.nome || user?.email || "",
                        } as any);
                      }
                      toast.success("Evidência(s) geral(is) enviada(s)!");
                    } catch (err: any) {
                      toast.error("Erro ao enviar: " + err.message);
                    } finally {
                      setUploadingFor(null);
                      e.target.value = "";
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">PDF, imagens, Word, Excel</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {revisaoAtiva?.id && (statusAprovacao === "revisao_solicitada" || statusAprovacao === "em_revisao") && (
        <RevisaoChatPanel
          revisaoId={revisaoAtiva.id}
          configId={revisaoAtiva.config_id}
          insumos={insumos.map((i) => ({ id: i.id, nome: i.nome, codigo: i.codigo }))}
          tipoRemetente="usuario"
          insumosComApontamento={new Set(apontamentos.filter(a => a.insumo_id).map(a => a.insumo_id!))}
          onNavigateToInsumo={(insumoId) => {
            // Expand the row first
            setExpandedInsumos((prev) => {
              const next = new Set(prev);
              next.add(insumoId);
              return next;
            });
            carregarEvidencias(insumoId);
            carregarHistoricoRecente(insumoId);
            // Scroll to the row
            setTimeout(() => {
              const el = document.getElementById(`insumo-row-${insumoId}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-primary", "ring-offset-1");
                setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-1"), 2500);
              }
            }, 100);
          }}
        />
      )}

      {/* Timeline de histórico de solicitações */}
      {config?.id && (
        <RequisitosHistoricoTimeline produtoId={produto.id} configId={config.id} />
      )}

      {/* Header do produto */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {produto?.foto_url && (
                <img
                  src={produto.foto_url}
                  alt={produto.nome}
                  className="h-14 w-14 rounded-lg object-contain border bg-muted/30 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div>
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl">
                    Ficha de Custos – {produto?.nome}
                  </CardTitle>
                  {produto?.tipo === "DISPLAY" && (
                    <DisplayGradePopover
                      produtoId={produto.id}
                      produtoNome={produto.nome}
                      produtoCodigo={produto.codigo}
                    />
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                  <span>Código: <span className="font-mono">{produto?.codigo}</span></span>
                  <span>|</span>
                  <span className="flex items-center gap-1">
                    Origem:{" "}
                    <Badge variant={produto?.origem === "importado" ? "destructive" : "secondary"}>
                      {produto?.origem === "importado" ? "Importado" : "Nacional"}
                    </Badge>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Configuração M.O. e Markup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {isDisplayComKit && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
              <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">
                Para Displays com produtos importados do Kit, a M.O. e Markup já estão incluídos no custo de cada unidade.
                {todosInsumosKit 
                  ? " Valores de M.O. e Markup nesta configuração serão ignorados."
                  : " M.O. e Markup serão aplicados somente sobre insumos que não são do Kit."}
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fornecedor_mo">Fornecedor M.O.</Label>
              <Input
                id="fornecedor_mo"
                value={config?.fornecedor_mao_obra || ""}
                onChange={(e) =>
                  onAtualizarConfig("fornecedor_mao_obra", e.target.value)
                }
                placeholder="Ex: Rodrigues"
                disabled={isLocked}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo_nf">M.O. NF (R$)</Label>
              <DecimalInput
                id="mo_nf"
                value={config?.custo_mao_obra_nf ?? 0}
                onChange={(val) => onAtualizarConfig("custo_mao_obra_nf", val)}
                placeholder="0.000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mo_servico">M.O. Serviço (R$)</Label>
              <DecimalInput
                id="mo_servico"
                value={config?.custo_mao_obra_servico ?? 0}
                onChange={(val) => onAtualizarConfig("custo_mao_obra_servico", val)}
                placeholder="0.000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="markup">Markup (%)</Label>
              <DecimalInput
                id="markup"
                value={config?.percentual_markup ?? 0}
                onChange={(val) => onAtualizarConfig("percentual_markup", val)}
                placeholder="10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="base_markup">Base do Markup</Label>
              <Select
                value={config?.base_calculo_markup || "total"}
                onValueChange={(value) =>
                  onAtualizarConfig("base_calculo_markup", value as BaseCalculoMarkup)
                }
                disabled={isLocked}
              >
                <SelectTrigger id="base_markup">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Totais (NF+Serv+Cond)</SelectItem>
                  <SelectItem value="nf_servico">NF + Serviço</SelectItem>
                  <SelectItem value="nf">Somente NF</SelectItem>
                  <SelectItem value="servico">Somente Serviço</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground italic">
                💡 A base mais utilizada nos seus lançamentos é <span className="font-medium text-foreground/70">NF + Serviço</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Insumos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Insumos</CardTitle>
            <div className="flex gap-2 flex-wrap">
              {produto?.tipo === "DISPLAY" && custosFilhos.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setImportDialogAberto(true)}
                  disabled={loadingFilhos}
                >
                  {loadingFilhos ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PackageOpen className="h-4 w-4 mr-1" />}
                  Importar do Kit
                </Button>
              )}
              {produto?.tipo === "DISPLAY" && onRecarregarCustosFilhos && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRecarregarCustosFilhos}
                  disabled={loadingFilhos}
                  title="Atualizar custos dos produtos filhos"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingFilhos ? 'animate-spin' : ''}`} />
                </Button>
              )}
              <ImportarInsumosIA
                onImportar={(insumos) => {
                  insumos.forEach((insumo) => onAdicionarInsumo(insumo));
                }}
              />
              <Button size="sm" onClick={() => setDialogAberto(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {insumos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum insumo adicionado. Clique em "Adicionar" para começar.
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="min-w-[80px]">Código</TableHead>
                    <TableHead className="min-w-[180px]">Insumo</TableHead>
                    <TableHead className="min-w-[140px]">Tipo</TableHead>
                    <TableHead className="min-w-[140px]">Fornecedor</TableHead>
                    <TableHead className="min-w-[110px] text-right">NF (R$)</TableHead>
                    <TableHead className="min-w-[110px] text-right">Serviço (R$)</TableHead>
                    <TableHead className="min-w-[110px] text-right">Condição (R$)</TableHead>
                    <TableHead className="min-w-[120px]">NF Ref.</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {insumos.map((insumo) => {
                    const temApontamento = apontamentosPorInsumo.has(insumo.id);
                    const apts = apontamentosPorInsumo.get(insumo.id) || [];
                    const isExpanded = expandedInsumos.has(insumo.id);
                    const insumoEvidencias = evidencias[insumo.id] || [];
                    const campoLabels: Record<string, string> = { custo_nf: "Custo NF", custo_servico: "Custo Serviço", custo_condicao: "Custo Condição" };

                    return (
                      <React.Fragment key={insumo.id}>
                        <TableRow id={`insumo-row-${insumo.id}`} className={`${temApontamento ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500" : ""} ${insumo.tipo_insumo === "importado_kit" ? "bg-blue-50/50 dark:bg-blue-950/20 border-l-2 border-l-blue-500" : ""}`}>
                          <TableCell className="px-2">
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleExpanded(insumo.id)}
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                              {!isExpanded && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-1">
                              {insumo.codigo}
                              {temApontamento && (
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {insumo.nome}
                              {insumo.tipo_insumo === "importado_kit" && (
                                <>
                                  <Link2 className="h-3 w-3 text-blue-500" />
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">Kit</Badge>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={insumo.tipo_insumo}
                              onValueChange={(value) =>
                                onAtualizarInsumo(insumo.id, "tipo_insumo", value)
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {tiposInsumo.map((tipo) => (
                                  <SelectItem key={tipo.value} value={tipo.value}>
                                    {tipo.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={insumo.fornecedor || ""}
                              onChange={(e) =>
                                onAtualizarInsumo(insumo.id, "fornecedor", e.target.value)
                              }
                              className="h-9"
                              placeholder="Fornecedor"
                            />
                          </TableCell>
                          <TableCell>
                            <DecimalInput
                              value={insumo.custo_nf}
                              onChange={(val) => handleCustoChange(insumo.id, "custo_nf", typeof val === "string" ? val : Number(val))}
                              className="h-9 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <DecimalInput
                              value={insumo.custo_servico}
                              onChange={(val) => handleCustoChange(insumo.id, "custo_servico", typeof val === "string" ? val : Number(val))}
                              className="h-9 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <DecimalInput
                              value={insumo.custo_condicao}
                              onChange={(val) => handleCustoChange(insumo.id, "custo_condicao", typeof val === "string" ? val : Number(val))}
                              className="h-9 text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={insumo.nf_referencia || ""}
                              onChange={(e) =>
                                onAtualizarInsumo(insumo.id, "nf_referencia", e.target.value)
                              }
                              className="h-9"
                              placeholder="NF12345"
                            />
                          </TableCell>
                          <TableCell className="px-2">
                            <div className="flex gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setXmlVincularInsumo({ id: insumo.id, nome: insumo.nome, mp_id: insumo.mp_id || null })}
                                title="Vincular XML da NF-e"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setHistoricoInsumo({ id: insumo.id, nome: insumo.nome })}
                                title="Histórico de custos"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => onRemoverInsumo(insumo.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Linha expandida com detalhes do insumo */}
                        {isExpanded && (
                          <TableRow className={temApontamento ? "bg-red-50/50 dark:bg-red-950/10" : "bg-muted/30"}>
                            <TableCell colSpan={10} className="p-0">
                              <div className="p-4 space-y-4">
                                {/* Apontamentos da diretoria (se houver) */}
                                {temApontamento && (
                                  <div>
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                                      <AlertTriangle className="h-4 w-4 text-destructive" />
                                      Solicitações da Diretoria
                                    </h4>
                                    <div className="space-y-2">
                                      {apts.map((a) => (
                                        <div key={a.id} className="p-3 bg-background rounded-lg border space-y-1">
                                          <div className="flex items-center justify-between">
                                            <Badge variant="outline" className="text-xs">{campoLabels[a.campo] || a.campo}</Badge>
                                            {a.atendido && <Badge className="bg-green-100 text-green-800 text-xs">Atendido</Badge>}
                                          </div>
                                          <div className="flex items-center gap-2 text-sm">
                                            <span className="text-muted-foreground">Atual: {formatarMoeda(Number(a.valor_atual))}</span>
                                            <ArrowRight className="h-3 w-3 text-destructive" />
                                            <span className="font-semibold text-destructive">{formatarMoeda(Number(a.valor_sugerido))}</span>
                                          </div>
                                          {a.comentario && (
                                            <p className="text-xs text-muted-foreground italic">"{a.comentario}"</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Histórico de alterações recentes */}
                                {(historicoRecente[insumo.id] || []).length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                                      <History className="h-4 w-4" />
                                      Alterações Recentes
                                    </h4>
                                    <div className="space-y-1">
                                      {(historicoRecente[insumo.id] || []).map((h: any) => {
                                        const variacao = Number(h.valor_anterior) > 0
                                          ? ((Number(h.valor_novo) - Number(h.valor_anterior)) / Number(h.valor_anterior)) * 100
                                          : 0;
                                        const aumentou = variacao > 0;
                                        return (
                                          <div key={h.id} className="flex items-center gap-3 p-2 bg-background rounded border text-xs">
                                            <span className="text-muted-foreground whitespace-nowrap">
                                              {new Date(h.created_at).toLocaleDateString("pt-BR")}
                                            </span>
                                            <Badge variant="outline" className="text-[10px]">
                                              {campoLabels[h.campo] || h.campo}
                                            </Badge>
                                            <span className="font-mono">
                                              {formatarMoeda(Number(h.valor_anterior))} → {formatarMoeda(Number(h.valor_novo))}
                                            </span>
                                            <span className={`font-medium ${aumentou ? "text-red-600" : "text-green-600"}`}>
                                              {aumentou ? "+" : ""}{variacao.toFixed(1)}%
                                            </span>
                                            {h.motivo && <span className="text-muted-foreground truncate max-w-[150px]">{h.motivo}</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="h-6 px-0 text-xs mt-1"
                                      onClick={() => setHistoricoInsumo({ id: insumo.id, nome: insumo.nome })}
                                    >
                                      Ver histórico completo →
                                    </Button>
                                  </div>
                                )}

                                {/* Insumos da Origem (para itens importados do Kit) */}
                                {insumo.tipo_insumo === "importado_kit" && insumo.codigo && (
                                  <div className="ml-4 pl-4 border-l-2 border-l-blue-500/60 relative">
                                    <div className="absolute -left-[1px] top-0 w-4 h-0 border-t-2 border-t-blue-500/60" />
                                    <InsumosOrigemPanel codigoProdutoOrigem={insumo.codigo} />
                                  </div>
                                )}

                                {/* Cotações / Orçamentos */}
                                <CotacoesInsumoPanel
                                  produtoCustoId={insumo.id}
                                  produtoId={produto?.id || ""}
                                  mpId={insumo.mp_id}
                                  custoAtualNF={Number(insumo.custo_nf) || 0}
                                  custoAtualServico={Number(insumo.custo_servico) || 0}
                                  custoAtualCondicao={Number(insumo.custo_condicao) || 0}
                                  insumoNome={insumo.nome}
                                  onAplicarCotacao={(fornecedorNome, custoNF, custoServico, custoCondicao) => {
                                    // Aplicar os 3 campos de custo vindos da cotação
                                    const motivo = `Cotação aprovada - ${fornecedorNome}`;
                                    onAtualizarInsumo(insumo.id, "custo_nf", custoNF);
                                    onAtualizarInsumo(insumo.id, "custo_servico", custoServico);
                                    onAtualizarInsumo(insumo.id, "custo_condicao", custoCondicao);
                                    onAtualizarInsumo(insumo.id, "fornecedor", fornecedorNome);
                                    toast.success(`Cotação de ${fornecedorNome} aplicada com sucesso`);
                                  }}
                                />

                                {/* Upload de evidências */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                                    <Paperclip className="h-4 w-4" />
                                    Evidências / Arquivos
                                  </h4>

                                  {insumoEvidencias.length > 0 && (
                                    <div className="space-y-1 mb-3">
                                      {insumoEvidencias.map((ev: any) => (
                                        <div key={ev.id} className="flex items-center gap-2 p-2 bg-background rounded border text-sm">
                                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                          <span className="flex-1 truncate">{ev.nome_arquivo}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {ev.tamanho_bytes ? `${(ev.tamanho_bytes / 1024).toFixed(0)} KB` : ""}
                                          </span>
                                          <span className="text-xs text-muted-foreground">{ev.usuario_nome}</span>
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                                            try {
                                              const { blobUrl, error } = await downloadStorageBlob(ev.url_arquivo);
                                              if (error || !blobUrl) { toast.error(error || "Erro ao abrir arquivo"); return; }
                                              window.open(blobUrl, "_blank");
                                            } catch { toast.error("Erro ao abrir arquivo"); }
                                          }} title="Visualizar">
                                            <Eye className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemoverEvidencia(ev.id, insumo.id)} title="Remover">
                                            <X className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="file"
                                      className="hidden"
                                      multiple
                                      onChange={(e) => {
                                        const files = e.target.files;
                                        if (files) Array.from(files).forEach((f) => handleUploadEvidencia(insumo.id, f));
                                        e.target.value = "";
                                      }}
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      type="button"
                                      disabled={uploadingFor === insumo.id}
                                      onClick={(e) => {
                                        const input = (e.currentTarget.parentElement as HTMLLabelElement)?.querySelector("input");
                                        input?.click();
                                      }}
                                    >
                                      <Upload className="h-4 w-4 mr-1" />
                                      {uploadingFor === insumo.id ? "Enviando..." : "Anexar Evidência"}
                                    </Button>
                                  </label>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linha de Markup */}
      {config && Number(config.percentual_markup) > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm flex-wrap gap-2">
              <span className="font-medium">
                Markup {config.percentual_markup}%
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  ({config.base_calculo_markup === 'nf' ? 'sobre NF' : config.base_calculo_markup === 'servico' ? 'sobre Serviço' : config.base_calculo_markup === 'nf_servico' ? 'sobre NF+Serviço' : 'sobre Totais'})
                </span>
              </span>
              <div className="flex gap-6">
                <span>
                  NF: <strong>{formatarMoeda(totais.markupNF)}</strong>
                </span>
                <span>
                  Serv: <strong>{formatarMoeda(totais.markupServico)}</strong>
                </span>
                <span>
                  Cond: <strong>{formatarMoeda(totais.markupCondicao)}</strong>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totais</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">NF</p>
              <p className="text-xl font-bold">{formatarMoeda(totais.totalNF + totais.markupNF)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Serviço</p>
              <p className="text-xl font-bold">{formatarMoeda(totais.totalServico + totais.markupServico)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Condição</p>
              <p className="text-xl font-bold">{formatarMoeda(totais.totalCondicao + totais.markupCondicao)}</p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg text-center border-2 border-primary">
              <p className="text-sm text-muted-foreground">Custo Total</p>
              <p className="text-2xl font-bold text-primary">
                {formatarMoeda(totais.custoTotal)}
              </p>
            </div>
          </div>

          {/* Regra aplicada */}
          {config && Number(config.percentual_markup) > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                {config.base_calculo_markup === 'total' && `Markup de ${config.percentual_markup}% aplicado sobre NF + Serviço + Condição`}
                {config.base_calculo_markup === 'nf_servico' && `Markup de ${config.percentual_markup}% aplicado sobre NF + Serviço`}
                {config.base_calculo_markup === 'nf' && `Markup de ${config.percentual_markup}% aplicado somente sobre NF`}
                {config.base_calculo_markup === 'servico' && `Markup de ${config.percentual_markup}% aplicado somente sobre Serviço`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintPDF}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={() => evidenciaFileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Subir Evidências
          </Button>
          <input
            ref={evidenciaFileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleEvidenciaGeral}
          />
        </div>
        <div className="flex gap-2">
          {!isLocked && (
            <Button onClick={onSalvar} disabled={saving} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Ficha"}
            </Button>
          )}
          {statusAprovacao === "rascunho" && onSubmeterAprovacao && config?.id && (
            <Button
              onClick={onSubmeterAprovacao}
              disabled={submitting}
              title="Submeter para aprovação da diretoria"
            >
              <SendHorizonal className="h-4 w-4 mr-2" />
              {submitting ? "Submetendo..." : "Submeter para Aprovação"}
            </Button>
          )}
          {statusAprovacao === "revisao_solicitada" && onSubmeterAprovacao && config?.id && (() => {
            const pendentes = requisitos.filter((r: any) => !r.cumprido && !r.contestado);
            return pendentes.length === 0 ? (
              <Button onClick={onSubmeterAprovacao} disabled={submitting}>
                <SendHorizonal className="h-4 w-4 mr-2" />
                {submitting ? "Submetendo..." : "Resubmeter para Aprovação"}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowTermoCiencia(true)}
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Avançar com Termo ({pendentes.length} pendente{pendentes.length > 1 ? 's' : ''})
              </Button>
            );
          })()}
        </div>
      </div>

      {/* Dialog de adicionar */}
      <AdicionarInsumoCustoDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onAdicionar={onAdicionarInsumo}
      />

      {/* Dialog de histórico de custos */}
      {historicoInsumo && (
        <HistoricoCustosInsumoDialog
          open={!!historicoInsumo}
          onOpenChange={(open) => !open && setHistoricoInsumo(null)}
          produtoCustoId={historicoInsumo.id}
          insumoNome={historicoInsumo.nome}
        />
      )}

      {/* Dialog de justificativa de alteração */}
      {alteracaoCusto && (
        <AlterarCustoDialog
          open={!!alteracaoCusto}
          onOpenChange={(open) => !open && setAlteracaoCusto(null)}
          insumoNome={alteracaoCusto.insumoNome}
          campo={alteracaoCusto.campo}
          valorAnterior={alteracaoCusto.valorAnterior}
          valorNovo={alteracaoCusto.valorNovo}
          onConfirmar={handleConfirmarAlteracao}
        />
      )}

      {/* Dialog de contestação de requisito */}
      <Dialog open={!!contestacaoReq} onOpenChange={(open) => !open && setContestacaoReq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contestar Requisito</DialogTitle>
            <DialogDescription>
              Apresente sua defesa explicando por que discorda deste requisito. A Diretoria avaliará sua argumentação.
            </DialogDescription>
          </DialogHeader>
          {contestacaoReq && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <strong>Requisito:</strong> {contestacaoReq.descricao}
              </div>
              <div className="space-y-2">
                <Label>Motivo da Contestação / Defesa</Label>
                <Textarea
                  value={contestacaoMotivo}
                  onChange={(e) => setContestacaoMotivo(e.target.value)}
                  placeholder="Explique por que este requisito não se aplica ou já foi atendido de outra forma..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setContestacaoReq(null)}>Cancelar</Button>
            <Button
              onClick={handleContestar}
              disabled={!contestacaoMotivo.trim() || !!contestandoId}
            >
              {contestandoId ? "Enviando..." : "Enviar Contestação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de resolução manual de requisito */}
      <Dialog open={!!resolucaoReq} onOpenChange={(open) => !open && setResolucaoReq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Requisito</DialogTitle>
            <DialogDescription>
              Descreva como este requisito foi atendido. Você também pode anexar evidências na seção de upload.
            </DialogDescription>
          </DialogHeader>
          {resolucaoReq && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <strong>Requisito:</strong> {resolucaoReq.descricao}
              </div>
              <div className="space-y-2">
                <Label>Descrição da Resolução</Label>
                <Textarea
                  value={resolucaoDescricao}
                  onChange={(e) => setResolucaoDescricao(e.target.value)}
                  placeholder="Descreva o que foi feito para atender este requisito..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolucaoReq(null)}>Cancelar</Button>
            <Button
              onClick={handleResolver}
              disabled={!resolucaoDescricao.trim() || !!resolvendoId}
            >
              {resolvendoId ? "Salvando..." : "Marcar como Resolvido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Termo de Ciência */}
      <Dialog open={showTermoCiencia} onOpenChange={setShowTermoCiencia}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-destructive" />
              Termo de Ciência
            </DialogTitle>
            <DialogDescription>
              Você está prestes a submeter a ficha com requisitos ainda pendentes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm space-y-2">
              <p className="font-semibold text-destructive">Requisitos não atendidos:</p>
              <ul className="list-disc pl-5 space-y-1">
                {requisitos.filter((r: any) => !r.cumprido && !r.contestado).map((r: any) => (
                  <li key={r.id}>{r.descricao}</li>
                ))}
              </ul>
            </div>
            <div className="p-4 bg-muted rounded-lg text-sm">
              <p>
                Ao prosseguir, declaro estar <strong>ciente</strong> de que existem requisitos obrigatórios 
                pendentes que não foram atendidos. Assumo <strong>total responsabilidade</strong> por submeter 
                a ficha nestas condições e entendo que a Diretoria poderá rejeitar a submissão.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="aceite-termo"
                checked={termoCienciaAceito}
                onCheckedChange={(checked) => setTermoCienciaAceito(!!checked)}
              />
              <label htmlFor="aceite-termo" className="text-sm font-medium cursor-pointer">
                Li e concordo com os termos acima
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTermoCiencia(false); setTermoCienciaAceito(false); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmeterComTermo}
              disabled={!termoCienciaAceito || submittingComTermo}
              variant="destructive"
            >
              {submittingComTermo ? "Submetendo..." : "Assinar e Submeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog vincular XML ao insumo */}
      {xmlVincularInsumo && (
        <VincularXmlInsumoDialog
          open={!!xmlVincularInsumo}
          onOpenChange={(open) => { if (!open) setXmlVincularInsumo(null); }}
          insumoId={xmlVincularInsumo.id}
          insumoNome={xmlVincularInsumo.nome}
          mpId={xmlVincularInsumo.mp_id}
          onVincular={(dados) => {
            onAtualizarInsumo(xmlVincularInsumo.id, "fornecedor", dados.fornecedor);
            onAtualizarInsumo(xmlVincularInsumo.id, "custo_nf", dados.custo_nf);
            onAtualizarInsumo(xmlVincularInsumo.id, "nf_referencia", dados.nf_referencia);
            onAtualizarInsumo(xmlVincularInsumo.id, "codigo", dados.codigo);
          }}
        />
      )}

      {/* Dialog de importação de custos dos filhos */}
      <Dialog open={importDialogAberto} onOpenChange={setImportDialogAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>📥 Importar Custos dos Produtos do Kit</DialogTitle>
            <DialogDescription>
              Os custos totais de cada produto filho serão importados como insumos editáveis na ficha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {custosFilhos.map((filho) => (
              <div key={filho.produtoFilhoId} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="font-medium text-sm">{filho.produtoFilhoNome}</p>
                  <p className="text-xs text-muted-foreground font-mono">{filho.produtoFilhoCodigo} — ×{filho.quantidade}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Unit: {formatarMoeda(filho.custoUnitarioTotal)}</p>
                  <p className="font-semibold text-sm">{formatarMoeda(filho.custoTotalLinha)}</p>
                </div>
              </div>
            ))}
          </div>
          {custosFilhos.length > 0 && (
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm font-medium">Total a importar:</span>
              <span className="font-bold">{formatarMoeda(custosFilhos.reduce((s, f) => s + f.custoTotalLinha, 0))}</span>
            </div>
          )}
          {custosFilhos.some(f => f.custoUnitarioTotal === 0) && (
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Alguns produtos não possuem ficha de custos preenchida.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogAberto(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                setImportando(true);
                try {
                  await onImportarCustosFilhos?.();
                  setImportDialogAberto(false);
                } finally {
                  setImportando(false);
                }
              }}
              disabled={importando}
            >
              {importando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PackageOpen className="h-4 w-4 mr-1" />}
              Importar {custosFilhos.length} produto(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
