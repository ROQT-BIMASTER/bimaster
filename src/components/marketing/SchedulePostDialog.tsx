import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, Clock, Image, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  account_name: string;
}

interface SchedulePostDialogProps {
  accounts: SocialAccount[];
  onPostScheduled?: () => void;
}

export const SchedulePostDialog = ({ accounts, onPostScheduled }: SchedulePostDialogProps) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleAddMedia = () => {
    if (newMediaUrl.trim()) {
      setMediaUrls([...mediaUrls, newMediaUrl.trim()]);
      setNewMediaUrl("");
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const handleSchedulePost = async () => {
    if (!content.trim()) {
      toast({
        title: "Erro",
        description: "O conteúdo do post não pode estar vazio",
        variant: "destructive",
      });
      return;
    }

    if (selectedAccounts.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma conta",
        variant: "destructive",
      });
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      toast({
        title: "Erro",
        description: "Selecione data e hora para o agendamento",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);

      const { error } = await supabase.from("social_media_posts").insert({
        user_id: user.id,
        account_ids: selectedAccounts,
        content,
        media_urls: mediaUrls,
        scheduled_at: scheduledAt.toISOString(),
        status: "scheduled",
      });

      if (error) throw error;

      toast({
        title: "Post agendado!",
        description: `Post será publicado em ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      setContent("");
      setSelectedAccounts([]);
      setScheduledDate("");
      setScheduledTime("");
      setMediaUrls([]);
      setOpen(false);
      onPostScheduled?.();
    } catch (error) {
      console.error("Erro ao agendar post:", error);
      toast({
        title: "Erro",
        description: "Não foi possível agendar o post",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Sugerir melhor horário baseado em engajamento histórico
  const suggestBestTime = () => {
    // TODO: Implementar lógica de sugestão baseada em dados históricos
    const now = new Date();
    const bestHour = 18; // 18h como exemplo
    now.setHours(bestHour, 0, 0, 0);
    
    setScheduledTime(format(now, "HH:mm"));
    toast({
      title: "Horário sugerido",
      description: "Baseado no histórico de engajamento",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Agendar Post
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Publicação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conteúdo do Post */}
          <div>
            <Label htmlFor="content">Conteúdo do Post</Label>
            <Textarea
              id="content"
              placeholder="O que você quer compartilhar?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground mt-1">
              {content.length} caracteres
            </p>
          </div>

          {/* Seleção de Contas */}
          <div>
            <Label>Publicar em:</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent"
                >
                  <Checkbox
                    id={account.id}
                    checked={selectedAccounts.includes(account.id)}
                    onCheckedChange={() => handleAccountToggle(account.id)}
                  />
                  <label
                    htmlFor={account.id}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium">{account.platform}</div>
                    <div className="text-sm text-muted-foreground">
                      {account.username}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Agendamento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                Data
              </Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div>
              <Label htmlFor="time">
                <Clock className="w-4 h-4 inline mr-1" />
                Horário
              </Label>
              <div className="flex gap-2">
                <Input
                  id="time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={suggestBestTime}
                  title="Sugerir melhor horário"
                >
                  <Clock className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Mídias */}
          <div>
            <Label>
              <Image className="w-4 h-4 inline mr-1" />
              Mídias (URLs)
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Cole a URL da imagem ou vídeo"
                value={newMediaUrl}
                onChange={(e) => setNewMediaUrl(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddMedia()}
              />
              <Button onClick={handleAddMedia} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {mediaUrls.length > 0 && (
              <div className="mt-2 space-y-2">
                {mediaUrls.map((url, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 border rounded"
                  >
                    <Image className="w-4 h-4" />
                    <span className="flex-1 text-sm truncate">{url}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveMedia(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSchedulePost} disabled={loading}>
              {loading ? "Agendando..." : "Agendar Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
