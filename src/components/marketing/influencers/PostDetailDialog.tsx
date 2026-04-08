import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Heart, MessageCircle, BarChart3, ExternalLink, Loader2,
  ThumbsUp, ThumbsDown, Minus, AlertTriangle, Image, Video, Film,
} from "lucide-react";

interface PostDetailDialogProps {
  post: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const typeIcons: Record<string, any> = {
  video: Video,
  reel: Film,
  image: Image,
  story: Film,
};

function SentimentBadge({ sentiment }: { sentiment: string }) {
  if (sentiment === "positive") return <Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px]"><ThumbsUp className="h-3 w-3 mr-0.5" />Positivo</Badge>;
  if (sentiment === "negative") return <Badge className="bg-red-500/10 text-red-600 border-red-200 text-[10px]"><ThumbsDown className="h-3 w-3 mr-0.5" />Negativo</Badge>;
  return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200 text-[10px]"><Minus className="h-3 w-3 mr-0.5" />Neutro</Badge>;
}

export function PostDetailDialog({ post, open, onOpenChange }: PostDetailDialogProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (open && post?.id) {
      loadComments();
      setImgError(false);
    }
  }, [open, post?.id]);

  const loadComments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("influencer_comments")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments(data || []);
    setLoading(false);
  };

  if (!post) return null;

  const TypeIcon = typeIcons[post.post_type] || Image;
  const hasThumbnail = post.thumbnail_url && !imgError;

  const sentimentCounts = comments.reduce((acc, c) => {
    const s = c.sentiment || "neutral";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5" />
            Detalhes do Post
            <Badge variant="outline" className="capitalize">{post.post_type}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-4">
            {/* Thumbnail */}
            {hasThumbnail ? (
              <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
                <img
                  src={post.thumbnail_url}
                  alt="Post thumbnail"
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div className="rounded-lg bg-muted flex items-center justify-center aspect-video">
                <TypeIcon className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}

            {/* Metrics */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5 text-sm">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="font-semibold">{formatNumber(post.likes)}</span>
                <span className="text-muted-foreground">likes</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="font-semibold">{formatNumber(post.comments_count)}</span>
                <span className="text-muted-foreground">comentários</span>
              </div>
              {post.shares > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold">{formatNumber(post.shares)}</span>
                  <span className="text-muted-foreground">shares</span>
                </div>
              )}
            </div>

            {/* Date + Link */}
            <div className="flex items-center justify-between">
              {post.posted_at && (
                <span className="text-sm text-muted-foreground">
                  {new Date(post.posted_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </span>
              )}
              {post.post_url && (
                <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3.5 w-3.5" /> Ver original
                </a>
              )}
            </div>

            {/* Caption */}
            {post.caption && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.caption}</p>
                </CardContent>
              </Card>
            )}

            {/* Comments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Comentários ({comments.length})
                </h4>
                {comments.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    {sentimentCounts.positive > 0 && (
                      <span className="flex items-center gap-0.5 text-green-600">
                        <ThumbsUp className="h-3 w-3" /> {sentimentCounts.positive}
                      </span>
                    )}
                    {sentimentCounts.neutral > 0 && (
                      <span className="flex items-center gap-0.5 text-yellow-600">
                        <Minus className="h-3 w-3" /> {sentimentCounts.neutral}
                      </span>
                    )}
                    {sentimentCounts.negative > 0 && (
                      <span className="flex items-center gap-0.5 text-red-600">
                        <ThumbsDown className="h-3 w-3" /> {sentimentCounts.negative}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-2">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2 p-2 rounded-lg bg-muted/30 border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">@{c.author_username}</span>
                          <SentimentBadge sentiment={c.sentiment} />
                          {c.is_spam && (
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="h-3 w-3 mr-0.5" /> Spam
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{c.comment_text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                  Nenhum comentário coletado para este post
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
