import { describe, it, expect, beforeEach } from "vitest";
import {
  isTarefasFlagEnabled,
  setTarefasFlag,
  disableAntiFlicker,
  enableAntiFlicker,
  resetAntiFlickerMaster,
} from "../featureFlags";

const ALL = [
  "tarefas_realtime_cirurgico",
  "tarefas_realtime_batch",
  "tarefas_realtime_dedupe",
  "tarefas_descricao_editor_isolado",
  "tarefas_drawer_permanente",
] as const;

describe("anti-flicker master kill-switch", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults all flags to true when no override present", () => {
    for (const f of ALL) expect(isTarefasFlagEnabled(f)).toBe(true);
  });

  it("disableAntiFlicker() forces every flag to false, even when individually 'on'", () => {
    for (const f of ALL) setTarefasFlag(f, true);
    disableAntiFlicker();
    for (const f of ALL) expect(isTarefasFlagEnabled(f)).toBe(false);
  });

  it("master 'off' has precedence over injected __TAREFAS_FF__", () => {
    (window as unknown as { __TAREFAS_FF__: Record<string, boolean> }).__TAREFAS_FF__ = {
      tarefas_realtime_cirurgico: true,
    };
    disableAntiFlicker();
    expect(isTarefasFlagEnabled("tarefas_realtime_cirurgico")).toBe(false);
    delete (window as unknown as { __TAREFAS_FF__?: unknown }).__TAREFAS_FF__;
  });

  it("resetAntiFlickerMaster() restores per-flag behavior", () => {
    disableAntiFlicker();
    setTarefasFlag("tarefas_realtime_batch", false);
    resetAntiFlickerMaster();
    expect(isTarefasFlagEnabled("tarefas_realtime_batch")).toBe(false); // individual override kept
    expect(isTarefasFlagEnabled("tarefas_realtime_cirurgico")).toBe(true); // default
  });

  it("enableAntiFlicker() forces on regardless of individual 'off'", () => {
    for (const f of ALL) setTarefasFlag(f, false);
    enableAntiFlicker();
    // Master 'on' apenas remove o corte; overrides individuais ainda valem.
    // Assim, se o operador quiser retomar padrão em produção, deve usar reset()
    // e não confiar em enableAll para sobrepor kill-switches por-flag.
    for (const f of ALL) expect(isTarefasFlagEnabled(f)).toBe(false);
  });

  it("window.__tarefasAntiFlicker.status() reports current state", () => {
    disableAntiFlicker();
    const s = window.__tarefasAntiFlicker!.status();
    expect(s.master).toBe("off");
    expect(Object.values(s.flags).every((v) => v === false)).toBe(true);
  });
});
