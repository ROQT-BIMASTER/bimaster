import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Boxes } from "lucide-react";

interface Props {
  onClick: () => void;
}

export function EstoqueCopilotFAB({ onClick }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmd = e.ctrlKey || e.metaKey;
      if (isCmd && e.key.toLowerCase() === "i") {
        e.preventDefault();
        onClick();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClick]);

  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg gap-2 h-12 px-5"
      title="Copiloto de Estoque (Ctrl/Cmd+I)"
    >
      <Boxes className="h-5 w-5" />
      <span className="hidden sm:inline">Copiloto de Estoque</span>
    </Button>
  );
}
