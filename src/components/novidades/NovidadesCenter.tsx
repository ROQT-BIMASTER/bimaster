import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useNovidadesPublicadas, useNovidadesVistas, useMarcarNovidadesVistas } from "@/hooks/useNovidades";
import { NOVIDADES_OPEN_EVENT } from "@/lib/novidades/abrirCentralNovidades";
import { NovidadesDialog } from "./NovidadesDialog";
import { NovidadesHistorico } from "./NovidadesHistorico";

/**
 * Central de Novidades no cabeçalho: abre automaticamente o modal com as
 * novidades ainda não vistas e permite reabrir o histórico completo.
 */
export function NovidadesCenter() {
  const { session } = useAuth();
  const { permissionsReady } = usePermissions();
  const { data: novidades = [] } = useNovidadesPublicadas();
  const { data: vistas = [], isSuccess: vistasOk } = useNovidadesVistas();
  const marcar = useMarcarNovidadesVistas();

  const [autoOpen, setAutoOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [dispensado, setDispensado] = useState(false);

  const naoVistas = useMemo(
    () => novidades.filter((n) => !vistas.includes(n.id)),
    [novidades, vistas],
  );

  useEffect(() => {
    if (!session || !permissionsReady || !vistasOk || dispensado) return;
    if (naoVistas.length > 0) setAutoOpen(true);
  }, [session, permissionsReady, vistasOk, naoVistas.length, dispensado]);

  // Permite abrir a Central a partir de outras telas (ex.: boas-vindas do Calendário).
  useEffect(() => {
    const abrir = () => setHistoricoOpen(true);
    window.addEventListener(NOVIDADES_OPEN_EVENT, abrir);
    return () => window.removeEventListener(NOVIDADES_OPEN_EVENT, abrir);
  }, []);


  const concluir = (ids: string[]) => {
    setDispensado(true);
    marcar.mutate(ids);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setHistoricoOpen(true)}
        className="relative inline-flex items-center justify-center rounded-md border border-border bg-muted/50 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Novidades do sistema"
        title="Novidades do sistema"
      >
        <Sparkles className="h-4 w-4" />
        {naoVistas.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
        )}
      </button>

      <NovidadesDialog
        open={autoOpen}
        onOpenChange={setAutoOpen}
        items={naoVistas}
        onConcluir={concluir}
      />
      <NovidadesHistorico open={historicoOpen} onOpenChange={setHistoricoOpen} items={novidades} />
    </>
  );
}
