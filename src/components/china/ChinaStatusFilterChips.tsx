/**
 * ChinaStatusFilterChips — filtro rápido (multi-seleção) por estágio do fluxo
 * China → Brasil. Mesma paleta das etiquetas (`DocStatusTag`), bilíngue,
 * com contadores e botão "Limpar".
 *
 * O estado é local por tela; use `useChinaStatusFilter` para persistir em
 * `localStorage`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  checklistStatusTexto,
  docStatusIconComponent,
  docStatusVisual,
  formatarLabelBilingue,
  type DocStatusIdioma,
} from "@/lib/china/docStatus";
import type { FlowBucket } from "@/lib/china/flowTones";

/** Ordem canônica e status representativo de cada estágio (para cor/ícone/rótulo). */
export const FILTER_BUCKETS: Array<{ bucket: FlowBucket; statusRef: string }> = [
  { bucket: "em_analise", statusRef: "em_analise" },
  { bucket: "aprovado", statusRef: "aprovado" },
  { bucket: "rejeitado", statusRef: "rejeitado" },
  { bucket: "enviado", statusRef: "enviado_brasil" },
  { bucket: "pendente", statusRef: "pendente" },
  { bucket: "nao_criado", statusRef: "nao_criado" },
];

interface Props {
  counts: Partial<Record<FlowBucket, number>>;
  selected: FlowBucket[];
  onChange: (next: FlowBucket[]) => void;
  idioma?: DocStatusIdioma;
  /** Esconde chips com contagem zero (padrão: true). */
  hideEmpty?: boolean;
  label?: string;
  className?: string;
}

export function ChinaStatusFilterChips({
  counts,
  selected,
  onChange,
  idioma = "bi",
  hideEmpty = true,
  label,
  className,
}: Props) {
  const toggle = (b: FlowBucket) =>
    onChange(selected.includes(b) ? selected.filter((x) => x !== b) : [...selected, b]);

  const visiveis = FILTER_BUCKETS.filter(
    ({ bucket }) => !hideEmpty || (counts[bucket] || 0) > 0,
  );
  if (visiveis.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {label && (
        <span className="mr-0.5 text-[10px] font-medium text-muted-foreground">{label}:</span>
      )}
      {visiveis.map(({ bucket, statusRef }) => {
        const active = selected.includes(bucket);
        const visual = docStatusVisual(statusRef);
        const Icon = docStatusIconComponent(statusRef);
        const texto = checklistStatusTexto(statusRef);
        return (
          <button
            key={bucket}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(bucket)}
            title={`${texto.pt} / ${texto.zh}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              active
                ? cn(visual.badge, "ring-1 ring-inset ring-current/40")
                : "border-border/60 text-muted-foreground hover:bg-muted/50",
            )}
          >
            <Icon className={cn("h-2.5 w-2.5", active ? "" : "opacity-70")} />
            <span className="truncate">{formatarLabelBilingue(texto, idioma)}</span>
            <span className="rounded bg-background/70 px-1 tabular-nums">
              {counts[bucket] || 0}
            </span>
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Limpar 清除
        </button>
      )}
    </div>
  );
}

/** Escopo compartilhado: mesma visualização em Kanban, Caixa de Entrada e Checklist. */
export const CHINA_STATUS_FILTER_SCOPE = "china:status";

const BUCKETS_VALIDOS = new Set<FlowBucket>(FILTER_BUCKETS.map((f) => f.bucket));

function sanitizar(valor: unknown): FlowBucket[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((v): v is FlowBucket => BUCKETS_VALIDOS.has(v as FlowBucket));
}

function lerCache(escopo: string): FlowBucket[] {
  try {
    return sanitizar(JSON.parse(localStorage.getItem(`china-status-filter:${escopo}`) || "null"));
  } catch {
    return [];
  }
}

function gravarCache(escopo: string, buckets: FlowBucket[]) {
  try {
    localStorage.setItem(`china-status-filter:${escopo}`, JSON.stringify(buckets));
  } catch {
    /* storage indisponível — filtro segue apenas em memória */
  }
}

/**
 * Filtro por estágio persistido por usuário no backend (com cache local para
 * render imediato). O escopo padrão é compartilhado entre as telas do módulo
 * China, então o time mantém a mesma visualização ao trocar de página.
 */
export function useChinaStatusFilter(escopo: string = CHINA_STATUS_FILTER_SCOPE) {
  const [selected, setSelected] = useState<FlowBucket[]>(() => lerCache(escopo));
  const userIdRef = useRef<string | null>(null);

  // Carrega a preferência salva do usuário ao montar / trocar de escopo.
  useEffect(() => {
    let ativo = true;
    setSelected(lerCache(escopo));

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      userIdRef.current = uid;
      if (!uid || !ativo) return;

      const { data, error } = await supabase
        .from("china_status_filter_prefs")
        .select("buckets")
        .eq("user_id", uid)
        .eq("escopo", escopo)
        .maybeSingle();

      if (!ativo || error || !data) return;
      const remoto = sanitizar(data.buckets);
      gravarCache(escopo, remoto);
      setSelected(remoto);
    })();

    return () => {
      ativo = false;
    };
  }, [escopo]);

  const update = useCallback(
    (next: FlowBucket[]) => {
      const limpo = sanitizar(next);
      setSelected(limpo);
      gravarCache(escopo, limpo);

      void (async () => {
        let uid = userIdRef.current;
        if (!uid) {
          const { data: auth } = await supabase.auth.getUser();
          uid = auth?.user?.id ?? null;
          userIdRef.current = uid;
        }
        if (!uid) return;
        await supabase
          .from("china_status_filter_prefs")
          .upsert(
            { user_id: uid, escopo, buckets: limpo, updated_at: new Date().toISOString() },
            { onConflict: "user_id,escopo" },
          );
      })();
    },
    [escopo],
  );

  const matches = useCallback(
    (bucket: FlowBucket) => selected.length === 0 || selected.includes(bucket),
    [selected],
  );

  return { selected, setSelected: update, matches };
}

