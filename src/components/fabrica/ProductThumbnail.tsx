import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function ProductThumbnail({ 
  src, 
  alt = "Produto", 
  size = "md",
  className 
}: ProductThumbnailProps) {
  if (!src) {
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
        src={src} 
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
