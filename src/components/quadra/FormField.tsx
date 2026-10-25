import { Label } from "@/components/ui/label";

interface Props {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/** Campo de formulário padronizado do módulo Quadra: rótulo, controle e mensagem de erro. */
export function FormField({ label, htmlFor, error, children, className }: Props) {
  return (
    <div className={className ?? "space-y-1.5"}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
