import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { Link2, Search, AlertTriangle } from "lucide-react";

interface Sugestao {
  fornecedor_codigo: string;
  fornecedor_nome: string;
  empresa_nome: string | null;
  titulos: number;
  valor_12m: number;
  ultimo_vencimento: string | null;
  similaridade: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revisaoId: string;
  nomeAtual: string;
  valorMensal: number;
  onVinculado?: () => void;
}

export function VincularContaPagarDialog({
  open,
  onOpenChange,
  revisaoId,
  nomeAtual,
  valorMensal,
  onVinculado,
}: Props) {
  const [busca, setBusca] = useState(nomeAtual);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);

  const buscar = async (termo: string) => {
    if (!termo.trim()) {
      setSugestoes([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("rpc_sugerir_fornecedores_ap", {
      p_nome: termo,
      p_limit: 10,
    });
    setLoading(false);
    if (error) {
      toast.error("Falha ao buscar fornecedores");
      return;
    }
    setSugestoes((data || []) as Sugestao[]);
  };

  useEffect(() => {
    if (open) {
      setBusca(nomeAtual);
      buscar(nomeAtual);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nomeAtual]);

  const vincular = async (s: Sugestao) => {
    setSalvando(s.fornecedor_codigo);
    const { error } = await supabase
      .from("contas_pagar_revisao")
      .update({
        fornecedor_codigo: s.fornecedor_codigo,
        fornecedor_nome: s.fornecedor_nome,
        empresa_nome: s.empresa_nome ?? undefined,
      })
      .eq("id", revisaoId);
    setSalvando(null);
    if (error) {
      toast.error("Falha ao vincular fornecedor");
      return;
    }
    toast.success("Fornecedor vinculado ao Contas a Pagar");
    onVinculado?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Vincular ao Contas a Pagar
          </DialogTitle>
          <DialogDescription>
            Item manual: <span className="font-medium text-foreground">{nomeAtual}</span>
            {" · "}
            valor mensal {formatCurrency(valorMensal)}. Selecione o fornecedor
            correspondente no Contas a Pagar para passar a monitorar em tempo
            real.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar(busca)}
              placeholder="Buscar fornecedor no Contas a Pagar"
              className="pl-8"
            />
          </div>
          <Button variant="secondary" onClick={() => buscar(busca)} disabled={loading}>
            Buscar
          </Button>
        </div>

        <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
          {loading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sugestoes.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Nenhum fornecedor parecido encontrado no Contas a Pagar.
              <span className="text-xs">Tente outro termo de busca.</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Fornecedor</th>
                  <th className="text-left px-3 py-2 font-medium">Empresa</th>
                  <th className="text-right px-3 py-2 font-medium">Títulos</th>
                  <th className="text-right px-3 py-2 font-medium">12 meses</th>
                  <th className="text-right px-3 py-2 font-medium">Sim.</th>
                  <th className="text-right px-3 py-2 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {sugestoes.map((s) => {
                  const simPct = Math.round((s.similaridade || 0) * 100);
                  const alta = simPct >= 60;
                  return (
                    <tr key={s.fornecedor_codigo} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="font-medium">{s.fornecedor_nome}</div>
                        <div className="text-xs text-muted-foreground">cód. {s.fornecedor_codigo}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {s.empresa_nome || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.titulos}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(s.valor_12m || 0))}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={alta ? "default" : "secondary"} className="tabular-nums">
                          {simPct}%
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          onClick={() => vincular(s)}
                          disabled={!!salvando}
                        >
                          {salvando === s.fornecedor_codigo ? "..." : "Vincular"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Manter como manual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
