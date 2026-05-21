import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, ClipboardCheck, Plus, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  briefingId: string;
  briefingTitulo: string;
  onEnviado: () => void;
}

interface Config {
  id: string;
  nome: string;
  descricao: string | null;
  checklist_tipo: string;
}

interface Etapa {
  id: string;
  nome: string;
  ordem: number;
  responsavel_id: string | null;
  responsavel_secundario_id: string | null;
  tipo: string;
  sla_horas: number | null;
}

interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
}

export function EnviarAprovacaoDialog({
  open,
  onOpenChange,
  briefingId,
  briefingTitulo,
  onEnviado,
}: Props) {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [configId, setConfigId] = useState<string | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [prazo, setPrazo] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Carrega templates ativos
  useEffect(() => {
    if (!open) return;
    setConfigId(null);
    setEtapas([]);
    setPrazo("");
    (async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_config")
        .select("id, nome, descricao, checklist_tipo")
        .eq("ativo", true)
        .order("nome");
      if (error) {
        toast.error("Erro ao carregar fluxos");
        return;
      }
      setConfigs((data ?? []) as Config[]);
    })();
  }, [open]);

  // Carrega etapas do config selecionado
  useEffect(() => {
    if (!configId) {
      setEtapas([]);
      return;
    }
    setLoading(true);
    (async () => {
      const { data: ets } = await supabase
        .from("fluxo_aprovacao_etapas")
        .select("id, nome, ordem, responsavel_id, responsavel_secundario_id, tipo, sla_horas")
        .eq("config_id", configId)
        .eq("ativo", true)
        .order("ordem");
      const lista = (ets ?? []) as Etapa[];
      setEtapas(lista);

      // Busca profiles dos responsáveis
      const ids = Array.from(
        new Set(
          lista
            .flatMap((e) => [e.responsavel_id, e.responsavel_secundario_id])
            .filter(Boolean) as string[],
        ),
      );
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", ids);
        const map: Record<string, Profile> = {};
        (profs ?? []).forEach((p: any) => (map[p.id] = p));
        setProfiles(map);
      } else {
        setProfiles({});
      }
      setLoading(false);
    })();
  }, [configId]);

  const podeEnviar = useMemo(() => {
    if (!configId || etapas.length === 0) return false;
    return etapas.every(
      (e) => e.responsavel_id != null || e.responsavel_secundario_id != null,
    );
  }, [configId, etapas]);

  const handleEnviar = async () => {
    if (!configId) return;
    setEnviando(true);
    const { data, error } = await supabase.rpc("rpc_criar_lote_aprovacao_briefing", {
      p_briefing_id: briefingId,
      p_config_id: configId,
      p_titulo: briefingTitulo,
      p_prazo: prazo || null,
    });
    setEnviando(false);
    if (error) {
      toast.error(`Não foi possível enviar: ${error.message}`);
      return;
    }
    toast.success("Enviado para aprovação", { description: `Lote criado: ${(data as string)?.slice(0, 8)}…` });
    onEnviado();
    onOpenChange(false);
  };

  const renderResp = (uid: string | null) => {
    if (!uid) return null;
    const p = profiles[uid];
    const nome = p?.nome ?? p?.email ?? "Usuário";
    const inicial = nome.charAt(0).toUpperCase();
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs">
        <Avatar className="h-4 w-4">
          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{inicial}</AvatarFallback>
        </Avatar>
        <span className="truncate max-w-[140px]">{nome}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Configurar fluxo de aprovação
          </DialogTitle>
          <DialogDescription>
            Escolha um fluxo já existente e revise as etapas e aprovadores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Fluxo de aprovação</Label>
            <ScrollArea className="max-h-44 border rounded-md">
              {configs.length === 0 ? (
                <div className="text-xs text-muted-foreground p-4 text-center">
                  Nenhum fluxo cadastrado. Peça ao admin para criar em{" "}
                  <a href="/admin/templates-alcadas" className="underline">
                    /admin/templates-alcadas
                  </a>
                  .
                </div>
              ) : (
                <div className="p-1">
                  {configs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setConfigId(c.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        configId === c.id
                          ? "bg-primary/10 ring-1 ring-primary/40"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium">{c.nome}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.checklist_tipo}
                        {c.descricao ? ` · ${c.descricao}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Precisa criar um fluxo novo?{" "}
              <a href="/admin/templates-alcadas" className="text-primary hover:underline">
                Abrir templates de alçada
              </a>
            </div>
          </div>

          {configId && (
            <div>
              <Label className="mb-2 flex items-center justify-between">
                <span>Etapas e aprovadores</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {etapas.length} etapa{etapas.length !== 1 ? "s" : ""}
                </span>
              </Label>
              {loading ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  Carregando etapas…
                </div>
              ) : etapas.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3">
                  Este fluxo não tem etapas configuradas.
                </div>
              ) : (
                <div className="space-y-2">
                  {etapas.map((e, idx) => (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 p-3 rounded-md border bg-card"
                    >
                      <div className="flex flex-col items-center pt-0.5">
                        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {idx + 1}
                        </div>
                        {idx < etapas.length - 1 && (
                          <div className="w-px h-6 bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{e.nome}</span>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {e.tipo}
                          </span>
                          {e.sla_horas && (
                            <span className="text-[10px] text-muted-foreground">
                              · SLA {e.sla_horas}h
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {renderResp(e.responsavel_id)}
                          {renderResp(e.responsavel_secundario_id)}
                          {!e.responsavel_id && !e.responsavel_secundario_id && (
                            <span className="text-[11px] text-amber-700">
                              Sem responsável definido
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="prazo" className="mb-1 block">
              Prazo (opcional)
            </Label>
            <Input
              id="prazo"
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="max-w-[200px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={!podeEnviar || enviando}>
            {enviando ? "Enviando…" : "Enviar para aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
