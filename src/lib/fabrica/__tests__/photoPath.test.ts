import { describe, it, expect } from "vitest";
import {
  buildFabricaPhotoPath,
  normalizeExt,
  extractPathFromUrl,
  FABRICA_FOTOS_BUCKET,
} from "../photoPath";

describe("buildFabricaPhotoPath", () => {
  const PRODUTO = "11111111-1111-1111-1111-111111111111";

  it("nunca devolve barra inicial", () => {
    const p = buildFabricaPhotoPath({ produtoId: PRODUTO, fileName: "foto.JPG", now: 1 });
    expect(p.startsWith("/")).toBe(false);
  });

  it("força produtoId UUID válido como pasta; senão usa temp", () => {
    expect(buildFabricaPhotoPath({ produtoId: "abc", fileName: "x.png", now: 1 }))
      .toBe("temp/1-x.png");
    expect(buildFabricaPhotoPath({ produtoId: PRODUTO, fileName: "x.png", now: 1 }))
      .toBe(`${PRODUTO}/1-x.png`);
  });

  it("normaliza extensão (jpeg → jpg, lowercase, fallback jpg)", () => {
    expect(normalizeExt("JPEG")).toBe("jpg");
    expect(normalizeExt(".PNG")).toBe("png");
    expect(normalizeExt("exe")).toBe("jpg");
    expect(normalizeExt("")).toBe("jpg");
  });

  it("slugifica nome (acentos, espaços, símbolos)", () => {
    const p = buildFabricaPhotoPath({ produtoId: PRODUTO, fileName: "Açaí Súper #1.PNG", now: 99 });
    expect(p).toBe(`${PRODUTO}/99-acai-super-1.png`);
  });

  it("bloqueia path traversal e barras no nome", () => {
    const p = buildFabricaPhotoPath({ produtoId: PRODUTO, fileName: "../../etc/passwd.png", now: 7 });
    expect(p).not.toContain("..");
    expect(p.split("/").length).toBe(2);
  });

  it("nunca produz barras duplas", () => {
    const p = buildFabricaPhotoPath({ produtoId: PRODUTO, fileName: "a.png", now: 1 });
    expect(p).not.toMatch(/\/{2,}/);
  });
});

describe("extractPathFromUrl", () => {
  it("extrai path de URL pública", () => {
    const url = `https://x.supabase.co/storage/v1/object/public/${FABRICA_FOTOS_BUCKET}/abc/123.jpg`;
    expect(extractPathFromUrl(url)).toBe("abc/123.jpg");
  });
  it("extrai path de URL assinada com query", () => {
    const url = `https://x.supabase.co/storage/v1/object/sign/${FABRICA_FOTOS_BUCKET}/abc/123.jpg?token=xyz`;
    expect(extractPathFromUrl(url)).toBe("abc/123.jpg");
  });
  it("retorna null para URLs externas", () => {
    expect(extractPathFromUrl("https://cdn.example.com/foto.jpg")).toBe(null);
  });
});
