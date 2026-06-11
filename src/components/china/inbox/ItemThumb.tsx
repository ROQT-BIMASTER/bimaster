/**
 * ItemThumb — thumbnail compacta de um documento da caixa de entrada China.
 * Renderiza imagem inline quando o arquivo é imagem; caso contrário mostra
 * ícone do tipo (PDF em vermelho, demais neutros).
 *
 * O fetch da signed URL só dispara quando o componente entra no viewport,
 * para evitar N requests simultâneos em boards com muitos cards.
 */
import { useEffect, useRef, useState } from "react";
import { FileText, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import { useChinaDocThumbnail } from "@/hooks/useChinaDocThumbnail";

interface Props {
  item: Pick<MailboxItem, "arquivo_path" | "arquivo_url" | "nome_arquivo"> & {
    is_virtual?: boolean;
  };
  size?: "sm" | "md";
  className?: string;
}

export function ItemThumb({ item, size = "md", className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const { kind, url } = useChinaDocThumbnail({
    arquivoPath: item.arquivo_path,
    arquivoUrl: item.arquivo_url,
    nomeArquivo: item.nome_arquivo,
    enabled: visible,
  });

  const isSm = size === "sm";
  const dims = isSm
    ? "h-12 w-12 rounded-sm"
    : "h-32 w-full rounded-md";

  const base = cn(
    "relative overflow-hidden border border-border bg-muted/30 flex items-center justify-center shrink-0",
    dims,
    className,
  );

  if (item.is_virtual || (!item.arquivo_path && !item.arquivo_url)) {
    return (
      <div ref={ref} className={cn(base, "border-dashed")} aria-hidden>
        <ImageIcon className={cn("opacity-30", isSm ? "h-3.5 w-3.5" : "h-5 w-5")} />
      </div>
    );
  }

  if (kind === "image") {
    return (
      <div ref={ref} className={base} title={item.nome_arquivo ?? undefined}>
        {url ? (
          <img
            src={url}
            alt={item.nome_arquivo ?? ""}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-muted/50" />
        )}
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div
        ref={ref}
        className={cn(base, "flex-col gap-0.5 bg-rose-500/5")}
        title={item.nome_arquivo ?? "PDF"}
      >
        <FileText className={cn("text-rose-500", isSm ? "h-4 w-4" : "h-6 w-6")} />
        {!isSm && <span className="text-[9px] font-medium uppercase text-rose-500/80">PDF</span>}
      </div>
    );
  }

  return (
    <div ref={ref} className={base} title={item.nome_arquivo ?? undefined}>
      <FileText className={cn("text-muted-foreground/60", isSm ? "h-4 w-4" : "h-6 w-6")} />
    </div>
  );
}
