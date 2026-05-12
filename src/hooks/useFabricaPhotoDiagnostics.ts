import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FABRICA_FOTOS_BUCKET } from "@/lib/fabrica/photoPath";

export type ProbeStatus = "idle" | "running" | "ok" | "fail";

export interface PermissionProbe {
  action: "select" | "insert" | "update" | "delete";
  status: ProbeStatus;
  message?: string;
}

const initialProbes: PermissionProbe[] = [
  { action: "select", status: "idle" },
  { action: "insert", status: "idle" },
  { action: "update", status: "idle" },
  { action: "delete", status: "idle" },
];

const PROBE_PREFIX = "_diagnostico";

/**
 * Executa um upload/atualização/leitura/exclusão de prova num path
 * `_diagnostico/<uid>/<ts>.txt` para validar policies em tempo real.
 */
export function useFabricaPhotoDiagnostics() {
  const [probes, setProbes] = useState<PermissionProbe[]>(initialProbes);
  const [running, setRunning] = useState(false);

  const update = (action: PermissionProbe["action"], patch: Partial<PermissionProbe>) =>
    setProbes((curr) => curr.map((p) => (p.action === action ? { ...p, ...patch } : p)));

  const run = useCallback(async () => {
    setRunning(true);
    setProbes(initialProbes.map((p) => ({ ...p, status: "running" })));

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      const msg = "Usuário não autenticado";
      setProbes(initialProbes.map((p) => ({ ...p, status: "fail", message: msg })));
      setRunning(false);
      return;
    }

    const path = `${PROBE_PREFIX}/${uid}/${Date.now()}-probe.txt`;
    const blob = new Blob(["probe"], { type: "text/plain" });

    // INSERT
    const ins = await supabase.storage.from(FABRICA_FOTOS_BUCKET).upload(path, blob, { upsert: false });
    if (ins.error) {
      update("insert", { status: "fail", message: ins.error.message });
      update("update", { status: "fail", message: "Pulado (insert falhou)" });
      update("select", { status: "fail", message: "Pulado (insert falhou)" });
      update("delete", { status: "fail", message: "Pulado (insert falhou)" });
      setRunning(false);
      return;
    }
    update("insert", { status: "ok", message: "Upload permitido" });

    // SELECT (signed URL como prova)
    const sel = await supabase.storage.from(FABRICA_FOTOS_BUCKET).createSignedUrl(path, 60);
    if (sel.error) update("select", { status: "fail", message: sel.error.message });
    else update("select", { status: "ok", message: "Leitura permitida" });

    // UPDATE
    const upBlob = new Blob(["probe-v2"], { type: "text/plain" });
    const upd = await supabase.storage
      .from(FABRICA_FOTOS_BUCKET)
      .update(path, upBlob, { upsert: true });
    if (upd.error) update("update", { status: "fail", message: upd.error.message });
    else update("update", { status: "ok", message: "Atualização permitida" });

    // DELETE
    const del = await supabase.storage.from(FABRICA_FOTOS_BUCKET).remove([path]);
    if (del.error) update("delete", { status: "fail", message: del.error.message });
    else update("delete", { status: "ok", message: "Exclusão permitida" });

    setRunning(false);
  }, []);

  return { probes, running, run };
}
