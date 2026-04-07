import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  accountId: string;
  platform: string;
}

export function InfluencerPublish({ accountId, platform }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [postType, setPostType] = useState("POST");
  const [visibility, setVisibility] = useState("PUBLIC");

  const handlePublish = async () => {
    if (!description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phyllo-proxy", {
        body: {
          action: "publish_content",
          account_id: accountId,
          type: postType,
          title: title || undefined,
          description,
          media_url: mediaUrl || undefined,
          visibility,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Conteúdo publicado com sucesso!");
      setOpen(false);
      setTitle("");
      setDescription("");
      setMediaUrl("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao publicar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="h-4 w-4 mr-1" /> Publicar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publicar Conteúdo ({platform})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={postType} onValueChange={setPostType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">Post</SelectItem>
                  <SelectItem value="REEL">Reel</SelectItem>
                  <SelectItem value="STORY">Story</SelectItem>
                  <SelectItem value="VIDEO">Vídeo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibilidade</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Público</SelectItem>
                  <SelectItem value="PRIVATE">Privado</SelectItem>
                  <SelectItem value="UNLISTED">Não listado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Título (opcional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do post" />
          </div>
          <div className="space-y-2">
            <Label>Descrição / Legenda</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Escreva a legenda..." rows={4} />
          </div>
          <div className="space-y-2">
            <Label>URL da Mídia (opcional)</Label>
            <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
          </div>
          <Button onClick={handlePublish} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Publicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
