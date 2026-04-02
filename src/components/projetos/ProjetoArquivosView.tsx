import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, Image, File, Search, Download, Paperclip, Loader2, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

function getFileIcon(tipo: string | null) {
  if (!tipo) return <File className="h-5 w-5 text-muted-foreground" />;
  if (tipo.startsWith("image/")) return <Image className="h-5 w-5 text-blue-400" />;
  if (tipo.includes("pdf")) return <FileText className="h-5 w-5 text-red-400" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function ProjetoArquivosView({ projetoId, darkBg = false }: ProjetoArquivosViewProps) {
  const [search, setSearch] = useState("");
  const { user } = useAuth();

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

  const { data: anexos = [], isLoading } = useQuery({
    queryKey: ["projeto-arquivos", projetoId],
    queryFn: async () => {
      // Get all task IDs for this project
      const { data: tarefas } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, secao_id")
        .eq("projeto_id", projetoId);
      if (!tarefas || tarefas.length === 0) return [];

      // Filter tasks by allowed sections
      const filteredTarefas = allowedSecaoIds
        ? tarefas.filter(t => allowedSecaoIds.includes(t.secao_id))
        : tarefas;

      const tarefaMap = Object.fromEntries(filteredTarefas.map(t => [t.id, t.titulo]));
      const tarefaIds = filteredTarefas.map(t => t.id);
      if (tarefaIds.length === 0) return [];

      // Get all anexos for those tasks
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
    const { data } = await supabase.storage.from("projeto-anexos").createSignedUrl(anexo.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
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
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
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
      </div>

      {filtered.length === 0 ? (
        <div className={cn("flex flex-col items-center justify-center py-20 gap-2", textMuted)}>
          <FolderOpen className="h-10 w-10 opacity-40" />
          <p className="text-sm">{anexos.length === 0 ? "Nenhum arquivo neste projeto ainda." : "Nenhum arquivo encontrado."}</p>
          <p className="text-xs">Arquivos anexados às tarefas aparecerão aqui.</p>
        </div>
      ) : (
        <Card className={cardBg}>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {filtered.map(anexo => (
                <div key={anexo.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  {getFileIcon(anexo.tipo)}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", textColor)}>{anexo.nome}</p>
                    <p className={cn("text-[11px]", textMuted)}>
                      {anexo.tarefa_titulo} • {formatSize(anexo.tamanho)}
                      {anexo.created_at && ` • ${format(new Date(anexo.created_at), "dd MMM yyyy", { locale: ptBR })}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(anexo)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
