import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, Clock, Send, MessageSquare, Loader2 } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  rascunho: { label: "Rascunho", color: "secondary", icon: Clock },
  em_revisao: { label: "Em Revisão", color: "default", icon: Send },
  aprovado: { label: "Aprovado", color: "default", icon: CheckCircle },
  publicado: { label: "Publicado", color: "default", icon: CheckCircle },
};

interface Comment {
  id: string;
  user_name: string | null;
  comment: string;
  created_at: string;
}

interface Props {
  designId: string;
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
}

export const ApprovalFlow = ({ designId, currentStatus, onStatusChange }: Props) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);

  useEffect(() => {
    loadComments();
  }, [designId]);

  const loadComments = async () => {
    const { data } = await supabase
      .from("stitch_design_comments")
      .select("id, user_name, comment, created_at")
      .eq("design_id", designId)
      .order("created_at", { ascending: true });
    setComments((data as Comment[]) || []);
    setLoadingComments(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from("stitch_designs")
        .update({ status: newStatus })
        .eq("id", designId);
      if (error) throw error;
      onStatusChange(newStatus);
      toast.success(`Status alterado para ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("stitch_design_comments").insert({
        design_id: designId,
        user_id: user.id,
        user_name: user.email?.split("@")[0] || "Usuário",
        comment: newComment.trim(),
      });
      if (error) throw error;
      setNewComment("");
      loadComments();
      toast.success("Comentário adicionado");
    } catch {
      toast.error("Erro ao adicionar comentário");
    } finally {
      setLoading(false);
    }
  };

  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.rascunho;

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <config.icon className="h-4 w-4" />
            <Badge variant={config.color as "secondary" | "default"}>{config.label}</Badge>
          </div>
          <Select value={currentStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="em_revisao">Em Revisão</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="publicado">Publicado</SelectItem>
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="max-h-[200px] overflow-y-auto space-y-2">
          {loadingComments ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum comentário</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="bg-muted/50 rounded-md p-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs font-medium">{c.user_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="text-xs">{c.comment}</p>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Textarea
            placeholder="Adicionar comentário..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="text-xs min-h-[60px]"
          />
          <Button size="sm" onClick={handleAddComment} disabled={loading || !newComment.trim()} className="self-end">
            <MessageSquare className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
