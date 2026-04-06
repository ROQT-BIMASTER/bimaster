import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProjetoBackButtonProps {
  fallbackTo?: string;
  label?: string;
  className?: string;
}

export function ProjetoBackButton({
  fallbackTo = "/dashboard/projetos",
  label = "Voltar",
  className,
}: ProjetoBackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackTo);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={cn("gap-1.5", className)}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
