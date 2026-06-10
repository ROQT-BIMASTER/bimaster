import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileText, Download, Loader2, X, Image as ImageIcon, Film, Music } from "lucide-react";
import { signedAnexoUrl, formatBytes } from "./utils";
import { toast } from "sonner";
import type { ChatAnexo } from "@/hooks/chat/types";
import { detectFileKind } from "@/lib/utils/detectFileKind";

/**
 * Galeria de mídia/arquivos de uma conversa.
 * Carrega anexos via join mensagens(conversa_id) → chat_anexos, limita a 60
 * itens recentes para manter UI leve. Cliques em imagem abrem lightbox.
 */
export function ConversaMediaGallery({ conversaId }: { conversaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["chat", "anexos", conversaId],
    enabled: !!conversaId,
    staleTime: 30_000,
    queryFn: async (): Promise<ChatAnexo[]> => {
      const { data: msgs, error: mErr } = await supabase
        .from("mensagens")
        .select("id")
        .eq("conversa_id", conversaId)
        .eq("excluida_para_todos", false)
        .order("created_at", { ascending: false })
        .limit(300);
      if (mErr) throw mErr;
      const ids = (msgs ?? []).map((m) => m.id);
      if (ids.length === 0) return [];
      const { data: anexos, error: aErr } = await supabase
        .from("mensagens_anexos")
        .select("id, mensagem_id, file_name, storage_path, mime_type, size_bytes, width, height, duration_ms, thumbnail_path")
        .in("mensagem_id", ids)
        .order("created_at", { ascending: false })
        .limit(60);
      if (aErr) throw aErr;
      return (anexos ?? []) as ChatAnexo[];
    },
  });

  const lista = data ?? [];
  const withKind = lista.map((a) => ({ a, kind: detectFileKind(a.file_name, a.mime_type) }));
  const imagens = withKind.filter((x) => x.kind === "image").map((x) => x.a);
  const videos = withKind.filter((x) => x.kind === "video").map((x) => x.a);
  const audios = withKind.filter((x) => x.kind === "audio").map((x) => x.a);
  const arquivos = withKind.filter((x) => x.kind === "other" || x.kind === "pdf").map((x) => x.a);

  return (
    <div className="p-3 border-t border-border">
      <h5 className="text-xs font-semibold text-muted-foreground mb-2 px-1">
        Mídia e arquivos {lista.length > 0 && <span className="font-normal">({lista.length})</span>}
      </h5>
      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1 py-3">Nenhum anexo nesta conversa ainda.</p>
      ) : (
        <Tabs defaultValue="imagens">
          <TabsList className="grid grid-cols-4 h-8 w-full">
            <TabsTrigger value="imagens" className="text-[11px] gap-1">
              <ImageIcon className="h-3 w-3" /> {imagens.length}
            </TabsTrigger>
            <TabsTrigger value="videos" className="text-[11px] gap-1">
              <Film className="h-3 w-3" /> {videos.length}
            </TabsTrigger>
            <TabsTrigger value="audios" className="text-[11px] gap-1">
              <Music className="h-3 w-3" /> {audios.length}
            </TabsTrigger>
            <TabsTrigger value="arquivos" className="text-[11px] gap-1">
              <FileText className="h-3 w-3" /> {arquivos.length}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="imagens" className="mt-2">
            <ImageGrid items={imagens} />
          </TabsContent>
          <TabsContent value="videos" className="mt-2">
            <VideoList items={videos} />
          </TabsContent>
          <TabsContent value="audios" className="mt-2">
            <FileList items={audios} icon={<Music className="h-4 w-4" />} />
          </TabsContent>
          <TabsContent value="arquivos" className="mt-2">
            <FileList items={arquivos} icon={<FileText className="h-4 w-4" />} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ImageGrid({ items }: { items: ChatAnexo[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (items.length === 0) return <Empty label="Sem imagens" />;
  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {items.map((a, idx) => (
          <Thumb key={a.id} anexo={a} onClick={() => setOpenIdx(idx)} />
        ))}
      </div>
      <Lightbox items={items} index={openIdx} onClose={() => setOpenIdx(null)} onIndex={setOpenIdx} />
    </>
  );
}

function Thumb({ anexo, onClick }: { anexo: ChatAnexo; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signedAnexoUrl(anexo.storage_path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [anexo.storage_path]);
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative aspect-square rounded overflow-hidden bg-muted hover:opacity-90"
      title={anexo.file_name}
    >
      {url ? (
        <img src={url} alt={anexo.file_name} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-muted-foreground" />
      )}
    </button>
  );
}

function VideoList({ items }: { items: ChatAnexo[] }) {
  if (items.length === 0) return <Empty label="Sem vídeos" />;
  return (
    <ul className="space-y-1">
      {items.map((a) => (
        <FileRow key={a.id} anexo={a} icon={<Film className="h-4 w-4" />} />
      ))}
    </ul>
  );
}

function FileList({ items, icon }: { items: ChatAnexo[]; icon: React.ReactNode }) {
  if (items.length === 0) return <Empty label="Nada por aqui" />;
  return (
    <ul className="space-y-1">
      {items.map((a) => (
        <FileRow key={a.id} anexo={a} icon={icon} />
      ))}
    </ul>
  );
}

function FileRow({ anexo, icon }: { anexo: ChatAnexo; icon: React.ReactNode }) {
  const baixar = async () => {
    try {
      const { data, error } = await supabase.storage.from("chat-anexos").download(anexo.storage_path);
      if (error || !data) throw error ?? new Error("falha");
      const blobUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = blobUrl; link.download = anexo.file_name;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      toast.error("Erro ao baixar: " + (e?.message ?? ""));
    }
  };
  return (
    <li className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50">
      <span className="opacity-70 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate">{anexo.file_name}</p>
        <p className="text-[10px] text-muted-foreground">{formatBytes(anexo.size_bytes)}</p>
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={baixar} aria-label="Baixar">
        <Download className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground px-1 py-3">{label}</p>;
}

function Lightbox({
  items, index, onClose, onIndex,
}: {
  items: ChatAnexo[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const current = index != null ? items[index] : null;
  useEffect(() => {
    if (!current) { setUrl(null); return; }
    let alive = true;
    signedAnexoUrl(current.storage_path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [current?.storage_path]);
  useEffect(() => {
    if (index == null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex((index + 1) % items.length);
      else if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [index, items.length, onIndex]);

  if (!current) return null;
  return (
    <Dialog open={index != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-screen-lg w-fit p-0 bg-transparent border-0 shadow-none [&>button]:hidden"
        onClick={onClose}
      >
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          {url ? (
            <img src={url} alt={current.file_name} className="max-h-[88vh] w-auto rounded-lg" />
          ) : (
            <div className="h-80 w-80 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>
          )}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 shadow-md"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="absolute bottom-3 left-3 text-xs text-white bg-black/50 rounded px-2 py-1 backdrop-blur">
            {current.file_name} · {formatBytes(current.size_bytes)}
            {items.length > 1 && <span className="ml-2 opacity-75">{(index ?? 0) + 1}/{items.length}</span>}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
