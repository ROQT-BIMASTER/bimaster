import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logger } from "@/lib/logger";
import {
  Users, Plus, Pencil, Loader2, Building2, MapPin, Phone, Mail,
  QrCode, CreditCard, FileText, Info, RefreshCw, Download, Power, Ban,
} from "lucide-react";
import { CnpjSearchButton, CnpjData } from "@/components/shared/CnpjSearchButton";
import { Link } from "react-router-dom";
import { useEmpresaFilter } from "@/hooks/useEmpresaFilter";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { ErpBadge } from "@/components/cadastros/ErpBadge";
import { CadastroShell } from "@/components/cadastros/CadastroShell";
import type { ColumnDef, TabDef, KpiDef, FilterDef, BatchAction, DetailFooterAction } from "@/components/cadastros/CadastroShell";

interface Fornecedor {
  id: string;
  empresa_id: number | null;
  nome: string;
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  email: string | null;
  telefone: string | null;
  telefone2: string | null;
  endereco: string | null;
  endereco_numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  codigo_externo: string | null;
  fonte_erp: string | null;
  status: string;
  created_at: string;
  situacao_cadastral: string | null;
  matriz_filial: string | null;
  porte: string | null;
  regime_tributario: string | null;
  cnae: string | null;
  capital_social: number | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  optante_simples_nacional: string | null;
  banco: string | null;
  agencia: string | null;
  conta_bancaria: string | null;
  tipo_conta: string | null;
  favorecido: string | null;
  tipo_pix: string | null;
  chave_pix: string | null;
  linha_digitavel: string | null;
  erp_code: string | null;
  erp_synced_at: string | null;
  prazo_pagamento_padrao: number | null;
}

interface FornecedorForm {
  nome: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  email: string;
  telefone: string;
  endereco: string;
  endereco_numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  empresa_id: string;
  codigo_externo: string;
  fonte_erp: string;
  status: string;
  banco: string;
  agencia: string;
  conta_bancaria: string;
  tipo_conta: string;
  favorecido: string;
  tipo_pix: string;
  chave_pix: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  prazo_pagamento_padrao: string;
}

const emptyForm: FornecedorForm = {
  nome: "", cnpj: "", razao_social: "", nome_fantasia: "", email: "", telefone: "",
  endereco: "", endereco_numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "",
  empresa_id: "", codigo_externo: "", fonte_erp: "", status: "ativo",
  banco: "", agencia: "", conta_bancaria: "", tipo_conta: "corrente", favorecido: "",
  tipo_pix: "", chave_pix: "",
  inscricao_estadual: "", inscricao_municipal: "",
  prazo_pagamento_padrao: "",
};

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  const calcDigit = (w: number[]) => {
    let sum = 0;
    for (let i = 0; i < w.length; i++) sum += parseInt(digits[i]) * w[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calcDigit(weights1) === parseInt(digits[12]) && calcDigit(weights2) === parseInt(digits[13]);
}

function statusBadge(status: string) {
  if (status === "ativo") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" variant="outline">Ativo</Badge>;
  if (status === "bloqueado") return <Badge variant="destructive">Bloqueado</Badge>;
  return <Badge variant="secondary">Inativo</Badge>;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Fornecedores() {
  const queryClient = useQueryClient();
  const { empresasDoUsuario, empresaIds } = useEmpresaFilter();

  const STORAGE_KEY = "fornecedores_form_state";
  const getPersistedState = () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        sessionStorage.removeItem(STORAGE_KEY);
        return JSON.parse(raw);
      }
    } catch { /* ignore */ }
    return null;
  };
  const persisted = useState(() => getPersistedState())[0];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(persisted?.dialogOpen ?? false);
  const [form, setForm] = useState<FornecedorForm>(persisted?.form ?? emptyForm);
  const [editingId, setEditingId] = useState<string | null>(persisted?.editingId ?? null);
  const [upsertConfirm, setUpsertConfirm] = useState<{ existingId: string } | null>(null);
  const [dialogTab, setDialogTab] = useState<"basico" | "endereco" | "banco">(persisted?.dialogTab ?? "basico");
  const [syncingErp, setSyncingErp] = useState(false);

  const persistFormState = useCallback(() => {
    if (dialogOpen) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ dialogOpen, form, editingId, dialogTab }));
    }
  }, [dialogOpen, form, editingId, dialogTab]);

  const persistRef = useRef(persistFormState);
  persistRef.current = persistFormState;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistRef.current();
    };
    const handleBeforeUnload = () => persistRef.current();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const visibleEmpresas = empresasDoUsuario;

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores", search, statusFilter, empresaFilter, empresaIds],
    queryFn: async () => {
      let query = supabase.from("fornecedores").select("*").order("nome");
      if (search) query = query.or(`nome.ilike.%${search}%,cnpj.ilike.%${search}%,razao_social.ilike.%${search}%`);
      if (statusFilter !== "todos") query = query.eq("status", statusFilter);

      if (empresaFilter !== "todas") {
        query = query.eq("empresa_id", parseInt(empresaFilter));
      } else if (empresaIds.length > 0) {
        query = query.or(`empresa_id.in.(${empresaIds.join(",")}),empresa_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: Record<string, unknown>; id?: string }) => {
      if (id) {
        const { error } = await supabase.from("fornecedores").update(data as any).eq("id", id);
        if (error) throw error;
        return id;
      } else {
        const { data: inserted, error } = await supabase.from("fornecedores").insert(data as any).select("id").single();
        if (error) throw error;
        return inserted.id;
      }
    },
    onSuccess: async (fornecedorId: string) => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success(editingId ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
      if (!editingId && fornecedorId) {
        await syncWithErp(fornecedorId);
      }
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const syncWithErp = async (fornecedorId: string) => {
    setSyncingErp(true);
    try {
      const cnpjDigits = form.cnpj.replace(/\D/g, "");
      const { data: checkData, error: checkErr } = await supabase.functions.invoke("erp-fornecedores-sync", {
        body: { cnpj: cnpjDigits, path: "/check" },
      });

      if (checkErr) {
        logger.error("ERP check error:", checkErr);
        toast.warning("Fornecedor salvo localmente. Verificação ERP falhou.");
        return;
      }

      if (checkData?.found_in_erp && checkData?.erp_code) {
        toast.info(`Fornecedor já existe no ERP — Código: ${checkData.erp_code}`);
        await supabase.from("fornecedores").update({
          erp_code: String(checkData.erp_code),
          erp_synced_at: new Date().toISOString(),
        }).eq("id", fornecedorId);
        queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
        return;
      }

      const { data: syncData, error: syncErr } = await supabase.functions.invoke("erp-fornecedores-sync", {
        body: { cnpj: cnpjDigits, fornecedor_id: fornecedorId, path: "/sync" },
      });

      if (syncErr) {
        logger.error("ERP sync error:", syncErr);
        toast.warning("Fornecedor salvo localmente. Sincronização ERP pendente.");
        return;
      }

      if (syncData?.synced && syncData?.erp_code) {
        toast.success(`Fornecedor sincronizado com ERP — Código: ${syncData.erp_code}`);
        queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      } else {
        toast.warning(syncData?.message || "Sincronização ERP pendente.");
      }
    } catch (err) {
      logger.error("ERP sync error:", err);
      toast.warning("Fornecedor salvo. Sincronização ERP será tentada depois.");
    } finally {
      setSyncingErp(false);
    }
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("fornecedores").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Status atualizado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const batchStatusMutation = useMutation({
    mutationFn: async ({ ids, newStatus }: { ids: string[]; newStatus: string }) => {
      const { error } = await supabase.from("fornecedores")
        .update({ status: newStatus, updated_at: new Date().toISOString() } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success(`${vars.ids.length} fornecedor(es) atualizados.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleOpenNew = () => {
    const defaultEmpresaId = empresasDoUsuario.length === 1 ? String(empresasDoUsuario[0].id) : "";
    setForm({ ...emptyForm, empresa_id: defaultEmpresaId });
    setEditingId(null);
    setDialogTab("basico");
    setDialogOpen(true);
  };

  const handleEdit = (f: Fornecedor) => {
    setForm({
      nome: f.nome, cnpj: f.cnpj, razao_social: f.razao_social || "",
      nome_fantasia: f.nome_fantasia || "",
      email: f.email || "", telefone: f.telefone || "",
      endereco: f.endereco || "", endereco_numero: f.endereco_numero || "",
      complemento: f.complemento || "", bairro: f.bairro || "",
      cidade: f.cidade || "", estado: f.estado || "", cep: f.cep || "",
      empresa_id: f.empresa_id?.toString() || "", codigo_externo: f.codigo_externo || "",
      fonte_erp: f.fonte_erp || "", status: f.status,
      banco: f.banco || "", agencia: f.agencia || "",
      conta_bancaria: f.conta_bancaria || "", tipo_conta: f.tipo_conta || "corrente",
      favorecido: f.favorecido || "", tipo_pix: f.tipo_pix || "",
      chave_pix: f.chave_pix || "",
      inscricao_estadual: f.inscricao_estadual || "",
      inscricao_municipal: f.inscricao_municipal || "",
      prazo_pagamento_padrao: f.prazo_pagamento_padrao != null ? String(f.prazo_pagamento_padrao) : "",
    });
    setEditingId(f.id);
    setDialogTab("basico");
    setDialogOpen(true);
  };

  const handleCnpjData = (data: CnpjData) => {
    setForm(prev => ({
      ...prev,
      razao_social: data.razaoSocial || prev.razao_social,
      nome_fantasia: data.nomeFantasia || prev.nome_fantasia,
      nome: prev.nome || data.razaoSocial || prev.nome,
      endereco: data.endereco || prev.endereco,
      bairro: data.bairro || prev.bairro,
      cidade: data.cidade || prev.cidade,
      estado: data.uf || prev.estado,
      cep: data.cep || prev.cep,
      telefone: data.telefone || prev.telefone,
      email: data.email || prev.email,
    }));
    if (editingId) {
      const updateFields: Record<string, any> = {};
      if (data.situacao) updateFields.situacao_cadastral = data.situacao;
      if (data.porte) updateFields.porte = data.porte;
      if (data.capitalSocial) updateFields.capital_social = data.capitalSocial;
      if (data.regimeTributario) updateFields.regime_tributario = data.regimeTributario;
      if (data.cnae) updateFields.cnae = data.cnae;
      if (data.matrizFilial) updateFields.matriz_filial = data.matrizFilial;
      if (Object.keys(updateFields).length > 0) {
        supabase.from("fornecedores").update(updateFields as never).eq("id", editingId).then(() => {
          queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
        });
      }
    }
  };

  const buildPayload = useCallback(() => {
    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    return {
      nome: form.nome.trim(),
      cnpj: cnpjDigits,
      razao_social: form.razao_social.trim() || null,
      nome_fantasia: form.nome_fantasia.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      endereco_numero: form.endereco_numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || null,
      cep: form.cep.trim() || null,
      empresa_id: form.empresa_id && form.empresa_id !== "todas" ? parseInt(form.empresa_id) : null,
      codigo_externo: form.codigo_externo.trim() || null,
      fonte_erp: form.fonte_erp.trim() || null,
      status: form.status,
      banco: form.banco.trim() || null,
      agencia: form.agencia.trim() || null,
      conta_bancaria: form.conta_bancaria.trim() || null,
      tipo_conta: form.tipo_conta || null,
      favorecido: form.favorecido.trim() || null,
      tipo_pix: form.tipo_pix || null,
      chave_pix: form.chave_pix.trim() || null,
      inscricao_estadual: form.inscricao_estadual.trim() || null,
      inscricao_municipal: form.inscricao_municipal.trim() || null,
      prazo_pagamento_padrao: form.prazo_pagamento_padrao.trim() ? Number(form.prazo_pagamento_padrao) : null,
      updated_at: new Date().toISOString(),
    };
  }, [form]);

  const handleSave = async () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!validateCNPJ(form.cnpj)) return toast.error("CNPJ inválido");
    if (!form.empresa_id) return toast.error("Empresa é obrigatória");

    const cnpjDigits = form.cnpj.replace(/\D/g, "");

    if (form.empresa_id === "todas" && !editingId) {
      const base = buildPayload();
      const payloads = visibleEmpresas.map(e => ({ ...base, empresa_id: e.id }));
      try {
        for (const p of payloads) {
          const { data: existing } = await supabase.from("fornecedores").select("id").eq("cnpj", cnpjDigits).eq("empresa_id", p.empresa_id).maybeSingle();
          if (existing) {
            await supabase.from("fornecedores").update(p).eq("id", existing.id);
          } else {
            await supabase.from("fornecedores").insert(p);
          }
        }
        toast.success(`Fornecedor cadastrado em ${payloads.length} empresas!`);
        queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
        setDialogOpen(false);
        setForm(emptyForm);
      } catch (err: any) {
        toast.error("Erro ao salvar: " + err.message);
      }
      return;
    }

    if (!editingId) {
      const { data: existing } = await supabase.from("fornecedores").select("id").eq("cnpj", cnpjDigits).maybeSingle();
      if (existing) {
        setUpsertConfirm({ existingId: existing.id });
        return;
      }
    }

    saveMutation.mutate({ data: buildPayload(), id: editingId || undefined });
  };

  const handleUpsertConfirm = () => {
    if (!upsertConfirm) return;
    saveMutation.mutate({ data: buildPayload(), id: upsertConfirm.existingId });
    setUpsertConfirm(null);
  };

  const handleManualErpSync = async (f: Fornecedor) => {
    setSyncingErp(true);
    try {
      const { data, error } = await supabase.functions.invoke("erp-fornecedores-sync", {
        body: { cnpj: f.cnpj, fornecedor_id: f.id, path: "/sync" },
      });
      if (error) throw error;
      if (data?.synced && data?.erp_code) {
        toast.success(`Sincronizado com ERP — Código: ${data.erp_code}`);
      } else {
        toast.warning(data?.message || "Sincronização pendente.");
      }
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
    } catch {
      toast.error("Falha ao sincronizar com ERP");
    } finally {
      setSyncingErp(false);
    }
  };

  const empresaNome = (empresaId: number | null) => {
    if (!empresaId) return "—";
    const e = visibleEmpresas.find((emp) => emp.id === empresaId);
    return e ? e.nome : `#${empresaId}`;
  };

  const handleExportCsv = (ids?: string[]) => {
    const source = ids && ids.length ? fornecedores.filter(f => ids.includes(f.id)) : fornecedores;
    if (!source.length) return toast.info("Nada a exportar.");
    const header = ["Nome", "CNPJ", "Razão Social", "Email", "Cidade", "UF", "Status", "ERP"];
    const rows = source.map(f => [
      f.nome, formatCNPJ(f.cnpj), f.razao_social ?? "", f.email ?? "",
      f.cidade ?? "", f.estado ?? "", f.status, f.erp_code ?? "",
    ]);
    const csv = [header, ...rows].map(r =>
      r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fornecedores-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${source.length} fornecedor(es) exportados.`);
  };

  // ============= KPIs =============
  const kpis: KpiDef[] = useMemo(() => {
    const total = fornecedores.length;
    const ativos = fornecedores.filter(f => f.status === "ativo").length;
    const semErp = fornecedores.filter(f => !f.erp_code).length;
    const semSituacao = fornecedores.filter(f => !f.situacao_cadastral).length;
    return [
      { label: "Total", value: total.toLocaleString("pt-BR") },
      { label: "Ativos", value: ativos.toLocaleString("pt-BR"), severity: "success", hint: total ? `${Math.round((ativos/total)*100)}% do total` : undefined },
      { label: "Sem sync ERP", value: semErp.toLocaleString("pt-BR"), severity: semErp > 0 ? "warning" : "default" },
      { label: "Sem situação RF", value: semSituacao.toLocaleString("pt-BR"), severity: semSituacao > 0 ? "warning" : "default" },
    ];
  }, [fornecedores]);

  // ============= Columns =============
  const columns: ColumnDef<Fornecedor>[] = [
    {
      key: "nome",
      header: "Fornecedor",
      className: "flex-[2]",
      render: (f) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{f.nome}</div>
          <div className="text-xs text-muted-foreground truncate font-mono">{formatCNPJ(f.cnpj)}</div>
        </div>
      ),
    },
    {
      key: "cidade",
      header: "Cidade/UF",
      render: (f) => (
        <span className="text-xs text-muted-foreground truncate block">
          {[f.cidade, f.estado].filter(Boolean).join("/") || "—"}
        </span>
      ),
    },
    {
      key: "erp",
      header: "ERP",
      className: "flex-none w-20",
      render: (f) => <ErpBadge code={f.erp_code} />,
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      className: "flex-none w-24",
      render: (f) => statusBadge(f.status),
    },
  ];

  // ============= Filters =============
  const filters: FilterDef[] = [
    {
      key: "status",
      label: "Status",
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: "todos", label: "Todos" },
        { value: "ativo", label: "Ativo" },
        { value: "inativo", label: "Inativo" },
        { value: "bloqueado", label: "Bloqueado" },
      ],
    },
    {
      key: "empresa",
      label: "Empresa",
      value: empresaFilter,
      onChange: setEmpresaFilter,
      options: [
        { value: "todas", label: "Todas" },
        ...visibleEmpresas.map(e => ({ value: e.id.toString(), label: e.nome })),
      ],
    },
  ];

  // ============= Batch actions =============
  const batchActions: BatchAction[] = [
    {
      key: "ativar",
      label: "Ativar",
      icon: Power,
      variant: "outline",
      onClick: (ids) => batchStatusMutation.mutate({ ids, newStatus: "ativo" }),
    },
    {
      key: "bloquear",
      label: "Bloquear",
      icon: Ban,
      variant: "outline",
      onClick: (ids) => batchStatusMutation.mutate({ ids, newStatus: "bloqueado" }),
    },
    {
      key: "exportar",
      label: "Exportar",
      icon: Download,
      variant: "outline",
      onClick: (ids) => handleExportCsv(ids),
    },
  ];

  // ============= Detail tabs =============
  const tabs: TabDef<Fornecedor>[] = [
    {
      key: "info",
      label: "Informações",
      icon: Info,
      render: (f) => (
        <div className="space-y-5">
          <section>
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Dados Cadastrais</h4>
            <dl className="space-y-2.5">
              <FieldRow label="CNPJ" value={<span className="font-mono">{formatCNPJ(f.cnpj)}</span>} />
              <FieldRow label="Razão Social" value={f.razao_social} />
              <FieldRow label="Nome Fantasia" value={f.nome_fantasia} />
              <FieldRow label="Email" value={f.email && <span className="text-primary">{f.email}</span>} />
              <FieldRow label="Telefone" value={f.telefone} />
              <FieldRow label="Empresa" value={empresaNome(f.empresa_id)} />
              <FieldRow label="Prazo padrão" value={f.prazo_pagamento_padrao ? `${f.prazo_pagamento_padrao} dias` : null} />
            </dl>
          </section>

          <section className="pt-4 border-t border-border/60">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Endereço
            </h4>
            {f.endereco || f.cidade ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {[f.endereco, f.endereco_numero].filter(Boolean).join(", ")}
                {f.complemento ? ` - ${f.complemento}` : ""}
                <br />
                {[f.bairro, f.cidade, f.estado].filter(Boolean).join(" - ")}
                {f.cep && <><br />CEP: {f.cep}</>}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">Não cadastrado</p>
            )}
          </section>
        </div>
      ),
    },
    {
      key: "financeiro",
      label: "Financeiro",
      icon: CreditCard,
      render: (f) => (
        <div className="space-y-5">
          <section>
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <CreditCard className="h-3 w-3" /> Dados Bancários
            </h4>
            {f.banco || f.chave_pix ? (
              <dl className="space-y-2.5">
                {f.banco && <FieldRow label="Banco" value={f.banco} />}
                {f.agencia && <FieldRow label="Agência" value={f.agencia} />}
                {f.conta_bancaria && <FieldRow label="Conta" value={`${f.conta_bancaria}${f.tipo_conta ? ` (${f.tipo_conta})` : ""}`} />}
                {f.favorecido && <FieldRow label="Favorecido" value={f.favorecido} />}
                {f.chave_pix && (
                  <FieldRow
                    label="PIX"
                    value={
                      <span className="flex items-center gap-1.5">
                        <QrCode className="h-3 w-3" />
                        <Badge variant="outline" className="text-[9px]">{f.tipo_pix?.toUpperCase()}</Badge>
                        <span className="font-mono text-xs">{f.chave_pix}</span>
                      </span>
                    }
                  />
                )}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground italic">Não cadastrado</p>
            )}
          </section>

          <section className="pt-4 border-t border-border/60">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Dados Fiscais
            </h4>
            <dl className="space-y-2.5">
              <FieldRow label="Situação RF" value={f.situacao_cadastral} />
              <FieldRow label="Regime" value={f.regime_tributario} />
              <FieldRow label="Porte" value={f.porte} />
              <FieldRow label="CNAE" value={f.cnae} />
              <FieldRow label="IE" value={f.inscricao_estadual} />
              <FieldRow label="IM" value={f.inscricao_municipal} />
              {f.capital_social != null && f.capital_social > 0 && (
                <FieldRow label="Capital Social" value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(f.capital_social)} />
              )}
            </dl>
          </section>
        </div>
      ),
    },
    {
      key: "sync",
      label: "Sincronização",
      icon: RefreshCw,
      render: (f) => (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-background p-3">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Status ERP</div>
            {f.erp_code ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Código</span>
                  <Badge variant="secondary" className="font-mono">{f.erp_code}</Badge>
                </div>
                {f.erp_synced_at && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">Última sync</span>
                    <span className="text-xs">{new Date(f.erp_synced_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground italic">Ainda não sincronizado.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleManualErpSync(f)}
                  disabled={syncingErp}
                  className="w-full gap-2"
                >
                  {syncingErp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Sincronizar agora
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border/60 bg-background p-3">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Consulta Receita Federal</div>
            <CnpjSearchButton
              cnpj={f.cnpj}
              size="sm"
              variant="outline"
              className="w-full"
              onDataFound={(data) => {
                const updateFields: Record<string, any> = { updated_at: new Date().toISOString() };
                if (data.razaoSocial) updateFields.razao_social = data.razaoSocial;
                if (data.nomeFantasia) updateFields.nome_fantasia = data.nomeFantasia;
                if (data.situacao) updateFields.situacao_cadastral = data.situacao;
                if (data.porte) updateFields.porte = data.porte;
                if (data.capitalSocial) updateFields.capital_social = data.capitalSocial;
                if (data.regimeTributario) updateFields.regime_tributario = data.regimeTributario;
                if (data.cnae) updateFields.cnae = data.cnae;
                if (data.matrizFilial) updateFields.matriz_filial = data.matrizFilial;
                if (data.endereco) updateFields.endereco = data.endereco;
                if (data.bairro) updateFields.bairro = data.bairro;
                if (data.cidade) updateFields.cidade = data.cidade;
                if (data.uf) updateFields.estado = data.uf;
                if (data.cep) updateFields.cep = data.cep;
                if (data.telefone) updateFields.telefone = data.telefone;
                if (data.email) updateFields.email = data.email;
                supabase.from("fornecedores").update(updateFields as never).eq("id", f.id).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
                  toast.success("Dados atualizados da Receita Federal!");
                });
              }}
            />
          </div>
        </div>
      ),
    },
  ];

  const footerActions: DetailFooterAction<Fornecedor>[] = [
    {
      key: "toggle",
      label: (fornecedores.find(x => false)?.status === "ativo") ? "Bloquear" : "Bloquear/Ativar",
      variant: "outline",
      icon: Power,
      onClick: (f) => toggleMutation.mutate({ id: f.id, newStatus: f.status === "ativo" ? "bloqueado" : "ativo" }),
    },
    {
      key: "edit",
      label: "Editar",
      icon: Pencil,
      onClick: (f) => handleEdit(f),
    },
  ];

  const tabClasses = (tab: string) =>
    `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      dialogTab === tab
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted"
    }`;

  return (
    <>
      <CadastroShell<Fornecedor>
        title="Fornecedores"
        subtitle="Gerencie parceiros comerciais do módulo Financeiro/Comercial"
        icon={Users}
        breadcrumb={
          <ModuleBreadcrumb
            moduleName="Financeiro"
            moduleHref="/dashboard/financeiro"
            currentPage="Fornecedores"
          />
        }
        banner={
          <Alert className="border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              Fornecedores do módulo Financeiro/Comercial. Para fornecedores da Fábrica, acesse{" "}
              <Link to="/dashboard/fabrica/fornecedores" className="underline font-medium">Fábrica → Fornecedores</Link>.
            </AlertDescription>
          </Alert>
        }
        primaryAction={{ label: "Novo Fornecedor", onClick: handleOpenNew, icon: Plus }}
        secondaryActions={[
          { label: "Exportar", onClick: () => handleExportCsv(), icon: Download },
        ]}
        kpis={kpis}
        items={fornecedores}
        getId={(f) => f.id}
        isLoading={isLoading}
        columns={columns}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Buscar por nome, razão social ou CNPJ...",
        }}
        filters={filters}
        batchActions={batchActions}
        emptyMessage="Nenhum fornecedor encontrado."
        detail={{
          getTitle: (f) => f.nome,
          getSubtitle: (f) => (
            <span className="flex items-center gap-1.5">
              <span className="font-mono">{formatCNPJ(f.cnpj)}</span>
              {f.cidade && <span>· {f.cidade}/{f.estado}</span>}
            </span>
          ),
          getAvatar: (f) => ({ initials: initialsFrom(f.nome_fantasia || f.nome) }),
          getBadges: (f) => (
            <>
              {statusBadge(f.status)}
              {f.situacao_cadastral && (
                <Badge variant={f.situacao_cadastral.toUpperCase() === "ATIVA" ? "outline" : "destructive"} className="text-[10px]">
                  RF: {f.situacao_cadastral}
                </Badge>
              )}
              {f.optante_simples_nacional === "S" && (
                <Badge variant="outline" className="text-[10px]">Simples Nacional</Badge>
              )}
              {f.erp_code && <Badge variant="secondary" className="text-[10px] font-mono">ERP: {f.erp_code}</Badge>}
            </>
          ),
          tabs,
          footerActions,
        }}
      />

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) sessionStorage.removeItem(STORAGE_KEY);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            <DialogDescription>Preencha os dados do fornecedor.</DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 border-b pb-2">
            <button className={tabClasses("basico")} onClick={() => setDialogTab("basico")}>
              <Building2 className="h-3 w-3 inline mr-1" />Dados Básicos
            </button>
            <button className={tabClasses("endereco")} onClick={() => setDialogTab("endereco")}>
              <MapPin className="h-3 w-3 inline mr-1" />Endereço
            </button>
            <button className={tabClasses("banco")} onClick={() => setDialogTab("banco")}>
              <CreditCard className="h-3 w-3 inline mr-1" />Dados Bancários
            </button>
          </div>

          {dialogTab === "basico" && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label>CNPJ *</Label>
                <div className="flex gap-2">
                  <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} placeholder="XX.XXX.XXX/XXXX-XX" maxLength={18} className="flex-1" />
                  <CnpjSearchButton cnpj={form.cnpj} onDataFound={handleCnpjData} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Razão Social</Label>
                  <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Nome Fantasia</Label>
                  <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>IE</Label>
                  <Input value={form.inscricao_estadual} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>IM</Label>
                  <Input value={form.inscricao_municipal} onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Empresa *</Label>
                <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
                  <SelectContent>
                    {!editingId && visibleEmpresas.length > 1 && (
                      <SelectItem value="todas">Cadastrar em todas as empresas</SelectItem>
                    )}
                    {visibleEmpresas.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Código Externo</Label>
                  <Input value={form.codigo_externo} onChange={(e) => setForm({ ...form, codigo_externo: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Fonte ERP</Label>
                  <Input value={form.fonte_erp} onChange={(e) => setForm({ ...form, fonte_erp: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Prazo de pagamento padrão (dias)</Label>
                  <Input
                    type="number" min={0} max={365}
                    value={form.prazo_pagamento_padrao}
                    onChange={(e) => setForm({ ...form, prazo_pagamento_padrao: e.target.value.replace(/[^\d]/g, "") })}
                    placeholder="Ex: 30"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Usado como padrão na integração com o Result para calcular vencimento a partir da emissão.
                  </p>
                </div>
              </div>
            </div>
          )}

          {dialogTab === "endereco" && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5 col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Número</Label>
                  <Input value={form.endereco_numero} onChange={(e) => setForm({ ...form, endereco_numero: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Complemento</Label>
                  <Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Bairro</Label>
                  <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Cidade</Label>
                  <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>UF</Label>
                  <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} />
                </div>
                <div className="grid gap-1.5">
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {dialogTab === "banco" && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Banco</Label>
                  <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Ex: Itaú" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Agência</Label>
                  <Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} placeholder="0000" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Conta</Label>
                  <Input value={form.conta_bancaria} onChange={(e) => setForm({ ...form, conta_bancaria: e.target.value })} placeholder="00000-0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Tipo de Conta</Label>
                  <Select value={form.tipo_conta} onValueChange={(v) => setForm({ ...form, tipo_conta: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta Corrente</SelectItem>
                      <SelectItem value="poupanca">Conta Poupança</SelectItem>
                      <SelectItem value="pagamento">Conta Pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Favorecido</Label>
                  <Input value={form.favorecido} onChange={(e) => setForm({ ...form, favorecido: e.target.value })} placeholder="Nome do titular" />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Tipo de Chave PIX</Label>
                  <Select value={form.tipo_pix} onValueChange={(v) => setForm({ ...form, tipo_pix: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Chave PIX</Label>
                  <Input value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} placeholder="Digite a chave PIX" />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending || syncingErp}>
              {(saveMutation.isPending || syncingErp) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {syncingErp ? "Sincronizando ERP..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!upsertConfirm} onOpenChange={(o) => !o && setUpsertConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>CNPJ já cadastrado</AlertDialogTitle>
            <AlertDialogDescription>
              Este CNPJ já pertence a um fornecedor existente. Deseja atualizar o cadastro com os novos dados?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpsertConfirm}>Atualizar Existente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============= Helpers =============
function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") {
    return (
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
        <span className="text-xs text-muted-foreground/60 italic">—</span>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground text-right min-w-0 break-words">{value}</span>
    </div>
  );
}
