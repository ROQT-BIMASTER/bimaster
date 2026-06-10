import { secureDownload } from "@/lib/utils/secure-download";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileText,
  Image as ImageIcon,
  File,
  Search,
  Download,
  Paperclip,
  Loader2,
  FolderOpen,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSignedThumbUrl } from "@/hooks/useSignedThumbUrl";
import { ArquivoPreviewDialog } from "./ArquivoPreviewDialog";

interface ProjetoArquivosViewProps {
  projetoId: string;
  darkBg?: boolean;
}

interface Anexo {
  id: string;
  tarefa_id: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  storage_path: string;
  created_at: string;
  tarefa_titulo?: string;
}

const VIEW_KEY = "projeto-arquivos-view";

function getFileIcon(tipo: string | null, className = "h-5 w-5") {
  if (!tipo) return <File className={cn(className, "text-muted-foreground")} />;
  if (tipo.startsWith("image/")) return <ImageIcon className={cn(className, "text-blue-400")} />;
  if (tipo.includes("pdf")) return <FileText className={cn(className, "text-red-400")} />;
  return <File className={cn(className, "text-muted-foreground")} />;
}

function fileExt(nome: string) {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i + 1).toUpperCase() : "";
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

interface CardProps {
  anexo: Anexo;
  onOpen: (a: Anexo) => void;
  onDownload: (a: Anexo) => void;
  darkBg: boolean;
}

function ArquivoCard({ anexo, onOpen, onDownload, darkBg }: CardProps) {
  const isImage = !!anexo.tipo?.startsWith("image/");
  const { data: url } = useSignedThumbUrl("projeto-anexos", isImage ? anexo.storage_path : null, isImage);
  const ext = fileExt(anexo.nome);

  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/40 group",
        darkBg && "bg-white/5 border-white/10 hover:border-white/30",
      )}
      onClick={() => onOpen(anexo)}
    >
      <div className="flex items-start gap-2 px-3 py-2.5 border-b border-border/30">
        {getFileIcon(anexo.tipo, "h-4 w-4 shrink-0 mt-0.5")}
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-medium truncate", darkBg && "text-white")}>{anexo.nome}</p>
          <p className={cn("text-[10px] truncate", darkBg ? "text-white/60" : "text-muted-foreground")}>
            ✓ {anexo.tarefa_titulo}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => {
            e.stopPropagation();
            onDownload(anexo);
          }}
        >
          <Download className="h-3 w-3" />
        </Button>
      </div>
      <div className={cn("relative aspect-video bg-muted/40 flex items-center justify-center", darkBg && "bg-black/30")}>
        {isImage && url ? (
          <img
            src={url}
            alt={anexo.nome}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : isImage ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            {getFileIcon(anexo.tipo, "h-10 w-10 opacity-60")}
            {ext && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {ext}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function ProjetoArquivosView({ projetoId, darkBg = false }: ProjetoArquivosViewProps) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [previewing, setPreviewing] = useState<Anexo | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === "grid" || stored === "list") setView(stored);
  }, []);
  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  // Fetch allowed section IDs for current user
  const { data: allowedSecaoIds } = useQuery({
    queryKey: ["membro-secoes-permitidas", projetoId, user?.id],
    queryFn: async () => {
      if (!projetoId || !user?.id) return null;
      const { data: membro } = await supabase
        .from("projeto_membros")
        .select("id, papel")
        .eq("projeto_id", projetoId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!membro) return null;
      if (["coordenador", "gestor_produto"].includes(membro.papel)) return null;
      const { data: secAssignments } = await supabase
        .from("projeto_membro_secoes")
        .select("secao_id")
        .eq("membro_id", membro.id);
      if (!secAssignments || secAssignments.length === 0) return null;
      return secAssignments.map(s => s.secao_id);
    },
    enabled: !!projetoId && !!user?.id,
  });

  const secaoIdsResolved = allowedSecaoIds !== undefined;

  const { data: anexos = [], isLoading } = useQuery({
    queryKey: ["projeto-arquivos", projetoId, allowedSecaoIds],
    enabled: secaoIdsResolved,
    queryFn: async () => {
      const { data: tarefas } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, secao_id")
        .eq("projeto_id", projetoId);
      if (!tarefas || tarefas.length === 0) return [];

      const filteredTarefas = allowedSecaoIds
        ? tarefas.filter(t => allowedSecaoIds.includes(t.secao_id))
        : tarefas;

      const tarefaMap = Object.fromEntries(filteredTarefas.map(t => [t.id, t.titulo]));
      const tarefaIds = filteredTarefas.map(t => t.id);
      if (tarefaIds.length === 0) return [];

      const { data: anexosData } = await supabase
        .from("projeto_tarefa_anexos" as any)
        .select("*")
        .in("tarefa_id", tarefaIds)
        .order("created_at", { ascending: false });

      return ((anexosData || []) as any[]).map(a => ({
        ...a,
        tarefa_titulo: tarefaMap[a.tarefa_id] || "Tarefa desconhecida",
      })) as Anexo[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return anexos;
    const q = search.toLowerCase();
    return anexos.filter(a => a.nome.toLowerCase().includes(q) || a.tarefa_titulo?.toLowerCase().includes(q));
  }, [anexos, search]);

  const handleDownload = async (anexo: Anexo) => {
    await secureDownload(anexo.storage_path, anexo.nome, "projeto-anexos");
  };

  const textColor = darkBg ? "text-white" : "";
  const textMuted = darkBg ? "text-white/60" : "text-muted-foreground";
  const cardBg = darkBg ? "bg-white/5 border-white/10" : "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={cn("h-6 w-6 animate-spin", textMuted)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4", textMuted)} />
          <Input
            placeholder="Buscar arquivos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={cn("pl-9 h-9 text-sm", darkBg && "bg-white/10 border-white/20 text-white placeholder:text-white/40")}
          />
        </div>
        <Badge variant="outline" className={cn("text-xs", darkBg && "border-white/20 text-white/60")}>
          <Paperclip className="h-3 w-3 mr-1" />
          {anexos.length} arquivo{anexos.length !== 1 ? "s" : ""}
        </Badge>
        <div className={cn("ml-auto flex items-center gap-0.5 rounded-md border p-0.5", darkBg && "border-white/20")}>
          <Button
            size="sm"
            variant={view === "grid" ? "secondary" : "ghost"}
            className="h-7 w-7 p-0"
            onClick={() => setView("grid")}
            title="Grade"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            className="h-7 w-7 p-0"
            onClick={() => setView("list")}
            title="Lista"
          >
            <ListIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={cn("flex flex-col items-center justify-center py-20 gap-2", textMuted)}>
          <FolderOpen className="h-10 w-10 opacity-40" />
          <p className="text-sm">{anexos.length === 0 ? "Nenhum arquivo neste projeto ainda." : "Nenhum arquivo encontrado."}</p>
          <p className="text-xs">Arquivos anexados às tarefas aparecerão aqui.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(anexo => (
            <ArquivoCard
              key={anexo.id}
              anexo={anexo}
              onOpen={setPreviewing}
              onDownload={handleDownload}
              darkBg={darkBg}
            />
          ))}
        </div>
      ) : (
        <Card className={cardBg}>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {filtered.map(anexo => (
                <div
                  key={anexo.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setPreviewing(anexo)}
                >
                  {getFileIcon(anexo.tipo)}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", textColor)}>{anexo.nome}</p>
                    <p className={cn("text-[11px]", textMuted)}>
                      {anexo.tarefa_titulo} • {formatSize(anexo.tamanho)}
                      {anexo.created_at && ` • ${format(new Date(anexo.created_at), "dd MMM yyyy", { locale: ptBR })}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={e => {
                      e.stopPropagation();
                      handleDownload(anexo);
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ArquivoPreviewDialog
        open={!!previewing}
        onOpenChange={v => !v && setPreviewing(null)}
        arquivo={previewing}
        projetoId={projetoId}
      />
    </div>
  );
}
