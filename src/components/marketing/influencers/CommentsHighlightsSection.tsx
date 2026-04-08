import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ThumbsUp, ThumbsDown, Sparkles, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { getAuthHeaders } from "@/lib/utils/auth-headers";

interface Comment {
  id: string;
  author_username: string;
  comment_text: string;
  sentiment: string | null;
  sentiment_score: number | null;
  created_at: string;
  post_caption?: string;
}

interface Props {
  influencerId: string;
}

export function CommentsHighlightsSection({ influencerId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [unanalyzedCount, setUnanalyzedCount] = useState(0);

  useEffect(() => {
    loadComments();
  }, [influencerId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const { data: posts } = await supabase
        .from("influencer_posts")
        .select("id, caption")
        .eq("influencer_id", influencerId);

      if (!posts || posts.length === 0) {
        setComments([]);
        return;
      }

      const postIds = posts.map((p) => p.id);
      const captionMap = Object.fromEntries(posts.map((p) => [p.id, p.caption]));

      const { data, error } = await supabase
        .from("influencer_comments")
        .select("id, post_id, author_username, comment_text, sentiment, sentiment_score, created_at")
        .in("post_id", postIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((c: any) => ({
        ...c,
        post_caption: captionMap[c.post_id] || "",
      }));

      setComments(enriched);
      setUnanalyzedCount(enriched.filter((c: Comment) => !c.sentiment).length);
    } catch (err) {
      console.error("Erro ao carregar comentários:", err);
    } finally {
      setLoading(false);
    }
  };

  const analyzeSentiment = async () => {
    try {
      setAnalyzing(true);
      const headers = await getAuthHeaders();
      const res = await supabase.functions.invoke("analyze-comments-sentiment", {
        body: { influencerId },
        headers,
      });

      if (res.error) throw res.error;

      const result = res.data;
      toast.success(`${result.analyzed || 0} comentários analisados com sucesso!`);
      await loadComments();
    } catch (err: any) {
      console.error("Erro ao analisar sentimento:", err);
      toast.error(err.message || "Erro ao analisar sentimento dos comentários");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum comentário coletado ainda.</p>
        </CardContent>
      </Card>
    );
  }

  const analyzed = comments.filter((c) => c.sentiment && c.sentiment_score !== null);
  const topPositive = analyzed
    .filter((c) => c.sentiment === "positive")
    .sort((a, b) => (b.sentiment_score ?? 0) - (a.sentiment_score ?? 0))
    .slice(0, 10);

  const topNegative = analyzed
    .filter((c) => c.sentiment === "negative")
    .sort((a, b) => (a.sentiment_score ?? 0) - (b.sentiment_score ?? 0))
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Destaques de Comentários
          <Badge variant="secondary" className="text-xs">{comments.length} total</Badge>
        </h3>
        {unanalyzedCount > 0 && (
          <Button onClick={analyzeSentiment} disabled={analyzing} variant="outline" size="sm">
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Analisar {unanalyzedCount} comentários
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Positivos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-green-600">
              <ThumbsUp className="h-4 w-4" />
              Top 10 Positivos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {topPositive.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum comentário positivo encontrado
              </p>
            ) : (
              topPositive.map((c) => (
                <CommentCard key={c.id} comment={c} variant="positive" />
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Negativos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <ThumbsDown className="h-4 w-4" />
              Top 10 Negativos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {topNegative.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum comentário negativo encontrado
              </p>
            ) : (
              topNegative.map((c) => (
                <CommentCard key={c.id} comment={c} variant="negative" />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CommentCard({ comment, variant }: { comment: Comment; variant: "positive" | "negative" }) {
  const borderColor = variant === "positive" ? "border-l-green-500" : "border-l-red-500";
  const score = comment.sentiment_score !== null ? Math.abs(comment.sentiment_score).toFixed(2) : "-";

  return (
    <div className={`border-l-2 ${borderColor} pl-3 py-2 space-y-1`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">@{comment.author_username}</span>
        <Badge variant={variant === "positive" ? "success" : "destructive"} className="text-[10px]">
          {score}
        </Badge>
      </div>
      <p className="text-xs text-foreground line-clamp-3">{comment.comment_text}</p>
      {comment.post_caption && (
        <p className="text-[10px] text-muted-foreground truncate">
          Post: {comment.post_caption}
        </p>
      )}
    </div>
  );
}
