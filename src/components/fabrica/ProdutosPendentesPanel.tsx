import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import ProductThumbnail from "./ProductThumbnail";
import { Package, Rocket, Clock, ChevronRight, ChevronLeft, Pin, PinOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProdutoPendente {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  foto_url: string | null;
  created_at: string;
}

interface ProdutosPendentesPanelProps {
  onCreateLaunch: (produto: ProdutoPendente) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const STORAGE_KEY = "produtos-pendentes-panel-fixed";

export default function ProdutosPendentesPanel({
  onCreateLaunch,
  collapsed = false,
  onToggleCollapse,
}: ProdutosPendentesPanelProps) {
  const [isFixed, setIsFixed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isFixed));
  }, [isFixed]);
  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos-pendentes-lancamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select("id, codigo, nome, tipo, foto_url, created_at")
        .in("tipo", ["ACABADO", "INTER"])
        .eq("status_lancamento", "pendente")
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProdutoPendente[];
    },
  });

  const pendentesCount = produtos?.length || 0;

  // Collapsed view
  if (collapsed) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 bg-background shadow-lg border-2"
        >
          <Package className="h-4 w-4" />
          <span className="font-medium">{pendentesCount}</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pendentesCount > 0 && (
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-500 rounded-full animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <Card className={cn(
      "w-80 min-w-[320px] flex-shrink-0 border-l-4 border-l-amber-500 shadow-xl",
      isFixed ? "sticky top-6" : ""
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Produtos Pendentes</CardTitle>
              <p className="text-xs text-muted-foreground">Aguardando lançamento</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {pendentesCount}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => setIsFixed(!isFixed)}
                  >
                    {isFixed ? <Pin className="h-4 w-4 text-primary" /> : <PinOff className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isFixed ? "Desafixar painel" : "Fixar painel"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {onToggleCollapse && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-400px)] min-h-[300px]" type="always">
          <div className="p-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : pendentesCount === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Todos os produtos têm lançamento agendado!</p>
              </div>
            ) : (
              produtos?.map((produto) => (
                <div
                  key={produto.id}
                  className="group p-3 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <ProductThumbnail src={produto.foto_url} size="md" className="flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1 overflow-hidden">
                      <h4 className="font-medium text-sm truncate pr-1" title={produto.nome}>
                        {produto.nome}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{produto.codigo}</span>
                        <span>•</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {produto.tipo === "ACABADO" ? "Acabado" : "Intermediário"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          Cadastrado {formatDistanceToNow(new Date(produto.created_at), { 
                            locale: ptBR, 
                            addSuffix: true 
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-3 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    onClick={() => onCreateLaunch(produto)}
                  >
                    <Rocket className="h-3.5 w-3.5" />
                    Criar Lançamento
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {pendentesCount > 0 && (
          <div className="p-3 border-t bg-muted/30">
            <p className="text-xs text-center text-muted-foreground">
              {pendentesCount} produto{pendentesCount !== 1 ? "s" : ""} aguardando agendamento
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
