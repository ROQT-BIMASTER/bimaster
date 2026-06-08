import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { File, Send, Users, Search, FolderOpen, Lock } from "lucide-react";
import { useTarefaMentionableUsers } from "@/hooks/useTarefaMentionableUsers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const COFRE_CATEGORIAS = [
  { value: "briefing", label: "Briefing" },
  { value: "arte_final", label: "Arte Final" },
  { value: "rotulo", label: "Rótulo" },
  { value: "ficha_tecnica", label: "Ficha Técnica" },
  { value: "laudo", label: "Laudo" },
  { value: "certificado", label: "Certificado" },
  { value: "orcamento", label: "Orçamento" },
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "art", label: "ART" },
  { value: "outro", label: "Outro" },
];

export interface UploadConfirmPayload {
  notificarIds: string[];
  cofre?: { categoria: string };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefaId: string | null;
  files: File[];
  onConfirm: (payload: UploadConfirmPayload) => void;
  /** Se a tarefa tem produto vinculado, habilita opção de promover ao Cofre. */
  produtoId?: string | null;
  /** Se o usuário atual tem alçada (admin_cofre / coordenador) para publicar. */
  canPublishToCofre?: boolean;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function UploadAnexoDialog({ open, onOpenChange, tarefaId, files, onConfirm, produtoId, canPublishToCofre }: Props) {
  const { user } = useAuth();
  const { data: mentionables = [], isLoading } = useTarefaMentionableUsers(tarefaId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sendToCofre, setSendToCofre] = useState(false);
  const [categoria, setCategoria] = useState<string>("outro");

  // Pre-select responsável da tarefa (se diferente do uploader)
  useEffect(() => {
    if (!open || !tarefaId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("projeto_tarefas")
        .select("responsavel_id")
        .eq("id", tarefaId)
        .maybeSingle();
      if (cancelled) return;
      const respId = (data as any)?.responsavel_id as string | null;
      if (respId && respId !== user?.id) {
        setSelected(new Set([respId]));
      } else {
        setSelected(new Set());
      }
    })();
    return () => { cancelled = true; };
  }, [open, tarefaId, user?.id]);

  // Reset cofre state ao reabrir
  useEffect(() => {
    if (open) {
      setSendToCofre(false);
      setCategoria("outro");
    }
  }, [open]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visibleUsers = mentionables
    .filter(u => u.id !== user?.id)
    .filter(u => !search || u.nome?.toLowerCase().includes(search.toLowerCase()));

  const cofreAvailable = !!produtoId && !!canPublishToCofre;

  const handleConfirm = (withNotify: boolean) => {
    onConfirm({
      notificarIds: withNotify ? Array.from(selected) : [],
      cofre: sendToCofre && cofreAvailable ? { categoria } : undefined,
    });
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" />
            Enviar anexo{files.length > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Opcionalmente, marque pessoas para serem notificadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border border-border/40">
                <File className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs truncate flex-1">{f.name}</span>
                <span className="text-[10px] text-muted-foreground">{formatFileSize(f.size)}</span>
              </div>
            ))}
          </div>

          {/* Promover ao Cofre */}
          {produtoId ? (
            cofreAvailable ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cofre-toggle" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                    <FolderOpen className="h-3.5 w-3.5 text-emerald-500" />
                    Promover ao Cofre do produto
                  </Label>
                  <Switch
                    id="cofre-toggle"
                    checked={sendToCofre}
                    onCheckedChange={setSendToCofre}
                  />
                </div>
                {sendToCofre && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Categoria do(s) documento(s)</Label>
                    <Select value={categoria} onValueChange={setCategoria}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COFRE_CATEGORIAS.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Após o upload, o(s) arquivo(s) serão publicados no Cofre do produto vinculado.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-600 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                Apenas Admin. Cofre ou Coordenador pode promover documentos ao Cofre.
              </div>
            )
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Notificar pessoas
                {selected.size > 0 && (
                  <span className="text-[10px] text-muted-foreground">({selected.size} selecionado{selected.size > 1 ? "s" : ""})</span>
                )}
              </label>
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="h-8 pl-7 text-xs"
              />
            </div>

            <ScrollArea className="h-48 rounded-md border border-border/40">
              {isLoading ? (
                <p className="text-xs text-muted-foreground p-3">Carregando...</p>
              ) : visibleUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">Nenhum usuário vinculado a esta tarefa.</p>
              ) : (
                <div className="p-1">
                  {visibleUsers.map(u => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => toggle(u.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                    >
                      <Checkbox
                        checked={selected.has(u.id)}
                        onCheckedChange={() => toggle(u.id)}
                        className="pointer-events-none"
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px] bg-muted">
                          {(u.nome || "?").substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate flex-1">{u.nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => handleConfirm(false)}>
            Enviar sem notificar
          </Button>
          <Button size="sm" onClick={() => handleConfirm(true)} disabled={selected.size === 0} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Enviar e notificar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
