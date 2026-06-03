import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, MessageSquareWarning, ChevronDown } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useBriefingVersoes, type BriefingVersao } from "@/hooks/useBriefingVersoes";

interface Secao {
  key: string;
  label: string;
}

interface Props {
  briefingId: string;
  secoes?: Secao[];
}

function diffPayloads(
  prev: Record<string, unknown> = {},
  curr: Record<string, unknown> = {},
) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
  const changes: { key: string; de: unknown; para: unknown }[] = [];
  for (const k of keys) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(curr[k])) {
      changes.push({ key: k, de: prev[k], para: curr[k] });
    }
  }
  return changes;
}

function renderValor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? s.slice(0, 200) + "…" : s;
  } catch {
    return String(v);
  }
}

export function BriefingVersoesTimeline({ briefingId, secoes }: Props) {
  const { data: versoes, isLoading } = useBriefingVersoes(briefingId);

  const labelOf = useMemo(() => {
    const map = new Map((secoes ?? []).map((s) => [s.key, s.label]));
    return (k: string) => map.get(k) ?? k;
  }, [secoes]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!versoes || versoes.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Este briefing ainda não foi enviado para produção.
      </Card>
    );
  }

  return (
    <div className="relative space-y-4 pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
      {versoes.map((v, idx) => {
        const prev = idx > 0 ? versoes[idx - 1] : undefined;
        const changes =
          v.round > 1 && prev
            ? diffPayloads(prev.payload_snapshot, v.payload_snapshot)
            : [];
        return (
          <VersaoCard
            key={v.id}
            versao={v}
            changes={changes}
            labelOf={labelOf}
          />
        );
      })}
    </div>
  );
}

function VersaoCard({
  versao,
  changes,
  labelOf,
}: {
  versao: BriefingVersao;
  changes: { key: string; de: unknown; para: unknown }[];
  labelOf: (k: string) => string;
}) {
  const isEnvio = versao.origem === "envio";
  const data = format(new Date(versao.enviado_em), "dd/MM/yyyy HH:mm", {
    locale: ptBR,
  });

  const snapshotEntries = Object.entries(versao.payload_snapshot ?? {});

  return (
    <div className="relative">
      <span
        className={`absolute -left-[1.35rem] top-4 h-3 w-3 rounded-full border-2 border-background ${
          isEnvio ? "bg-primary" : "bg-amber-500"
        }`}
      />
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Round {versao.round}</h3>
            <Badge
              variant="outline"
              className={
                isEnvio
                  ? "border-primary/40 text-primary bg-primary/10"
                  : "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10"
              }
            >
              {isEnvio ? (
                <Send className="h-3 w-3 mr-1" />
              ) : (
                <MessageSquareWarning className="h-3 w-3 mr-1" />
              )}
              {isEnvio ? "Envio" : "Revisão"}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {data}
          </span>
        </div>

        {versao.motivo_devolucao && (
          <div className="rounded-md bg-muted/50 p-3 text-xs">
            <div className="font-semibold text-muted-foreground mb-1">
              Motivo da devolução
            </div>
            <div className="text-foreground whitespace-pre-wrap">
              {versao.motivo_devolucao}
            </div>
          </div>
        )}

        {versao.round > 1 && (
          <div className="rounded-md border border-border bg-card p-3 text-xs space-y-2">
            <div className="font-semibold text-muted-foreground">
              O que mudou
            </div>
            {changes.length === 0 ? (
              <div className="text-muted-foreground italic">
                Sem alterações nos campos.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {changes.map((c) => (
                  <li key={c.key} className="flex flex-col gap-0.5">
                    <span className="font-medium">{labelOf(c.key)}</span>
                    <span className="text-muted-foreground">
                      <span className="line-through opacity-70">
                        {renderValor(c.de)}
                      </span>
                      <span className="mx-2">→</span>
                      <span className="text-foreground">
                        {renderValor(c.para)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground group">
            <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
            Ver snapshot completo
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            {snapshotEntries.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Snapshot vazio.
              </div>
            ) : (
              <dl className="grid grid-cols-1 gap-2 text-xs">
                {snapshotEntries.map(([k, val]) => (
                  <div
                    key={k}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 border-b border-border/50 pb-1.5"
                  >
                    <dt className="font-medium text-muted-foreground">
                      {labelOf(k)}
                    </dt>
                    <dd className="text-foreground break-words whitespace-pre-wrap">
                      {renderValor(val)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
