import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProductThumbnailProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
};

const BUCKET = "fabrica-produto-fotos";
const BUCKET_PATH_MARKER = `/storage/v1/object/public/${BUCKET}/`;

/** Resolve old public URLs to signed URLs for the private bucket */
function useResolvedUrl(src: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!src) { setResolved(null); return; }
    // Already a signed URL or external URL
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
  className 
}: ProductThumbnailProps) {
  const resolvedSrc = useResolvedUrl(src);

  if (!resolvedSrc) {
    return (
      <div 
        className={cn(
          "rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center border border-border/50",
          sizeClasses[size],
          className
        )}
      >
        <Package className={cn(
          "text-muted-foreground",
          size === "sm" ? "h-4 w-4" : size === "md" ? "h-5 w-5" : size === "lg" ? "h-6 w-6" : "h-8 w-8"
        )} />
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg overflow-hidden border border-border/50 bg-background",
      sizeClasses[size],
      className
    )}>
      <img 
        src={resolvedSrc} 
        alt={alt}
        className="h-full w-full object-cover transition-transform hover:scale-110"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          target.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-muted');
        }}
      />
    </div>
  );
}
