// Variações do mês (fila provisória da Fase 1): altas, quedas, novos
// fornecedores e possíveis duplicidades — fn_despesas_variacoes.
// Cada linha permite abrir o MarcarRevisaoDialog (contas_pagar_revisao).
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, CopyX, Flag, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { MarcarRevisaoDialog } from "@/components/financeiro/MarcarRevisaoDialog";
import type {
  TorreDuplicidadeItem,
  TorreNovoFornecedorItem,
  TorreVariacaoItem,
  TorreVariacoesPayload,
} from "@/types/financeiro/torre-despesas";

interface Props {
  payload: TorreVariacoesPayload | undefined;
  isLoading: boolean;
}

interface RevisaoAlvo {
  nomeItem: string;
  valorAtual: number;
  planoContasId?: string;
  departamentoId?: string;
  categoriaNome?: string;
  fornecedorNome?: string;
  fornecedorCodigo?: string;
}

const fmtPct = (v: number | null) =>
  v === null
    ? "—"
    : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const fmtData = (v: string) => format(parseISO(v), "dd/MM/yyyy");

function SeveridadeBadge({ z }: { z: number | null }) {
  if (z === null) return null;
  const absZ = Math.abs(z);
  if (absZ >= 3) {
    return (
      <Badge variant="destructive" className="text-[10px] tabular-nums shrink-0">
        z {z.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
      </Badge>
    );
  }
  if (absZ >= 2) {
    return (
      <Badge className="text-[10px] tabular-nums shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">
        z {z.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] tabular-nums shrink-0 text-muted-foreground">
      z {z.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
    </Badge>
  );
}

function BotaoRevisao({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 gap-1 text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-800 shrink-0"
      onClick={onClick}
    >
      <Flag className="h-3 w-3" />
      Revisão
    </Button>
  );
}

function Secao({
  titulo,
  icone,
  children,
  vazio,
}: {
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
  vazio: boolean;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        {icone}
        {titulo}
      </h4>
      {vazio ? <p className="text-xs text-muted-foreground py-2">Nada relevante neste mês.</p> : children}
    </div>
  );
}

export function TorreVariacoes({ payload, isLoading }: Props) {
  const [alvo, setAlvo] = useState<RevisaoAlvo | null>(null);
  const [aberto, setAberto] = useState(false);

  const abrirRevisao = (a: RevisaoAlvo) => {
    setAlvo(a);
    setAberto(true);
  };

  if (isLoading || !payload) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    );
  }

  const linhaVariacao = (item: TorreVariacaoItem, idx: number, tipo: "alta" | "queda") => (
    <li
      key={`${tipo}-${idx}-${item.fornecedor_codigo}-${item.plano_contas_id ?? "sp"}`}
      className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
    >
      <SeveridadeBadge z={item.z_6m} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{item.fornecedor_nome}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {item.departamento_nome} · {item.plano_nome}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold tabular-nums">{formatCurrency(item.valor_mes)}</p>
        <p
          className={cn(
            "text-[10px] tabular-nums",
            tipo === "alta" ? "text-destructive" : "text-success",
          )}
        >
          MoM {fmtPct(item.mom_pct)} · YoY {fmtPct(item.yoy_pct)}
        </p>
      </div>
      <BotaoRevisao
        onClick={() =>
          abrirRevisao({
            nomeItem: `${item.fornecedor_nome} · ${item.plano_nome}`,
            valorAtual: item.valor_mes,
            planoContasId: item.plano_contas_id ?? undefined,
            departamentoId: item.departamento_id ?? undefined,
            categoriaNome: item.plano_nome,
            fornecedorNome: item.fornecedor_nome,
            fornecedorCodigo: item.fornecedor_codigo,
          })
        }
      />
    </li>
  );

  const linhaNovoFornecedor = (item: TorreNovoFornecedorItem) => (
    <li
      key={`novo-${item.fornecedor_codigo}`}
      className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
    >
      <Badge className="text-[10px] shrink-0 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15">
        novo
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{item.fornecedor_nome}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          1º lançamento em {fmtData(item.primeiro_lancamento)} · {item.qtd.toLocaleString("pt-BR")} títulos
        </p>
      </div>
      <p className="text-xs font-semibold tabular-nums shrink-0">{formatCurrency(item.valor_acumulado)}</p>
      <BotaoRevisao
        onClick={() =>
          abrirRevisao({
            nomeItem: `Novo fornecedor: ${item.fornecedor_nome}`,
            valorAtual: item.valor_acumulado,
            fornecedorNome: item.fornecedor_nome,
            fornecedorCodigo: item.fornecedor_codigo,
          })
        }
      />
    </li>
  );

  const linhaDuplicidade = (item: TorreDuplicidadeItem, idx: number) => (
    <li
      key={`dup-${idx}-${item.fornecedor_codigo}`}
      className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0"
    >
      <Badge variant="destructive" className="text-[10px] shrink-0 mt-0.5">
        {item.conta_ids.length}×
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">{item.fornecedor_nome}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          Datas: {item.datas.map((d) => fmtData(d)).join(", ")}
        </p>
        <p className="text-[10px] text-muted-foreground truncate tabular-nums">
          ERP: {item.erp_ids.join(", ")}
        </p>
      </div>
      <p className="text-xs font-semibold tabular-nums shrink-0">{formatCurrency(item.valor)}</p>
      <BotaoRevisao
        onClick={() =>
          abrirRevisao({
            nomeItem: `Possível duplicidade: ${item.fornecedor_nome}`,
            valorAtual: item.valor,
            fornecedorNome: item.fornecedor_nome,
            fornecedorCodigo: item.fornecedor_codigo,
          })
        }
      />
    </li>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Secao
          titulo="Principais altas do mês"
          icone={<ArrowUpRight className="h-4 w-4 text-destructive" />}
          vazio={payload.top_altas.length === 0}
        >
          <ul>{payload.top_altas.map((item, idx) => linhaVariacao(item, idx, "alta"))}</ul>
        </Secao>

        <Secao
          titulo="Principais quedas do mês"
          icone={<ArrowDownRight className="h-4 w-4 text-success" />}
          vazio={payload.top_quedas.length === 0}
        >
          <ul>{payload.top_quedas.map((item, idx) => linhaVariacao(item, idx, "queda"))}</ul>
        </Secao>

        <Secao
          titulo="Novos fornecedores"
          icone={<Sparkles className="h-4 w-4 text-primary" />}
          vazio={payload.novos_fornecedores.length === 0}
        >
          <ul>{payload.novos_fornecedores.map(linhaNovoFornecedor)}</ul>
        </Secao>

        <Secao
          titulo="Possíveis duplicidades"
          icone={<CopyX className="h-4 w-4 text-destructive" />}
          vazio={payload.duplicidades_mes.length === 0}
        >
          <ul>{payload.duplicidades_mes.map(linhaDuplicidade)}</ul>
        </Secao>
      </div>

      {alvo && (
        <MarcarRevisaoDialog
          open={aberto}
          onOpenChange={(open) => {
            setAberto(open);
            if (!open) setAlvo(null);
          }}
          planoContasId={alvo.planoContasId}
          departamentoId={alvo.departamentoId}
          categoriaNome={alvo.categoriaNome}
          valorAtual={alvo.valorAtual}
          nomeItem={alvo.nomeItem}
          fornecedorNome={alvo.fornecedorNome}
          fornecedorCodigo={alvo.fornecedorCodigo}
        />
      )}
    </div>
  );
}
