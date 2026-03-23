import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users, Plus, Search, Pencil, ToggleLeft, ToggleRight, Loader2,
  ChevronDown, ChevronRight, Building2, MapPin, Phone, Mail,
  QrCode, CreditCard, Factory, Info,
} from "lucide-react";
import { CnpjSearchButton, CnpjData } from "@/components/shared/CnpjSearchButton";
import { Link } from "react-router-dom";

interface FabricaFornecedor {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  contato: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  favorecido: string | null;
  pix_tipo: string | null;
  pix_chave: string | null;
  linha_digitavel: string | null;
  erp_code: string | null;
  ativo: boolean | null;
  created_at: string | null;
}

interface FornecedorForm {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  email: string;
  telefone: string;
  contato: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  favorecido: string;
  pix_tipo: string;
  pix_chave: string;
  linha_digitavel: string;
  ativo: boolean;
}

const emptyForm: FornecedorForm = {
  razao_social: "", nome_fantasia: "", cnpj: "", email: "", telefone: "", contato: "",
  endereco: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "",
  inscricao_estadual: "", inscricao_municipal: "",
  banco: "", agencia: "", conta: "", tipo_conta: "corrente", favorecido: "",
  pix_tipo: "", pix_chave: "", linha_digitavel: "",
  ativo: true,
};

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function DetailPanel({ f }: { f: FabricaFornecedor }) {
  const hasAddress = f.endereco || f.bairro || f.cidade;
  const hasBank = f.banco || f.pix_chave;

  return (
    <div className="px-6 py-4 bg-muted/30 border-t space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant={f.ativo ? "success" : "destructive"} className="text-[10px]">
          {f.ativo ? "Ativo" : "Inativo"}
        </Badge>
        {f.erp_code && <Badge variant="secondary" className="text-[10px]">ERP: {f.erp_code}</Badge>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" /> Endereço
          </p>
          {hasAddress ? (
            <div className="text-xs space-y-0.5">
              <p>{[f.endereco, f.numero].filter(Boolean).join(", ")}{f.complemento ? ` - ${f.complemento}` : ""}</p>
              <p>{[f.bairro, f.cidade, f.uf].filter(Boolean).join(" - ")}</p>
              {f.cep && <p>CEP: {f.cep}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Não cadastrado</p>
          )}
          <div className="pt-1 space-y-0.5">
            {f.telefone && <p className="text-xs flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{f.telefone}</p>}
            {f.email && <p className="text-xs flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{f.email}</p>}
            {f.contato && <p className="text-xs flex items-center gap-1"><Users className="h-3 w-3 text-muted-foreground" />{f.contato}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
            <CreditCard className="h-3 w-3" /> Dados Bancários
          </p>
          {hasBank ? (
            <div className="text-xs space-y-1">
              {f.banco && <p>{f.banco} • Ag: {f.agencia || "—"} • Cc: {f.conta || "—"}{f.tipo_conta ? ` (${f.tipo_conta})` : ""}</p>}
              {f.favorecido && <p>Favorecido: {f.favorecido}</p>}
              {f.pix_chave && (
                <p className="flex items-center gap-1"><QrCode className="h-3 w-3" /> PIX ({f.pix_tipo}): {f.pix_chave}</p>
              )}
              {f.linha_digitavel && <p className="font-mono text-[10px] break-all">Boleto: {f.linha_digitavel}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Não cadastrado</p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
            <Building2 className="h-3 w-3" /> Dados Fiscais
          </p>
          <div className="text-xs space-y-0.5">
            {f.inscricao_estadual && <p>IE: {f.inscricao_estadual}</p>}
            {f.inscricao_municipal && <p>IM: {f.inscricao_municipal}</p>}
            {!f.inscricao_estadual && !f.inscricao_municipal && (
              <p className="text-muted-foreground italic">Não cadastrado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FabricaFornecedores() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FornecedorForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dialogTab, setDialogTab] = useState<"basico" | "endereco" | "banco">("basico");

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fabrica-fornecedores", search, statusFilter],
    queryFn: async () => {
      let query = supabase.from("fabrica_fornecedores").select("*").order("razao_social");
      if (search) query = query.or(`razao_social.ilike.%${search}%,cnpj.ilike.%${search}%,nome_fantasia.ilike.%${search}%`);
      if (statusFilter === "ativo") query = query.eq("ativo", true);
      if (statusFilter === "inativo") query = query.eq("ativo", false);
      const { data, error } = await query;
      if (error) throw error;
      return data as FabricaFornecedor[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: Record<string, unknown>; id?: string }) => {
      if (id) {
        const { error } = await supabase.from("fabrica_fornecedores").update(data as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fabrica_fornecedores").insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fabrica-fornecedores"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("fabrica_fornecedores").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fabrica-fornecedores"] });
      toast.success("Status atualizado!");
    },
  });

  const handleCnpjData = (data: CnpjData) => {
    setForm(prev => ({
      ...prev,
      razao_social: data.razaoSocial || prev.razao_social,
      nome_fantasia: data.nomeFantasia || prev.nome_fantasia,
      endereco: data.endereco || prev.endereco,
      bairro: data.bairro || prev.bairro,
      cidade: data.cidade || prev.cidade,
      uf: data.uf || prev.uf,
      cep: data.cep || prev.cep,
      telefone: data.telefone || prev.telefone,
      email: data.email || prev.email,
    }));
  };

  const handleSave = () => {
    if (!form.razao_social.trim()) { toast.error("Razão Social é obrigatória"); return; }
    const payload: Record<string, unknown> = {
      razao_social: form.razao_social.trim(),
      nome_fantasia: form.nome_fantasia.trim() || null,
      cnpj: form.cnpj.replace(/\D/g, "") || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      contato: form.contato.trim() || null,
      endereco: form.endereco.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim() || null,
      cep: form.cep.replace(/\D/g, "") || null,
      inscricao_estadual: form.inscricao_estadual.trim() || null,
      inscricao_municipal: form.inscricao_municipal.trim() || null,
      banco: form.banco.trim() || null,
      agencia: form.agencia.trim() || null,
      conta: form.conta.trim() || null,
      tipo_conta: form.tipo_conta || null,
      favorecido: form.favorecido.trim() || null,
      pix_tipo: form.pix_tipo || null,
      pix_chave: form.pix_chave.trim() || null,
      linha_digitavel: form.linha_digitavel.trim() || null,
      ativo: form.ativo,
      updated_at: new Date().toISOString(),
    };
    saveMutation.mutate({ data: payload, id: editingId || undefined });
  };

  const openEdit = (f: FabricaFornecedor) => {
    setEditingId(f.id);
    setForm({
      razao_social: f.razao_social || "",
      nome_fantasia: f.nome_fantasia || "",
      cnpj: f.cnpj ? formatCNPJ(f.cnpj) : "",
      email: f.email || "",
      telefone: f.telefone || "",
      contato: f.contato || "",
      endereco: f.endereco || "",
      numero: f.numero || "",
      complemento: f.complemento || "",
      bairro: f.bairro || "",
      cidade: f.cidade || "",
      uf: f.uf || "",
      cep: f.cep || "",
      inscricao_estadual: f.inscricao_estadual || "",
      inscricao_municipal: f.inscricao_municipal || "",
      banco: f.banco || "",
      agencia: f.agencia || "",
      conta: f.conta || "",
      tipo_conta: f.tipo_conta || "corrente",
      favorecido: f.favorecido || "",
      pix_tipo: f.pix_tipo || "",
      pix_chave: f.pix_chave || "",
      linha_digitavel: f.linha_digitavel || "",
      ativo: f.ativo ?? true,
    });
    setDialogTab("basico");
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogTab("basico");
    setDialogOpen(true);
  };

  const updateField = (field: keyof FornecedorForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Factory className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Fornecedores da Fábrica</h1>
              <p className="text-sm text-muted-foreground">Cadastro exclusivo do módulo de produção</p>
            </div>
          </div>
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Fornecedor</Button>
        </div>

        {/* Banner de segregação */}
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
            Fornecedores exclusivos da Fábrica. Para fornecedores financeiros/comerciais, acesse{" "}
            <Link to="/dashboard/cadastros/fornecedores" className="underline font-medium">Cadastros → Fornecedores</Link>.
          </AlertDescription>
        </Alert>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por razão social, CNPJ ou fantasia..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : fornecedores.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum fornecedor encontrado</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Razão Social</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fornecedores.map(f => (
                    <Collapsible key={f.id} open={expandedRow === f.id} onOpenChange={() => setExpandedRow(expandedRow === f.id ? null : f.id)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer">
                            <TableCell>{expandedRow === f.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                            <TableCell className="font-medium">
                              <div>
                                <p className="text-sm">{f.razao_social}</p>
                                {f.nome_fantasia && <p className="text-xs text-muted-foreground">{f.nome_fantasia}</p>}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{f.cnpj ? formatCNPJ(f.cnpj) : "—"}</TableCell>
                            <TableCell className="text-xs">{f.email || f.telefone || "—"}</TableCell>
                            <TableCell className="text-xs">{[f.cidade, f.uf].filter(Boolean).join("/") || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={f.ativo ? "success" : "secondary"} className="text-[10px]">
                                {f.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(f)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  onClick={() => toggleMutation.mutate({ id: f.id, ativo: !f.ativo })}
                                  title={f.ativo ? "Desativar" : "Ativar"}
                                >
                                  {f.ativo ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr><td colSpan={7} className="p-0"><DetailPanel f={f} /></td></tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
              <DialogDescription>Fornecedor do módulo Fábrica</DialogDescription>
            </DialogHeader>

            <Tabs value={dialogTab} onValueChange={v => setDialogTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basico">Dados Básicos</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="banco">Dados Bancários</TabsTrigger>
              </TabsList>

              <TabsContent value="basico" className="space-y-3 mt-3">
                <div>
                  <Label>CNPJ</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={form.cnpj} onChange={e => updateField("cnpj", formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
                    <CnpjSearchButton cnpj={form.cnpj} onDataFound={handleCnpjData} />
                  </div>
                </div>
                <div>
                  <Label>Razão Social *</Label>
                  <Input value={form.razao_social} onChange={e => updateField("razao_social", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input value={form.nome_fantasia} onChange={e => updateField("nome_fantasia", e.target.value)} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input value={form.email} onChange={e => updateField("email", e.target.value)} className="mt-1" /></div>
                  <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => updateField("telefone", e.target.value)} className="mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Contato</Label><Input value={form.contato} onChange={e => updateField("contato", e.target.value)} className="mt-1" /></div>
                  <div><Label>IE</Label><Input value={form.inscricao_estadual} onChange={e => updateField("inscricao_estadual", e.target.value)} className="mt-1" /></div>
                </div>
              </TabsContent>

              <TabsContent value="endereco" className="space-y-3 mt-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={e => updateField("endereco", e.target.value)} className="mt-1" /></div>
                  <div><Label>Número</Label><Input value={form.numero} onChange={e => updateField("numero", e.target.value)} className="mt-1" /></div>
                </div>
                <div><Label>Complemento</Label><Input value={form.complemento} onChange={e => updateField("complemento", e.target.value)} className="mt-1" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Bairro</Label><Input value={form.bairro} onChange={e => updateField("bairro", e.target.value)} className="mt-1" /></div>
                  <div><Label>Cidade</Label><Input value={form.cidade} onChange={e => updateField("cidade", e.target.value)} className="mt-1" /></div>
                  <div><Label>UF</Label><Input value={form.uf} onChange={e => updateField("uf", e.target.value)} className="mt-1" maxLength={2} /></div>
                </div>
                <div className="w-1/3"><Label>CEP</Label><Input value={form.cep} onChange={e => updateField("cep", e.target.value)} className="mt-1" /></div>
              </TabsContent>

              <TabsContent value="banco" className="space-y-3 mt-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Banco</Label><Input value={form.banco} onChange={e => updateField("banco", e.target.value)} className="mt-1" /></div>
                  <div><Label>Agência</Label><Input value={form.agencia} onChange={e => updateField("agencia", e.target.value)} className="mt-1" /></div>
                  <div><Label>Conta</Label><Input value={form.conta} onChange={e => updateField("conta", e.target.value)} className="mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de Conta</Label>
                    <Select value={form.tipo_conta} onValueChange={v => updateField("tipo_conta", v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corrente">Conta Corrente</SelectItem>
                        <SelectItem value="poupanca">Conta Poupança</SelectItem>
                        <SelectItem value="pagamento">Conta Pagamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Favorecido</Label><Input value={form.favorecido} onChange={e => updateField("favorecido", e.target.value)} className="mt-1" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo PIX</Label>
                    <Select value={form.pix_tipo} onValueChange={v => updateField("pix_tipo", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Chave PIX</Label><Input value={form.pix_chave} onChange={e => updateField("pix_chave", e.target.value)} className="mt-1" /></div>
                </div>
                <div>
                  <Label>Linha Digitável (Boleto)</Label>
                  <Input value={form.linha_digitavel} onChange={e => updateField("linha_digitavel", e.target.value)} className="mt-1 text-xs" placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingId ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
