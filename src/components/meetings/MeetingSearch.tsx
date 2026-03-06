import { useState, useCallback } from "react";
import { Search, Loader2, Play, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SearchSegment {
  text: string;
  speaker?: string;
  timestamp: string;
  timestamp_seconds: number;
  relevance: "alta" | "media" | "baixa";
  category: string;
}

interface SearchResult {
  answer: string;
  segments: SearchSegment[];
}

interface MeetingSearchProps {
  meetingId: string;
  onSeekTo: (seconds: number) => void;
  onSearchResults?: (results: { timestamp_seconds: number; text: string }[]) => void;
}

const RELEVANCE_COLORS: Record<string, string> = {
  alta: "bg-green-100 text-green-700 border-green-200",
  media: "bg-yellow-100 text-yellow-700 border-yellow-200",
  baixa: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_LABELS: Record<string, string> = {
  decisao: "Decisão",
  problema: "Problema",
  tarefa: "Tarefa",
  oportunidade: "Oportunidade",
  informacao: "Informação",
  conflito: "Conflito",
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function MeetingSearch({ meetingId, onSeekTo, onSearchResults }: MeetingSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("meeting-search", {
        body: { meetingId, query: query.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data);
      onSearchResults?.(data.segments?.map((s: SearchSegment) => ({
        timestamp_seconds: s.timestamp_seconds,
        text: s.text,
      })) || []);
    } catch (e: any) {
      toast.error(e.message || "Erro na busca");
    } finally {
      setLoading(false);
    }
  }, [meetingId, query, onSearchResults]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  const suggestions = [
    "Quais decisões foram tomadas?",
    "Quem ficou responsável pelas tarefas?",
    "Houve algum conflito ou discordância?",
    "Quais foram os principais problemas discutidos?",
  ];

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar na reunião... ex: 'quais decisões foram tomadas?'"
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading || !query.trim()} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Buscar com IA
        </Button>
      </div>

      {/* Suggestions */}
      {!result && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { setQuery(s); }}
              className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors border"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* AI Answer */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm">{result.answer}</p>
              </div>
            </CardContent>
          </Card>

          {/* Segments */}
          {result.segments?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Trechos Encontrados ({result.segments.length})
              </h4>
              {result.segments.map((seg, i) => (
                <button
                  key={i}
                  onClick={() => onSeekTo(seg.timestamp_seconds)}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Play className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{seg.text}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatTime(seg.timestamp_seconds)}
                      </span>
                      {seg.speaker && (
                        <Badge variant="secondary" className="text-xs">{seg.speaker}</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[seg.category] || seg.category}
                      </Badge>
                      <Badge className={`text-xs ${RELEVANCE_COLORS[seg.relevance] || ""}`}>
                        {seg.relevance}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Clear */}
          <Button variant="ghost" size="sm" onClick={() => { setResult(null); setQuery(""); onSearchResults?.([]); }}>
            Limpar busca
          </Button>
        </div>
      )}
    </div>
  );
}
