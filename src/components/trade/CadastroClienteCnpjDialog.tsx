import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Loader2,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Link2,
  UserPlus,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CadastroClienteCnpjDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (storeId: string, storeName: string) => void;
}

interface ReceitaData {
  razaoSocial?: string;
  nomeFantasia?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  situacao?: string;
  cnae?: string;
  porte?: string;
  capitalSocial?: number;
  regimeTributario?: string;
  matrizFilial?: string;
}

interface ExistingStore {
  id: string;
  name: string;
  cnpj: string;
  city?: string;
  state?: string;
  status?: string;
}

type Step = "cnpj" | "duplicate" | "review" | "success";

export function CadastroClienteCnpjDialog({
  open,
  onOpenChange,
  onSuccess,
}: CadastroClienteCnpjDialogProps) {
  const [step, setStep] = useState<Step>("cnpj");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [receitaData, setReceitaData] = useState<ReceitaData | null>(null);
  const [existingStore, setExistingStore] = useState<ExistingStore | null>(null);
  const [createdStoreId, setCreatedStoreId] = useState<string | null>(null);
  const [createdStoreName, setCreatedStoreName] = useState("");

  // Editable form fields (step review)
  const [formData, setFormData] = useState({
    name: "",
    nomeFantasia: "",
    address: "",
    city: "",
    state: "",
    phone: "",
    email: "",
    cnae: "",
  });

  const resetState = () => {
    setStep("cnpj");
    setCnpj("");
    setLoading(false);
    setReceitaData(null);
    setExistingStore(null);
    setCreatedStoreId(null);
    setCreatedStoreName("");
    setFormData({ name: "", nomeFantasia: "", address: "", city: "", state: "", phone: "", email: "", cnae: "" });
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const cleanCnpj = cnpj.replace(/\D/g, "");
  const isValidCnpj = cleanCnpj.length === 14;

  // Step 1: Consultar CNPJ
  const handleConsultar = async () => {
    if (!isValidCnpj) return;
    setLoading(true);

    try {
      // Check duplicate first
      const { data: existing } = await supabase
        .from("stores")
        .select("id, name, cnpj, city, state, status")
        .eq("cnpj", cleanCnpj)
        .limit(1);

      // Query Receita Federal
      const { data, error } = await supabase.functions.invoke("opencnpj-consulta", {
        body: { cnpj: cleanCnpj },
      });

      if (error) throw new Error(error.message || "Erro ao consultar CNPJ");
      if (data?.error) throw new Error(data.error);

      setReceitaData(data);

      if (existing && existing.length > 0) {
        setExistingStore(existing[0] as ExistingStore);
        setStep("duplicate");
      } else {
        // Pre-fill form
        setFormData({
          name: data.razaoSocial || "",
          nomeFantasia: data.nomeFantasia || "",
          address: data.endereco || "",
          city: data.cidade || "",
          state: data.uf || "",
          phone: data.telefone || "",
          email: data.email || "",
          cnae: data.cnae || "",
        });
        setStep("review");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao consultar CNPJ");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 (duplicate): Vincular ao existente
  const handleVincular = async () => {
    if (!existingStore) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Check if already linked
      const { data: existingLink } = await supabase
        .from("store_sellers")
        .select("id")
        .eq("store_id", existingStore.id)
        .eq("vendedor_id", user.id)
        .limit(1);

      if (existingLink && existingLink.length > 0) {
        toast.info("Você já está vinculado a este cliente");
        onSuccess?.(existingStore.id, existingStore.name);
        handleClose(false);
        return;
      }

      const { error } = await supabase.from("store_sellers").insert({
        store_id: existingStore.id,
        vendedor_id: user.id,
        is_principal: false,
        created_by: user.id,
      });

      if (error) throw error;

      // Audit log
      await supabase.from("audit_logs").insert({
        action: "vinculacao_cliente_existente",
        entity_type: "store",
        entity_id: existingStore.id,
        user_id: user.id,
        metadata: {
          cnpj: cleanCnpj,
          store_name: existingStore.name,
          origem: "cadastro_cnpj_dialog",
        },
      });

      toast.success(`Vinculado ao cliente: ${existingStore.name}`);
      onSuccess?.(existingStore.id, existingStore.name);
      handleClose(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao vincular cliente");
    } finally {
      setLoading(false);
    }
  };

  // Step 3 (review): Cadastrar novo
  const handleCadastrar = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Get supervisor from user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("supervisor_id")
        .eq("id", user.id)
        .single();

      // Normalize name
      let normalizedName = formData.name;
      try {
        const { data: normData } = await supabase.functions.invoke("padronizar-nome-cliente", {
          body: { name: formData.name },
        });
        if (normData?.normalized) normalizedName = normData.normalized;
      } catch {
        // Use original name
      }

      const { data: newStore, error } = await supabase
        .from("stores")
        .insert({
          name: normalizedName,
          code: `STORE-${Date.now()}`,
          cnpj: cleanCnpj,
          chain: formData.nomeFantasia || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          phone: formData.phone || null,
          email: formData.email || null,
          cnae_principal: formData.cnae || null,
          situacao_cadastral: receitaData?.situacao || null,
          porte_empresa: receitaData?.porte || null,
          regime_tributario: receitaData?.regimeTributario || null,
          matriz_filial: receitaData?.matrizFilial || null,
          capital_social: receitaData?.capitalSocial?.toString() || null,
          classification: "C",
          status: "active",
          branch_count: 1,
          created_by: user.id,
          vendedor_id: user.id,
          supervisor_id: profile?.supervisor_id || null,
        })
        .select("id, name")
        .single();

      if (error) throw error;

      // Link seller
      await supabase.from("store_sellers").insert({
        store_id: newStore.id,
        vendedor_id: user.id,
        is_principal: true,
        created_by: user.id,
      });

      // Audit log
      await supabase.from("audit_logs").insert([{
        action: "cadastro_cliente_cnpj",
        entity_type: "store",
        entity_id: newStore.id,
        user_id: user.id,
        metadata: {
          cnpj: cleanCnpj,
          store_name: newStore.name,
          origem: "receita_federal",
          dados_receita: receitaData,
        } as any,
      }]);

      setCreatedStoreId(newStore.id);
      setCreatedStoreName(newStore.name);
      setStep("success");
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    if (createdStoreId) {
      onSuccess?.(createdStoreId, createdStoreName);
    }
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Cadastro Inteligente via CNPJ
          </DialogTitle>
          <DialogDescription>
            {step === "cnpj" && "Informe o CNPJ para consulta automática na Receita Federal"}
            {step === "duplicate" && "Cliente já cadastrado no sistema"}
            {step === "review" && "Revise e ajuste os dados antes de confirmar"}
            {step === "success" && "Cliente cadastrado com sucesso"}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-2">
          {["cnpj", "review", "success"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  step === s || (step === "duplicate" && s === "review")
                    ? "bg-primary text-primary-foreground"
                    : ["success"].includes(step) || (step === "review" && i === 0)
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* STEP: CNPJ Input */}
        {step === "cnpj" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj-input" className="text-sm font-medium">
                CNPJ
              </Label>
              <div className="flex gap-2">
                <Input
                  id="cnpj-input"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className="flex-1 text-lg font-mono tracking-wide"
                  maxLength={18}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && isValidCnpj && handleConsultar()}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O sistema consultará automaticamente os dados na Receita Federal
              </p>
            </div>

            <Button
              onClick={handleConsultar}
              disabled={!isValidCnpj || loading}
              className="w-full h-11"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Consultando Receita Federal...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Consultar CNPJ
                </>
              )}
            </Button>
          </div>
        )}

        {/* STEP: Duplicate Found */}
        {step === "duplicate" && existingStore && (
          <div className="space-y-4">
            <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">Cliente já cadastrado</p>
                    <p className="text-xs text-muted-foreground">
                      Este CNPJ já está registrado no sistema. Deseja vincular este cliente a você?
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-3 space-y-1.5">
                  <p className="font-bold text-sm">{existingStore.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    CNPJ: {existingStore.cnpj}
                  </p>
                  {(existingStore.city || existingStore.state) && (
                    <p className="text-xs text-muted-foreground">
                      {[existingStore.city, existingStore.state].filter(Boolean).join(" - ")}
                    </p>
                  )}
                  <Badge
                    variant={existingStore.status === "active" ? "secondary" : "destructive"}
                    className="text-[10px]"
                  >
                    {existingStore.status === "active" ? "Ativo" : existingStore.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("cnpj")} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleVincular} disabled={loading} className="flex-1">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Vincular a você
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Review & Edit */}
        {step === "review" && (
          <div className="space-y-4">
            {/* Receita Federal info card */}
            {receitaData && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Dados da Receita Federal
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {receitaData.situacao && (
                      <div>
                        <span className="text-muted-foreground">Situação: </span>
                        <span className={cn("font-medium", receitaData.situacao === "ATIVA" ? "text-green-600" : "text-destructive")}>
                          {receitaData.situacao}
                        </span>
                      </div>
                    )}
                    {receitaData.porte && (
                      <div>
                        <span className="text-muted-foreground">Porte: </span>
                        <span className="font-medium">{receitaData.porte}</span>
                      </div>
                    )}
                    {receitaData.regimeTributario && (
                      <div>
                        <span className="text-muted-foreground">Regime: </span>
                        <span className="font-medium">{receitaData.regimeTributario}</span>
                      </div>
                    )}
                    {receitaData.matrizFilial && (
                      <div>
                        <span className="text-muted-foreground">Tipo: </span>
                        <span className="font-medium">{receitaData.matrizFilial}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Razão Social *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Nome Fantasia</Label>
                <Input
                  value={formData.nomeFantasia}
                  onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Endereço</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cidade</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">UF</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  maxLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">CNAE / Atividade</Label>
                <Input
                  value={formData.cnae}
                  onChange={(e) => setFormData({ ...formData, cnae: e.target.value })}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("cnpj"); }} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleCadastrar} disabled={loading || !formData.name.trim()} className="flex-1">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Cadastrar Cliente
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Cliente Cadastrado!</h3>
              <p className="text-sm text-muted-foreground mt-1">{createdStoreName}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">CNPJ: {cnpj}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              O cliente foi vinculado automaticamente ao seu perfil e já está disponível para seleção.
            </p>
            <Button onClick={handleSuccessClose} className="w-full">
              Selecionar este cliente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
