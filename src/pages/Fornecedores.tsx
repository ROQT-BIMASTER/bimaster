import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users, Plus, Search, Pencil, ToggleLeft, ToggleRight, Loader2,
  ChevronDown, ChevronRight, Building2, MapPin, Phone, Mail,
  QrCode, CreditCard, FileText, Globe, Briefcase, Info, RefreshCw,
} from "lucide-react";
import { CnpjSearchButton, CnpjData } from "@/components/shared/CnpjSearchButton";
import { Link } from "react-router-dom";
import { useEmpresaFilter } from "@/hooks/useEmpresaFilter";

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
}

const emptyForm: FornecedorForm = {
  nome: "", cnpj: "", razao_social: "", nome_fantasia: "", email: "", telefone: "",
  endereco: "", endereco_numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "",
  empresa_id: "", codigo_externo: "", fonte_erp: "", status: "ativo",
  banco: "", agencia: "", conta_bancaria: "", tipo_conta: "corrente", favorecido: "",
  tipo_pix: "", chave_pix: "",
  inscricao_estadual: "", inscricao_municipal: "",
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
  const calc = (base: number) => {
    let sum = 0;
    let weight = base;
    for (let i = 0; i < base - 1; i++) {
      sum += parseInt(digits[i]) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(13) === parseInt(digits[12]) && calc(14) === parseInt(digits[13]);
}

function SituacaoBadge({ situacao }: { situacao: string | null }) {
  if (!situacao) return null;
  const isAtiva = situacao.toUpperCase() === "ATIVA";
  return (
    <Badge variant={isAtiva ? "success" : "destructive"} className="text-[10px]">
      {situacao}
    </Badge>
  );
}

function InfoBadge({ label, show }: { label: string; show: boolean }) {
  if (!show) return null;
  return <Badge variant="outline" className="text-[10px]">{label}</Badge>;
}

function FornecedorDetailPanel({ f }: { f: Fornecedor }) {
  const hasAddress = f.endereco || f.bairro || f.cidade;
  const hasBank = f.banco || f.chave_pix;
  const hasTax = f.inscricao_estadual || f.inscricao_municipal || f.cnae;

  return (
    <div className="px-6 py-4 bg-muted/30 border-t space-y-4">
      <div className="flex flex-wrap gap-2">
        <SituacaoBadge situacao={f.situacao_cadastral} />
        <InfoBadge label={f.matriz_filial || ""} show={!!f.matriz_filial} />
        <InfoBadge label={f.porte || ""} show={!!f.porte} />
        <InfoBadge label={f.regime_tributario || ""} show={!!f.regime_tributario} />
        {f.optante_simples_nacional === "S" && <InfoBadge label="Simples Nacional" show />}
        {f.erp_code && <Badge variant="secondary" className="text-[10px]">ERP: {f.erp_code}</Badge>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" /> Endereço
          </p>
          {hasAddress ? (
            <div className="text-xs space-y-0.5">
              <p>{[f.endereco, f.endereco_numero].filter(Boolean).join(", ")}{f.complemento ? ` - ${f.complemento}` : ""}</p>
              <p>{[f.bairro, f.cidade, f.estado].filter(Boolean).join(" - ")}</p>
              {f.cep && <p>CEP: {f.cep}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Não cadastrado</p>
          )}
          <div className="pt-1 space-y-0.5">
            {f.telefone && (
              <p className="text-xs flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{f.telefone}</p>
            )}
            {f.email && (
              <p className="text-xs flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{f.email}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
            <CreditCard className="h-3 w-3" /> Dados Bancários
          </p>
          {hasBank ? (
            <div className="text-xs space-y-1">
              {f.banco && (
                <p>{f.banco} • Ag: {f.agencia || "—"} • Cc: {f.conta_bancaria || "—"}{f.tipo_conta ? ` (${f.tipo_conta})` : ""}</p>
              )}
              {f.favorecido && <p className="text-muted-foreground">Favorecido: {f.favorecido}</p>}
              {f.chave_pix && (
                <p className="flex items-center gap-1">
                  <QrCode className="h-3 w-3" />
                  <Badge variant="outline" className="text-[9px]">{f.tipo_pix?.toUpperCase()}</Badge>
                  {f.chave_pix}
               </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Não cadastrado</p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
            <FileText className="h-3 w-3" /> Dados Fiscais
          </p>
          {hasTax ? (
            <div className="text-xs space-y-0.5">
              {f.cnae && <p>CNAE: {f.cnae}</p>}
              {f.inscricao_estadual && <p>IE: {f.inscricao_estadual}</p>}
              {f.inscricao_municipal && <p>IM: {f.inscricao_municipal}</p>}
              {f.capital_social != null && f.capital_social > 0 && (
                <p>Capital Social: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(f.capital_social)}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Não cadastrado</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Fornecedores() {
  const queryClient = useQueryClient();
  const { empresasDoUsuario, empresaIds, empresaSelecionada, loading: empresaLoading } = useEmpresaFilter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FornecedorForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [upsertConfirm, setUpsertConfirm] = useState<{ existingId: string } | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dialogTab, setDialogTab] = useState<"basico" | "endereco" | "banco">("basico");
  const [syncingErp, setSyncingErp] = useState(false);

  // Filter empresas to only those in user context
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
        // Filter by user's empresas — include null empresa_id (shared suppliers)
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

      // ERP sync for new suppliers
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
      
      // Step 1: Check if supplier exists in ERP
      const { data: checkData, error: checkErr } = await supabase.functions.invoke("erp-fornecedores-sync", {
        body: { cnpj: cnpjDigits, path: "/check" },
      });

      if (checkErr) {
        console.error("ERP check error:", checkErr);
        toast.warning("Fornecedor salvo localmente. Verificação ERP falhou.");
        return;
      }

      if (checkData?.found_in_erp && checkData?.erp_code) {
        toast.info(`Fornecedor já existe no ERP — Código: ${checkData.erp_code}`);
        // Update local record with ERP code
        await supabase.from("fornecedores").update({
          erp_code: String(checkData.erp_code),
          erp_synced_at: new Date().toISOString(),
        }).eq("id", fornecedorId);
        queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
        return;
      }

      // Step 2: Register in ERP
      const { data: syncData, error: syncErr } = await supabase.functions.invoke("erp-fornecedores-sync", {
        body: { cnpj: cnpjDigits, fornecedor_id: fornecedorId, path: "/sync" },
      });

      if (syncErr) {
        console.error("ERP sync error:", syncErr);
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
      console.error("ERP sync error:", err);
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
      chave_pix: f.chave_pix || "", linha_digitavel: f.linha_digitavel || "",
      inscricao_estadual: f.inscricao_estadual || "",
      inscricao_municipal: f.inscricao_municipal || "",
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
        supabase.from("fornecedores").update(updateFields).eq("id", editingId).then(() => {
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
      empresa_id: form.empresa_id ? parseInt(form.empresa_id) : null,
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
      linha_digitavel: form.linha_digitavel.trim() || null,
      inscricao_estadual: form.inscricao_estadual.trim() || null,
      inscricao_municipal: form.inscricao_municipal.trim() || null,
      updated_at: new Date().toISOString(),
    };
  }, [form]);

  const handleSave = async () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (!validateCNPJ(form.cnpj)) return toast.error("CNPJ inválido");
    if (!form.empresa_id) return toast.error("Empresa é obrigatória");

    const cnpjDigits = form.cnpj.replace(/\D/g, "");

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
    } catch (err: any) {
      toast.error("Falha ao sincronizar com ERP");
    } finally {
      setSyncingErp(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      ativo: { variant: "default", label: "Ativo" },
      inativo: { variant: "secondary", label: "Inativo" },
      bloqueado: { variant: "destructive", label: "Bloqueado" },
    };
    const s = map[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const empresaNome = (empresaId: number | null) => {
    if (!empresaId) return "—";
    const e = visibleEmpresas.find((emp) => emp.id === empresaId);
    return e ? e.nome : `#${empresaId}`;
  };

  const tabClasses = (tab: string) =>
    `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      dialogTab === tab
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted"
    }`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Fornecedores</h1>
          <Badge variant="secondary" className="text-xs">{fornecedores.length}</Badge>
        </div>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Fornecedor
        </Button>
      </div>

      {/* Banner de segregação */}
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
          Fornecedores do módulo Financeiro/Comercial. Para fornecedores da Fábrica, acesse{" "}
          <Link to="/dashboard/fabrica/fornecedores" className="underline font-medium">Fábrica → Fornecedores</Link>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, razão social ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Empresas</SelectItem>
                {visibleEmpresas.map((e) => (
                  <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Situação RF</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : fornecedores.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum fornecedor encontrado</TableCell></TableRow>
              ) : (
                fornecedores.map((f) => {
                  const isExpanded = expandedRow === f.id;
                  return (
                    <Collapsible key={f.id} open={isExpanded} onOpenChange={() => setExpandedRow(isExpanded ? null : f.id)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="w-8 px-2">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">{f.nome}</span>
                                {f.nome_fantasia && f.nome_fantasia !== f.nome && (
                                  <span className="text-xs text-muted-foreground block">{f.nome_fantasia}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-mono">{formatCNPJ(f.cnpj)}</TableCell>
                            <TableCell><SituacaoBadge situacao={f.situacao_cadastral} /></TableCell>
                            <TableCell className="text-sm">{f.email || "—"}</TableCell>
                            <TableCell className="text-sm">{[f.cidade, f.estado].filter(Boolean).join("/") || "—"}</TableCell>
                            <TableCell className="text-sm">{empresaNome(f.empresa_id)}</TableCell>
                            <TableCell>{statusBadge(f.status)}</TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <CnpjSearchButton
                                  cnpj={f.cnpj}
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
                                    supabase.from("fornecedores").update(updateFields).eq("id", f.id).then(() => {
                                      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
                                      toast.success("Dados atualizados da Receita Federal!");
                                    });
                                  }}
                                  size="icon"
                                  variant="ghost"
                                />
                                {!f.erp_code && (
                                  <Button
                                    variant="ghost" size="icon"
                                    onClick={() => handleManualErpSync(f)}
                                    disabled={syncingErp}
                                    title="Sincronizar com ERP"
                                  >
                                    <RefreshCw className={`h-4 w-4 ${syncingErp ? "animate-spin" : ""}`} />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(f)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  onClick={() => toggleMutation.mutate({ id: f.id, newStatus: f.status === "ativo" ? "bloqueado" : "ativo" })}
                                  title={f.status === "ativo" ? "Bloquear" : "Ativar"}
                                >
                                  {f.status === "ativo" ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={9} className="p-0">
                              <FornecedorDetailPanel f={f} />
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            <DialogDescription>Preencha os dados do fornecedor.</DialogDescription>
          </DialogHeader>

          {/* Tab navigation */}
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

          {/* Tab: Basico */}
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
            </div>
          )}

          {/* Tab: Endereco */}
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

          {/* Tab: Banco */}
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
              <Separator />
              <div className="grid gap-1.5">
                <Label>Linha Digitável (Boleto)</Label>
                <Input value={form.linha_digitavel} onChange={(e) => setForm({ ...form, linha_digitavel: e.target.value })}
                  placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" className="font-mono text-xs" />
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

      {/* Upsert Confirmation */}
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
    </div>
  );
}
