import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RrTasksBoardView } from "@/components/rr-tasks/RrTasksBoardView";

/**
 * Rota `/dashboard/rr-tasks` — wrapper fino que delega para `RrTasksBoardView`.
 * O mesmo componente é embutido em `ProjetoDetalhe` quando o projeto é o
 * âncora `tipo='rr_tasks'`; nesse caso o botão "Voltar" não aparece (só vive
 * aqui no wrapper da rota standalone).
 */
export default function RrTasksBoard() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="px-4 sm:px-6 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/dashboard");
          }}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
      <RrTasksBoardView />
    </div>
  );
}
