import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetEditingFieldsStore,
  isFieldLocked,
  lockField,
  stashPendingRemote,
  unlockField,
} from "../editingFieldsStore";

describe("editingFieldsStore", () => {
  beforeEach(() => _resetEditingFieldsStore());

  it("lock e unlock alteram o estado observado", () => {
    expect(isFieldLocked("t1", "descricao")).toBe(false);
    lockField("t1", "descricao");
    expect(isFieldLocked("t1", "descricao")).toBe(true);
    unlockField("t1", "descricao");
    expect(isFieldLocked("t1", "descricao")).toBe(false);
  });

  it("unlock devolve o pending stashed mais recente", () => {
    lockField("t1", "titulo");
    stashPendingRemote("t1", "titulo", "v1", 10);
    stashPendingRemote("t1", "titulo", "v2", 20);
    stashPendingRemote("t1", "titulo", "obsoleto", 5); // não sobrescreve
    const r = unlockField("t1", "titulo");
    expect(r.pending?.value).toBe("v2");
  });

  it("unlock sem pending devolve objeto vazio", () => {
    lockField("t1", "titulo");
    const r = unlockField("t1", "titulo");
    expect(r.pending).toBeUndefined();
  });
});
