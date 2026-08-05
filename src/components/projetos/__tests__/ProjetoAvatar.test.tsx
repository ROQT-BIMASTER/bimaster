import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjetoAvatar } from "../ProjetoAvatar";
import { validateProjetoFoto } from "@/lib/projetos/projetoFoto";

vi.mock("@/hooks/useProjetoCapaUrl", () => ({
  PROJETO_CAPAS_BUCKET: "projeto-capas",
  useProjetoCapaUrl: (v?: string | null) =>
    v ? "https://cdn.test/foto.png" : undefined,
}));

function makeFile(name: string, bytes: number[], type: string, size?: number) {
  const file = new File([new Uint8Array(bytes)], name, { type });
  if (size) Object.defineProperty(file, "size", { value: size });
  // jsdom não implementa Blob.arrayBuffer de forma consistente
  Object.defineProperty(file, "slice", {
    value: () => ({
      arrayBuffer: async () => new Uint8Array(bytes).buffer,
    }),
  });
  return file;
}

describe("ProjetoAvatar", () => {
  it("mostra a inicial e a cor quando não há foto", () => {
    render(<ProjetoAvatar nome="Redes Sociais" cor="#ec4899" imagemUrl={null} />);
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("mostra a foto quando existir", () => {
    render(<ProjetoAvatar nome="Redes Sociais" cor="#ec4899" imagemUrl="id/capa.png" />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toBe("https://cdn.test/foto.png");
    expect(screen.queryByText("R")).toBeNull();
  });
});

describe("validateProjetoFoto", () => {
  it("aceita PNG válido", async () => {
    const res = await validateProjetoFoto(
      makeFile("capa.png", [0x89, 0x50, 0x4e, 0x47], "image/png"),
    );
    expect(res.valid).toBe(true);
    expect(res.ext).toBe("png");
  });

  it("rejeita extensão não suportada", async () => {
    const res = await validateProjetoFoto(makeFile("capa.gif", [0x47], "image/gif"));
    expect(res.valid).toBe(false);
  });

  it("rejeita arquivo acima de 5 MB", async () => {
    const res = await validateProjetoFoto(
      makeFile("capa.png", [0x89, 0x50, 0x4e, 0x47], "image/png", 6 * 1024 * 1024),
    );
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/5 MB/);
  });

  it("rejeita conteúdo que não corresponde à extensão", async () => {
    const res = await validateProjetoFoto(
      makeFile("capa.png", [0x00, 0x01, 0x02, 0x03], "image/png"),
    );
    expect(res.valid).toBe(false);
  });
});
