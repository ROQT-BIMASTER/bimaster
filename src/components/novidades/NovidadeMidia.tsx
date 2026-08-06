import { useEffect, useState } from "react";
import { assinarMidiaNovidade } from "@/hooks/useNovidades";

interface Props {
  path: string;
  tipo: "imagem" | "video";
  titulo: string;
  className?: string;
}

/** Renderiza a mídia de uma novidade resolvendo a URL assinada da área privada. */
export function NovidadeMidia({ path, tipo, titulo, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    assinarMidiaNovidade(path).then((u) => {
      if (ativo) setUrl(u);
    });
    return () => {
      ativo = false;
    };
  }, [path]);

  if (!url) {
    return <div className={`h-48 w-full animate-pulse rounded-lg bg-muted ${className ?? ""}`} />;
  }

  if (tipo === "video") {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className={`w-full rounded-lg border border-border bg-muted ${className ?? ""}`}
      />
    );
  }

  return (
    <img
      src={url}
      alt={titulo}
      loading="lazy"
      className={`w-full rounded-lg border border-border object-contain bg-muted ${className ?? ""}`}
    />
  );
}
