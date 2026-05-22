import { Package, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import UploadFotoProdutoDialog from "@/components/fabrica/UploadFotoProdutoDialog";

interface ProductThumbnailProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  className?: string;
  /** Habilita upload ao clicar. Se informado, o thumbnail vira botão. */
  produtoId?: string;
  produtoNome?: string;
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
  "2xl": "h-40 w-40",
  "3xl": "h-48 w-48",
};

const BUCKET = "fabrica-produto-fotos";
const BUCKET_PATH_MARKER = `/storage/v1/object/public/${BUCKET}/`;

/** Resolve old public URLs to signed URLs for the private bucket */
function useResolvedUrl(src: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!src) { setResolved(null); return; }
    if (src.includes("token=") || !src.includes(BUCKET_PATH_MARKER)) {
      setResolved(src);
      return;
    }
    const filePath = src.substring(src.indexOf(BUCKET_PATH_MARKER) + BUCKET_PATH_MARKER.length);
    supabase.storage.from(BUCKET).createSignedUrl(filePath, 86400).then(({ data }) => {
      setResolved(data?.signedUrl || null);
    });
  }, [src]);

  return resolved;
}

export default function ProductThumbnail({
  src,
  alt = "Produto",
  size = "md",
  className,
  produtoId,
  produtoNome,
}: ProductThumbnailProps) {
  const resolvedSrc = useResolvedUrl(src);
  const [uploadOpen, setUploadOpen] = useState(false);
  const clickable = !!produtoId;

  const openUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setUploadOpen(true);
  };

  const iconSize = size === "sm" ? "h-4 w-4" : size === "md" ? "h-6 w-6" : size === "lg" ? "h-8 w-8" : size === "xl" ? "h-10 w-10" : "h-12 w-12";

  const placeholder = (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? openUpload : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setUploadOpen(true); } } : undefined}
      title={clickable ? "Clique para enviar foto" : undefined}
      className={cn(
        "rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center border border-border/50",
        clickable && "cursor-pointer hover:border-primary hover:bg-muted/60 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary",
        sizeClasses[size],
        className,
      )}
    >
      {clickable ? (
        <>
          <Package className={cn("text-muted-foreground group-hover:hidden", iconSize)} />
          <ImagePlus className={cn("text-primary hidden group-hover:block", iconSize)} />
        </>
      ) : (
        <Package className={cn("text-muted-foreground", iconSize)} />
      )}
    </div>
  );

  const filled = resolvedSrc ? (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? openUpload : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setUploadOpen(true); } } : undefined}
      title={clickable ? "Clique para trocar a foto" : undefined}
      className={cn(
        "relative rounded-lg overflow-hidden border border-border/50 bg-background",
        clickable && "cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary",
        sizeClasses[size],
        className,
      )}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        className="h-full w-full object-cover transition-transform group-hover:scale-110"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          target.parentElement?.classList.add("flex", "items-center", "justify-center", "bg-muted");
        }}
      />
      {clickable && (
        <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
          <ImagePlus className={cn("text-foreground", iconSize)} />
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {filled ?? placeholder}
      {clickable && (
        <UploadFotoProdutoDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          produtoId={produtoId!}
          produtoNome={produtoNome}
        />
      )}
    </>
  );
}
