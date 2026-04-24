import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, History as HistoryIcon, CheckCircle2, Trash2, Send,
  CircleDot, RefreshCw,
} from "lucide-react";
import type { Comentario, HistoricoEntrada } from "@/hooks/useRoteiristaRevisao";

interface Props {
  comentarios: Comentario[];
  historico: HistoricoEntrada[];
  totalAbertos: number;
  totalResolvidos: number;
  totalCenas: number;
  loading: boolean;
  onAdicionarComentario: (mensagem: string, cenaIndex: number | null) => Promise<void>;
  onAlternarResolvido: (c: Comentario) => Promise<void>;
  onExcluirComentario: (id: string) => Promise<void>;
}

const EVENTO_LABEL: Record<string, string> = {
  roteiro_criado: "Roteiro criado",
  roteiro_atualizado: "Roteiro atualizado",
  status_alterado: "Status alterado",
  cena_editada: "Cena editada",
  comentario_geral: "Comentário geral",
  comentario_cena: "Comentário em cena",
  comentario_resolvido: "Comentário resolvido",
  comentario_reaberto: "Comentário reaberto",
  enviado_para_video: "Enviado para vídeo",
  aprovado: "Roteiro aprovado",
};

function formatarDataRelativa(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `${dias}d`;
  return d.toLocaleDateString("pt-BR");
}

export function RevisaoPanel({
  comentarios,
  historico,
  totalAbertos,
  totalResolvidos,
  totalCenas,
  loading,
  onAdicionarComentario,
  onAlternarResolvido,
  onExcluirComentario,
}: Props) {
  const [novoComentario, setNovoComentario] = useState("");
  const [cenaAlvo, setCenaAlvo] = useState<string>("geral");
  const [filtro, setFiltro] = useState<"todos" | "abertos" | "resolvidos">("abertos");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!novoComentario.trim()) return;
    setEnviando(true);
    const idx = cenaAlvo === "geral" ? null : Number(cenaAlvo);
    await onAdicionarComentario(novoComentario, idx);
    setNovoComentario("");
    setEnviando(false);
  };

  const comentariosFiltrados = comentarios.filter(c => {
    if (filtro === "abertos") return !c.resolvido;
    if (filtro === "resolvidos") return c.resolvido;
    return true;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Modo Revisão
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Comentários por cena, controle de aprovação e histórico colaborativo
            </CardDescription>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              <CircleDot className="h-2.5 w-2.5 mr-1 text-amber-500" />
              {totalAbertos} aberto{totalAbertos === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <CheckCircle2 className="h-2.5 w-2.5 mr-1 text-emerald-500" />
              {totalResolvidos} resolvido{totalResolvidos === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs defaultValue="comentarios" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="comentarios" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Comentários ({comentarios.length})
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">
              <HistoryIcon className="h-3 w-3 mr-1" />
              Histórico ({historico.length})
            </TabsTrigger>
          </TabsList>

          {/* COMENTÁRIOS */}
          <TabsContent value="comentarios" className="space-y-3 mt-3">
            {/* Composer */}
            <div className="space-y-2 p-3 border rounded-md bg-muted/20">
              <div className="flex gap-2 items-center">
                <Select value={cenaAlvo} onValueChange={setCenaAlvo}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral" className="text-xs">Comentário geral</SelectItem>
                    {Array.from({ length: totalCenas }).map((_, i) => (
                      <SelectItem key={i} value={String(i)} className="text-xs">
                        Cena {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                value={novoComentario}
                onChange={e => setNovoComentario(e.target.value)}
                placeholder="Escreva uma observação para o time..."
                className="text-xs min-h-[60px] resize-none"
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    enviar();
                  }
                }}
              />
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">
                  Cmd/Ctrl + Enter para enviar
                </span>
                <Button
                  size="sm"
                  onClick={enviar}
                  disabled={!novoComentario.trim() || enviando}
                  className="h-7 text-xs"
                >
                  <Send className="h-3 w-3 mr-1" /> Enviar
                </Button>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex gap-1">
              {(["abertos", "resolvidos", "todos"] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={filtro === f ? "default" : "outline"}
                  onClick={() => setFiltro(f)}
                  className="h-7 text-[10px] capitalize flex-1"
                >
                  {f}
                </Button>
              ))}
            </div>

            {/* Lista */}
            <ScrollArea className="h-[300px] pr-2">
              {loading ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Carregando...
                </div>
              ) : comentariosFiltrados.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  {filtro === "abertos"
                    ? "Nenhum comentário aberto"
                    : filtro === "resolvidos"
                    ? "Nenhum comentário resolvido ainda"
                    : "Nenhum comentário ainda. Inicie a revisão acima."}
                </div>
              ) : (
                <div className="space-y-2">
                  {comentariosFiltrados.map(c => (
                    <div
                      key={c.id}
                      className={`p-2.5 border rounded-md text-xs space-y-1.5 ${
                        c.resolvido ? "bg-muted/30 opacity-70" : "bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">{c.autor_nome || "Usuário"}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {formatarDataRelativa(c.created_at)}
                          </span>
                          {c.cena_index !== null ? (
                            <Badge variant="secondary" className="text-[9px] h-4">
                              Cena {c.cena_index + 1}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] h-4">
                              Geral
                            </Badge>
                          )}
                          {c.resolvido && (
                            <Badge className="text-[9px] h-4 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                              Resolvido
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => onAlternarResolvido(c)}
                            title={c.resolvido ? "Reabrir" : "Marcar resolvido"}
                          >
                            <CheckCircle2
                              className={`h-3 w-3 ${
                                c.resolvido ? "text-emerald-500" : "text-muted-foreground"
                              }`}
                            />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 hover:text-destructive"
                            onClick={() => onExcluirComentario(c.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className={c.resolvido ? "line-through text-muted-foreground" : ""}>
                        {c.mensagem}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico" className="mt-3">
            <ScrollArea className="h-[400px] pr-2">
              {historico.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  Nenhuma alteração registrada ainda.
                </div>
              ) : (
                <div className="space-y-0">
                  {historico.map((h, idx) => (
                    <div key={h.id} className="flex gap-3 text-xs py-2">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                        {idx < historico.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-2 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">
                            {h.autor_nome || "Sistema"}
                          </span>
                          <Badge variant="outline" className="text-[9px] h-4">
                            {EVENTO_LABEL[h.evento] || h.evento}
                          </Badge>
                          {h.cena_index !== null && (
                            <Badge variant="secondary" className="text-[9px] h-4">
                              Cena {h.cena_index + 1}
                            </Badge>
                          )}
                          <span className="text-muted-foreground text-[10px] ml-auto">
                            {formatarDataRelativa(h.created_at)}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{h.descricao}</p>
                        {h.campo && (h.valor_anterior || h.valor_novo) && (
                          <div className="text-[10px] mt-1 p-1.5 rounded border bg-muted/30 space-y-0.5">
                            <div className="font-mono text-muted-foreground">
                              campo: {h.campo}
                            </div>
                            {h.valor_anterior && (
                              <div className="text-rose-600 dark:text-rose-400 line-clamp-2">
                                − {h.valor_anterior}
                              </div>
                            )}
                            {h.valor_novo && (
                              <div className="text-emerald-600 dark:text-emerald-400 line-clamp-2">
                                + {h.valor_novo}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Separator />
        <p className="text-[10px] text-muted-foreground text-center">
          Atualizado em tempo real • use os comentários antes de aprovar
        </p>
      </CardContent>
    </Card>
  );
}
