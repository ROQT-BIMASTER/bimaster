import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bot, Plus, Pencil, Trash2, Plug, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

type BotRow = {
  id: string;
  empresa_id: number;
  nome: string;
  descricao: string | null;
  provider: "blip" | "interno" | "whatsapp_cloud";
  canal: "whatsapp" | "instagram" | "messenger" | "webchat" | "email" | "voz" | "outro";
  identificador_externo: string | null;
  numero_whatsapp: string | null;
  modo_leitura: boolean;
  ativo: boolean;
  ultimo_sync_at: string | null;
  ultimo_erro: string | null;
};

const formSchema = z.object({
  id: z.string().uuid().nullable(),
  nome: z.string().min(2, "Nome obrigatório").max(120),
  descricao: z.string().max(500).optional().nullable(),
  provider: z.enum(["blip", "whatsapp_cloud", "interno"]),
  canal: z.enum(["whatsapp", "instagram", "messenger", "webchat", "email", "voz", "outro"]),
  identificador_externo: z.string().max(200).optional().nullable(),
  numero_whatsapp: z.string().max(40).optional().nullable(),
  bot_key: z.string().max(500).optional().nullable(),
  modo_leitura: z.boolean(),
  ativo: z.boolean(),
});

const emptyForm: z.infer<typeof formSchema> = {
  id: null,
  nome: "",
  descricao: "",
  provider: "blip",
  canal: "whatsapp",
  identificador_externo: "",
  numero_whatsapp: "",
  bot_key: "",
  modo_leitura: true,
  ativo: true,
};

export default function CrmBots() {
  const { empresaSelecionada, empresaIds, hasEmpresas } = useEmpresaContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BotRow | null>(null);
  const [form, setForm] = useState<z.infer<typeof formSchema>>(emptyForm);
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<{ ok: boolean; msg: string } | null>(null);

  const empresaId = empresaSelecionada?.id ?? null;

  const { data: bots, isLoading } = useQuery({
    queryKey: ["crm-bots", empresaIds],
    enabled: hasEmpresas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_bots")
        .select(
          "id, empresa_id, nome, descricao, provider, canal, identificador_externo, numero_whatsapp, modo_leitura, ativo, ultimo_sync_at, ultimo_erro",
        )
        .in("empresa_id", empresaIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BotRow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!empresaId) throw new Error("Selecione uma empresa antes de cadastrar um bot.");
      const parsed = formSchema.parse(values);
      const { data, error } = await supabase.rpc("crm_bot_upsert", {
        p_id: parsed.id,
        p_empresa_id: empresaId,
        p_nome: parsed.nome,
        p_descricao: parsed.descricao || null,
        p_provider: parsed.provider,
        p_canal: parsed.canal,
        p_identificador_externo: parsed.identificador_externo || null,
        p_numero_whatsapp: parsed.numero_whatsapp || null,
        p_bot_key: parsed.bot_key || null,
        p_modo_leitura: parsed.modo_leitura,
        p_ativo: parsed.ativo,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-bots"] });
      setOpen(false);
      setForm(emptyForm);
      setLastTest(null);
      toast.success("Bot salvo com sucesso");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar bot");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_bots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-bots"] });
      setConfirmDelete(null);
      toast.success("Bot removido");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setLastTest(null);
    setOpen(true);
  };

  const openEdit = (b: BotRow) => {
    setForm({
      id: b.id,
      nome: b.nome,
      descricao: b.descricao ?? "",
      provider: b.provider,
      canal: b.canal,
      identificador_externo: b.identificador_externo ?? "",
      numero_whatsapp: b.numero_whatsapp ?? "",
      bot_key: "",
      modo_leitura: b.modo_leitura,
      ativo: b.ativo,
    });
    setLastTest(null);
    setOpen(true);
  };

  const handleTest = async () => {
    setTesting(true);
    setLastTest(null);
    try {
      const payload = form.id ? { botId: form.id } : { key: form.bot_key || "" };
      if (!form.id && !payload["key" as keyof typeof payload]) {
        toast.error("Informe a chave para testar.");
        return;
      }
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        error?: string;
        status?: number;
        elapsed_ms?: number;
      }>("crm-blip-test-connection", { body: payload });
      if (error) throw error;
      if (data?.ok) {
        setLastTest({ ok: true, msg: `Conectado (${data.elapsed_ms ?? 0} ms)` });
      } else {
        setLastTest({
          ok: false,
          msg: data?.error || `Falha (status ${data?.status ?? "?"})`,
        });
      }
    } catch (e) {
      setLastTest({
        ok: false,
        msg: e instanceof Error ? e.message : "Erro de rede",
      });
    } finally {
      setTesting(false);
    }
  };

  if (!hasEmpresas) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sem empresa vinculada</CardTitle>
            <CardDescription>
              Você precisa estar vinculado a uma empresa para gerenciar bots do CRM.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bots & Canais</h1>
          <p className="text-muted-foreground">
            Cadastre as chaves dos fluxos Blip que serão lidos pela plataforma. Operação em modo
            leitura: nenhum envio é feito a partir daqui na fase 1.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!empresaId}>
          <Plus className="h-4 w-4 mr-2" />
          Novo bot
        </Button>
      </div>

      {!empresaId && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 text-sm text-amber-900 dark:text-amber-200">
            Selecione uma empresa específica no topo da página para criar ou editar bots.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> Bots cadastrados
          </CardTitle>
          <CardDescription>
            {isLoading ? "Carregando..." : `${bots?.length ?? 0} bot(s) encontrado(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(bots?.length ?? 0) === 0 && !isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhum bot cadastrado. Clique em <strong>Novo bot</strong> para começar.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {bots?.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{b.nome}</span>
                      <Badge variant={b.ativo ? "default" : "secondary"}>
                        {b.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      {b.modo_leitura && <Badge variant="outline">Leitura</Badge>}
                      <Badge variant="outline" className="capitalize">
                        {b.provider}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {b.canal}
                      </Badge>
                    </div>
                    {b.descricao && (
                      <p className="text-sm text-muted-foreground truncate">{b.descricao}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {b.numero_whatsapp ? `WhatsApp: ${b.numero_whatsapp} · ` : ""}
                      {b.identificador_externo ? `ID: ${b.identificador_externo} · ` : ""}
                      Último sync: {b.ultimo_sync_at ?? "—"}
                      {b.ultimo_erro && (
                        <span className="text-destructive"> · erro: {b.ultimo_erro}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDelete(b)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar bot" : "Novo bot"}</DialogTitle>
            <DialogDescription>
              A chave é criptografada antes de ser persistida e nunca é exposta novamente. Para
              alterá-la, digite uma nova chave; deixe em branco para mantê-la.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Bot Vendas WhatsApp"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao ?? ""}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v as typeof form.provider })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blip">Blip</SelectItem>
                  <SelectItem value="whatsapp_cloud">WhatsApp Cloud API</SelectItem>
                  <SelectItem value="interno">Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Canal</Label>
              <Select
                value={form.canal}
                onValueChange={(v) => setForm({ ...form, canal: v as typeof form.canal })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="messenger">Messenger</SelectItem>
                  <SelectItem value="webchat">Webchat</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="voz">Voz</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Identificador externo</Label>
              <Input
                value={form.identificador_externo ?? ""}
                onChange={(e) =>
                  setForm({ ...form, identificador_externo: e.target.value })
                }
                placeholder="Short name / app ID"
              />
            </div>
            <div>
              <Label>Número WhatsApp</Label>
              <Input
                value={form.numero_whatsapp ?? ""}
                onChange={(e) => setForm({ ...form, numero_whatsapp: e.target.value })}
                placeholder="+55 11 9..."
              />
            </div>
            <div className="md:col-span-2">
              <Label>Chave do bot (Blip Key) {form.id ? "(opcional)" : "*"}</Label>
              <Input
                type="password"
                value={form.bot_key ?? ""}
                onChange={(e) => setForm({ ...form, bot_key: e.target.value })}
                placeholder={form.id ? "Deixe em branco para manter" : "Cole a chave aqui"}
                autoComplete="off"
              />
              <div className="flex items-center justify-between mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing || (!form.id && !form.bot_key)}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plug className="h-4 w-4 mr-2" />
                  )}
                  Testar conexão
                </Button>
                {lastTest && (
                  <span
                    className={`text-sm flex items-center gap-1 ${
                      lastTest.ok ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {lastTest.ok ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {lastTest.msg}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Modo leitura</Label>
                <p className="text-xs text-muted-foreground">
                  Apenas consulta; nada é enviado pela plataforma.
                </p>
              </div>
              <Switch
                checked={form.modo_leitura}
                onCheckedChange={(v) => setForm({ ...form, modo_leitura: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Quando desativado, o ingest é pausado.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => upsert.mutate(form)}
              disabled={upsert.isPending || !form.nome || (!form.id && !form.bot_key)}
            >
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover bot?</AlertDialogTitle>
            <AlertDialogDescription>
              O bot <strong>{confirmDelete?.nome}</strong> será removido. As conversas e
              mensagens já ingeridas permanecem, mas perdem o vínculo com este bot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
