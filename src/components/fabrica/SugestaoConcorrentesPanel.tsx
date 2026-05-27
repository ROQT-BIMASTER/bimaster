import { useState } from "react";
import { Trophy, Trash2, Search, Plus, RotateCcw, Loader2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import {
  useConcorrentesSugestao,
  useBuscarProdutoParaVincular,
  useVincularConcorrente,
  useDesvincularConcorrente,
  usePromoverVencedor,
  useReabrirDisputa,
} from "@/hooks/useProdutoSugestao";
import { formatCurrency } from "@/lib/formatters";
import { useConfirm } from "@/hooks/useConfirm";

interface Props {
  sugestaoId: string;
  vencedorId: string | null;
}

export function SugestaoConcorrentesPanel({ sugestaoId, vencedorId }: Props) {
  const confirm = useConfirm();
  const [termo, setTermo] = useState("");
  const { data: concorrentes = [], isLoading } = useConcorrentesSugestao(sugestaoId);
  const { data: candidatos = [], isFetching: buscando } = useBuscarProdutoParaVincular(termo, sugestaoId);
  const vincular = useVincularConcorrente();
  const desvincular = useDesvincularConcorrente();
  const promover = usePromoverVencedor();
  const reabrir = useReabrirDisputa();

  const temVencedor = !!vencedorId;
  const idsJaVinculados = new Set(concorrentes.map((c) => c.id));

  return (
    <div className="space-y-4 rounded-md border border-dashed border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Produtos concorrentes vinculados</h3>
          <Badge variant="outline" className="text-[10px]">
            {concorrentes.length}
          </Badge>
        </div>
        {temVencedor && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => reabrir.mutate(sugestaoId)}
            disabled={reabrir.isPending}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Reabrir disputa
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Os concorrentes ficam ocultos das listagens principais — você só os vê dentro desta Sugestão.
        Em kits, o produto Sugestão é resolvido pelo vencedor (custo e quantidade).
      </p>

      {/* Buscador */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar por código, SKU ou nome para vincular..."
            className="h-8 pl-7 text-xs"
          />
        </div>
        {termo.trim().length >= 2 && (
          <div className="max-h-48 overflow-y-auto rounded border bg-background">
            {buscando && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
              </div>
            )}
            {!buscando && candidatos.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum candidato encontrado.</div>
            )}
            {candidatos
              .filter((c: any) => !idsJaVinculados.has(c.id))
              .map((c: any) => (
                <button
                  type="button"
                  key={c.id}
                  className="flex w-full items-center gap-2 border-b px-3 py-1.5 text-left text-xs last:border-b-0 hover:bg-muted/60"
                  onClick={() => {
                    vincular.mutate(
                      { sugestao_id: sugestaoId, concorrente_id: c.id },
                      { onSuccess: () => setTermo("") }
                    );
                  }}
                  disabled={vincular.isPending}
                >
                  <ProductThumbnail src={c.foto_url} alt={c.nome} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.nome}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{c.codigo}</div>
                  </div>
                  <span className="font-mono text-[10px]">
                    {c.custo_unitario != null ? formatCurrency(Number(c.custo_unitario)) : "—"}
                  </span>
                  <Plus className="h-3 w-3 text-primary" />
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Lista de concorrentes */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando concorrentes...
        </div>
      ) : concorrentes.length === 0 ? (
        <div className="rounded border border-dashed bg-background/50 p-4 text-center text-xs text-muted-foreground">
          Nenhum concorrente vinculado ainda. Use a busca acima para adicionar.
        </div>
      ) : (
        <div className="space-y-1.5">
          {concorrentes.map((c) => {
            const isVencedor = c.id === vencedorId;
            const isArquivado = c.modo === "arquivado";
            return (
              <div
                key={c.id}
                className={`flex items-center gap-2 rounded-md border p-2 ${
                  isVencedor
                    ? "border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30"
                    : isArquivado
                    ? "border-border bg-muted/40 opacity-70"
                    : "border-border bg-background"
                }`}
              >
                <ProductThumbnail src={c.foto_url} alt={c.nome} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{c.nome}</span>
                    {isVencedor && (
                      <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0">
                        <Trophy className="h-2.5 w-2.5 mr-0.5" /> Vencedor
                      </Badge>
                    )}
                    {!isVencedor && isArquivado && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                        Descartado
                      </Badge>
                    )}
                    {!isVencedor && !isArquivado && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        Em disputa
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span className="font-mono">{c.codigo}</span>
                    {c.marca && <span>{c.marca}</span>}
                    <span className="font-mono">
                      Custo: {c.custo_unitario != null ? formatCurrency(Number(c.custo_unitario)) : "—"}
                    </span>
                  </div>
                </div>
                {!isVencedor && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() =>
                      promover.mutate({ sugestao_id: sugestaoId, vencedor_id: c.id })
                    }
                    disabled={promover.isPending}
                  >
                    <Trophy className="h-3 w-3 mr-1" /> Marcar vencedor
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={async () => {
                    if ((await confirm({ title: "Desvincular este concorrente da Sugestão?", destructive: true }))) {
                      desvincular.mutate(c.id);
                    }
                  }}
                  disabled={desvincular.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
