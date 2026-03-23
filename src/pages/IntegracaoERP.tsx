import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Key, Plus, Copy, AlertTriangle, RefreshCw, Shield, ExternalLink, Play, Settings, ArrowLeft } from "lucide-react";
import { format, addDays } from "date-fns";
import ApiDocumentation from "@/components/erp/ApiDocumentation";
import ApiTester from "@/components/erp/ApiTester";
import ErpPortalSettings from "@/components/erp/ErpPortalSettings";
import { useErpAccessProfiles, useAssignProfileToKey, useAccessProfileForKey } from "@/hooks/useErpAccessProfiles";
import { useCurrentUserProfile } from "@/hooks/useErpUserProfiles";
import { ptBR } from "date-fns/locale";

interface ErpApiKey {
  id: string;
  key_preview: string;
  empresa_id: string;
  nome_responsavel: string;
  expires_at: string;
  max_requests: number;
  request_count: number;
  active: boolean;
  created_at: string;
  access_profile_id: string | null;
}

function generateKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `huggs-erp-${result}`;
}

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function IntegracaoERP() {
  const { data: profiles } = useErpAccessProfiles();
  const assignProfile = useAssignProfileToKey();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: currentUserProfileId } = useCurrentUserProfile();
  const { data: userProfileModules } = useAccessProfileForKey(isAdmin ? null : currentUserProfileId);
  const [keys, setKeys] = useState<ErpApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [empresaId, setEmpresaId] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [expiresAt, setExpiresAt] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [maxRequests, setMaxRequests] = useState("1000");

  const fetchKeys = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("erp_api_keys")
      .select("id, key_preview, empresa_id, nome_responsavel, expires_at, max_requests, request_count, active, created_at, access_profile_id")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar chaves: " + error.message);
    } else {
      setKeys((data as ErpApiKey[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleGenerate = async () => {
    if (!empresaId.trim() || !nomeResponsavel.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSubmitting(true);
    const rawKey = generateKey();
    const keyHash = await hashKey(rawKey);
    const preview = "****" + rawKey.slice(-8);

    const { error } = await supabase.from("erp_api_keys").insert({
      key_hash: keyHash,
      key_preview: preview,
      empresa_id: empresaId.trim(),
      nome_responsavel: nomeResponsavel.trim(),
      expires_at: new Date(expiresAt + "T23:59:59Z").toISOString(),
      max_requests: parseInt(maxRequests) || 1000,
      created_by: user?.id,
    });

    if (error) {
      toast.error("Erro ao criar chave: " + error.message);
      setSubmitting(false);
      return;
    }

    setGeneratedKey(rawKey);
    setSubmitting(false);
    fetchKeys();
  };

  const handleCopy = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      toast.success("Chave copiada!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("erp_api_keys")
      .update({ active: !currentActive })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
    } else {
      toast.success(currentActive ? "Chave desativada" : "Chave ativada");
      fetchKeys();
    }
  };

  const resetForm = () => {
    setEmpresaId("");
    setNomeResponsavel("");
    setExpiresAt(format(addDays(new Date(), 30), "yyyy-MM-dd"));
    setMaxRequests("1000");
    setGeneratedKey(null);
    setCopied(false);
  };

  const isExpired = (date: string) => new Date(date) < new Date();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Portal de Integração ERP
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie chaves de API para integração com sistemas ERP externos
          </p>
        </div>
      </div>

      <Tabs defaultValue="portal" className="w-full">
        <TabsList>
          <TabsTrigger value="portal">Portal</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="configuracoes" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Configurações
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="portal" className="space-y-6 mt-4">
          {/* Generate Key Button */}
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Gerar Nova Chave
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                {generatedKey ? (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                        Chave Gerada — Copie Agora!
                      </DialogTitle>
                      <DialogDescription>
                        Esta chave não será exibida novamente. Copie e armazene em local seguro.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="bg-muted rounded-lg p-4 font-mono text-sm break-all select-all border-2 border-amber-500/30">
                        {generatedKey}
                      </div>
                      <Button onClick={handleCopy} className="w-full gap-2" variant={copied ? "default" : "outline"}>
                        <Copy className="h-4 w-4" />
                        {copied ? "Copiado!" : "Copiar Chave"}
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>
                        Fechar
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Gerar Nova Chave de API</DialogTitle>
                      <DialogDescription>
                        A chave será exibida uma única vez após geração.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="empresa_id">ID da Empresa *</Label>
                        <Input id="empresa_id" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} placeholder="ex: 5 ou PARTY_COSMETICOS" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nome_responsavel">Responsável *</Label>
                        <Input id="nome_responsavel" value={nomeResponsavel} onChange={(e) => setNomeResponsavel(e.target.value)} placeholder="Nome do responsável pela integração" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expires_at">Expira em</Label>
                        <Input id="expires_at" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max_requests">Limite de Requisições</Label>
                        <Input id="max_requests" type="number" value={maxRequests} onChange={(e) => setMaxRequests(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
                      <Button onClick={handleGenerate} disabled={submitting} className="gap-2">
                        <Key className="h-4 w-4" />
                        {submitting ? "Gerando..." : "Gerar Chave"}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-[#dde1e9]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Testar a API</CardTitle>
              <CardDescription>Importe a collection oficial Huggs ERP v1 direto no Postman</CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href="https://app.getpostman.com/run-collection/44798020-ec42a04e-73ac-463f-a6c3-b058bbda994e"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  type="button"
                  className="gap-2 text-white font-semibold shadow-soft hover:brightness-110"
                  style={{ backgroundColor: '#FF6C37' }}
                >
                  <Play className="h-4 w-4 fill-current" />
                  Run in Postman
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </a>
            </CardContent>
          </Card>

          <ApiTester />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg">Chaves de API Registradas</CardTitle>
                <CardDescription>{keys.length} chave(s) cadastrada(s)</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={fetchKeys} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Chave</TableHead>
                      <TableHead>Perfil de Acesso</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead>Uso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhuma chave cadastrada. Clique em "Gerar Nova Chave" para começar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      keys.map((k) => {
                        const expired = isExpired(k.expires_at);
                        const overLimit = k.request_count >= k.max_requests;
                        return (
                          <TableRow key={k.id}>
                            <TableCell className="font-medium">{k.empresa_id}</TableCell>
                            <TableCell>{k.nome_responsavel}</TableCell>
                            <TableCell className="font-mono text-xs">{k.key_preview}</TableCell>
                            <TableCell>
                              <Select
                                value={k.access_profile_id || "none"}
                                onValueChange={(val) => {
                                  assignProfile.mutate({
                                    keyId: k.id,
                                    profileId: val === "none" ? null : val,
                                  }, { onSuccess: () => fetchKeys() });
                                }}
                              >
                                <SelectTrigger className="h-8 w-[160px] text-xs">
                                  <SelectValue placeholder="Sem restrição" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Acesso Completo</SelectItem>
                                  {profiles?.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <span className={expired ? "text-destructive" : ""}>
                                {format(new Date(k.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              {expired && <Badge variant="destructive" className="ml-2 text-xs">Expirada</Badge>}
                            </TableCell>
                            <TableCell>
                              <span className={overLimit ? "text-destructive font-medium" : ""}>
                                {k.request_count.toLocaleString()}/{k.max_requests.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              {k.active && !expired && !overLimit ? (
                                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Ativa</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-muted-foreground">Inativa</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Switch checked={k.active} onCheckedChange={() => handleToggle(k.id, k.active)} />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <ApiDocumentation accessProfileModules={isAdmin ? undefined : (userProfileModules as any) || undefined} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="configuracoes" className="mt-4">
            <ErpPortalSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
