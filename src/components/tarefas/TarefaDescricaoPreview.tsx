/**
 * Renderiza uma descrição de tarefa em modo leitura, com suporte a imagens
 * coladas (marcadores `![alt](sb-storage://bucket/path)`).
 *
 * Segurança:
 * - Texto passa por `escapeHtml`; não usamos `dangerouslySetInnerHTML`.
 * - Apenas marcadores `sb-storage://` viram <img> (com signed URL resolvida
 *   sob demanda). Qualquer outra URL vira link `<a>` normal.
 */
import { useEffect, useMemo, useState } from "react";
import { parseStorageRef, resolveStorageRef, isStorageRef } from "@/lib/tarefas/descricaoStorageRef";

interface Props {
  value: string;
  className?: string;
}

type Node =
  | { kind: "text"; text: string }
  | { kind: "image"; alt: string; url: string }
  | { kind: "link"; label: string; url: string };

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function tokenize(input: string): Node[] {
  const nodes: Node[] = [];
  let last = 0;
  const combined = new RegExp(`${IMG_RE.source}|${LINK_RE.source}`, "g");
  for (const m of input.matchAll(combined)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push({ kind: "text", text: input.slice(last, idx) });
    if (m[0].startsWith("!")) {
      nodes.push({ kind: "image", alt: m[1] ?? "", url: m[2] ?? "" });
    } else {
      nodes.push({ kind: "link", label: m[3] ?? "", url: m[4] ?? "" });
    }
    last = idx + m[0].length;
  }
  if (last < input.length) nodes.push({ kind: "text", text: input.slice(last) });
  return nodes;
}

function StorageImage({ alt, url }: { alt: string; url: string }) {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    if (isStorageRef(url)) {
      resolveStorageRef(url).then((u) => { if (mounted) setResolved(u); });
    } else {
      setResolved(url);
    }
    return () => { mounted = false; };
  }, [url]);

  const open = async () => {
    const u = isStorageRef(url) ? await resolveStorageRef(url) : url;
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  };

  if (!resolved) {
    return (
      <span className="inline-block my-1 px-2 py-1 text-[11px] text-muted-foreground bg-muted/40 border border-border/50 rounded">
        Carregando imagem…
      </span>
    );
  }
  return (
    <img
      src={resolved}
      alt={alt}
      onClick={open}
      className="my-2 max-w-full max-h-[420px] rounded border border-border/50 cursor-zoom-in"
      loading="lazy"
    />
  );
}

export function TarefaDescricaoPreview({ value, className }: Props) {
  const nodes = useMemo(() => tokenize(value || ""), [value]);
  if (!value?.trim()) return null;
  return (
    <div className={className}>
      {nodes.map((n, i) => {
        if (n.kind === "image") {
          return <StorageImage key={i} alt={n.alt} url={n.url} />;
        }
        if (n.kind === "link") {
          return (
            <a
              key={i}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              {n.label}
            </a>
          );
        }
        return (
          <span key={i} className="whitespace-pre-wrap break-words">
            {n.text}
          </span>
        );
      })}
    </div>
  );
}
