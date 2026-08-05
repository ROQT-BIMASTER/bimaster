import { useProjetoCapaUrl } from "@/hooks/useProjetoCapaUrl";
import { cn } from "@/lib/utils";

interface ProjetoAvatarProps {
  nome: string;
  cor?: string | null;
  imagemUrl?: string | null;
  className?: string;
  textClassName?: string;
}

/**
 * Avatar do projeto: mostra a foto quando existir,
 * senão faz fallback para a cor do projeto + inicial do nome.
 */
export function ProjetoAvatar({
  nome,
  cor,
  imagemUrl,
  className,
  textClassName,
}: ProjetoAvatarProps) {
  const resolved = useProjetoCapaUrl(imagemUrl);
  const inicial = (nome || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
        className,
      )}
      style={resolved ? undefined : { backgroundColor: cor || "hsl(var(--primary))" }}
      data-testid="projeto-avatar"
    >
      {resolved ? (
        <img
          src={resolved}
          alt={`Foto do projeto ${nome}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className={cn("text-white font-bold text-xs", textClassName)}>
          {inicial}
        </span>
      )}
    </div>
  );
}
