import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regressão: deep links de OC, Containers e telas China consolidadas no
 * Inbox do Comprador devem continuar resolvíveis em src/App.tsx, mesmo
 * tendo sido removidos do menu lateral. Qualquer remoção acidental
 * dessas rotas (ou da página por trás delas) reabre 404 para bookmarks,
 * notificações e links em e-mails antigos.
 */

const APP_TSX = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");
const SIDEBAR_TSX = readFileSync(
  resolve(__dirname, "../../components/dashboard/AppSidebar.tsx"),
  "utf8",
);

type DeepLink = {
  /** path em <Route path="..."> */
  route: string;
  /** página esperada (componente lazy) */
  page: string;
  /** arquivo em src/pages que precisa existir */
  file: string;
  /** descrição humana */
  label: string;
};

const DEEP_LINKS: DeepLink[] = [
  // Inbox canônico
  {
    route: "/dashboard/compras-internacionais/inbox",
    page: "CompradorInbox",
    file: "src/pages/CompradorInbox.tsx",
    label: "Inbox do Comprador (canônico)",
  },
  // OC — listagem e detalhe (deep link de e-mail / Asana)
  {
    route: "/dashboard/fabrica-china/ordens",
    page: "ChinaOrdens",
    file: "src/pages/ChinaOrdens.tsx",
    label: "OC – listagem (legado preservado)",
  },
  {
    route: "/dashboard/fabrica-china/ordens/:id",
    page: "ChinaOrdemDetalhe",
    file: "src/pages/ChinaOrdemDetalhe.tsx",
    label: "OC – detalhe por id (deep link)",
  },
  // Recebimentos / divergências
  {
    route: "/dashboard/fabrica-china/recebimentos-oc",
    page: "ChinaMonitorRecebimentosOC",
    file: "src/pages/ChinaMonitorRecebimentosOC.tsx",
    label: "Monitor de recebimentos OC",
  },
  {
    route: "/dashboard/fabrica-china/recebimentos/divergencias",
    page: "ChinaDivergenciasRecebimento",
    file: "src/pages/ChinaDivergenciasRecebimento.tsx",
    label: "Divergências de recebimento",
  },
  // Pátio e Containers (agora dentro do Inbox, mas mantemos rota legada)
  {
    route: "/dashboard/fabrica-china/patio-embarque",
    page: "ChinaPatioProntoEmbarque",
    file: "src/pages/ChinaPatioProntoEmbarque.tsx",
    label: "Pátio pronto para embarque (legado)",
  },
  {
    route: "/dashboard/fabrica-china/torre-containers",
    page: "ChinaTorreContainers",
    file: "src/pages/ChinaTorreContainers.tsx",
    label: "Torre de containers (legado)",
  },
  // Submissões / produto / checklist
  {
    route: "/dashboard/fabrica-china/submissao/:id",
    page: "ChinaSubmissaoDetalhe",
    file: "src/pages/ChinaSubmissaoDetalhe.tsx",
    label: "Submissão China – detalhe",
  },
  {
    route: "/dashboard/fabrica-china/produto/:id",
    page: "ChinaFichaProduto",
    file: "src/pages/ChinaFichaProduto.tsx",
    label: "Ficha de produto China",
  },
  {
    route: "/dashboard/fabrica-china/produto/:id/checklist",
    page: "ChinaProdutoChecklist",
    file: "src/pages/ChinaProdutoChecklist.tsx",
    label: "Checklist do produto China",
  },
  // Compras Nacionais (realocada para Fábrica)
  {
    route: "/dashboard/compras-nacionais",
    page: "ComprasNacionais",
    file: "src/pages/ComprasNacionais.tsx",
    label: "Compras Nacionais",
  },
];

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("Compras / China — deep links preservados", () => {
  it.each(DEEP_LINKS)(
    "rota $route ($label) está registrada em App.tsx",
    ({ route }) => {
      const re = new RegExp(`<Route\\s+path="${escapeRegex(route)}"`);
      expect(
        re.test(APP_TSX),
        `Rota "${route}" não encontrada em App.tsx — deep link quebrado`,
      ).toBe(true);
    },
  );

  it.each(DEEP_LINKS)(
    "rota $route renderiza o componente $page",
    ({ route, page }) => {
      // Captura o trecho da Route até seu fechamento e checa o componente.
      const re = new RegExp(
        `<Route\\s+path="${escapeRegex(route)}"[\\s\\S]*?<${page}\\b`,
      );
      expect(
        re.test(APP_TSX),
        `Rota "${route}" não está apontando para <${page} />`,
      ).toBe(true);
    },
  );

  it.each(DEEP_LINKS)(
    "componente $page existe em $file",
    ({ file }) => {
      const full = resolve(__dirname, "../../../", file);
      expect(existsSync(full), `Arquivo de página ausente: ${file}`).toBe(true);
    },
  );

  it("redirect /compras-internacionais → /compras-internacionais/inbox está ativo", () => {
    expect(
      /<Route\s+path="\/dashboard\/compras-internacionais"\s+element=\{<Navigate\s+to="\/dashboard\/compras-internacionais\/inbox"\s+replace\s*\/>\}/.test(
        APP_TSX,
      ),
      "Navigate de /compras-internacionais para /inbox foi removido",
    ).toBe(true);
  });
});

/**
 * Itens removidos do menu lateral. O teste garante que continuam fora
 * da sidebar (anti-regressão) — qualquer reintrodução acidental quebra
 * a consolidação no Inbox do Comprador.
 */
const REMOVED_FROM_SIDEBAR: { path: string; label: string }[] = [
  { path: "/dashboard/fabrica-china/ordens", label: "Ordens de Compra" },
  { path: "/dashboard/fabrica-china/recebimentos-oc", label: "Monitor Recebimentos OC" },
  { path: "/dashboard/fabrica-china/recebimentos/divergencias", label: "Divergências" },
  { path: "/dashboard/fabrica-china/patio-embarque", label: "Pátio pronto p/ embarque" },
  { path: "/dashboard/fabrica-china/torre-containers", label: "Torre de containers" },
];

describe("Sidebar China — itens consolidados no Inbox não devem reaparecer", () => {
  it.each(REMOVED_FROM_SIDEBAR)(
    "menu lateral não contém link para $path ($label)",
    ({ path }) => {
      const re = new RegExp(`MenuItemLink[\\s\\S]*?to=["']${escapeRegex(path)}["']`);
      expect(
        re.test(SIDEBAR_TSX),
        `MenuItemLink para "${path}" voltou ao sidebar — funcionalidade já vive no Inbox do Comprador`,
      ).toBe(false);
    },
  );

  it("Inbox do Comprador continua visível no sidebar", () => {
    expect(
      /MenuItemLink[\s\S]*?to="\/dashboard\/compras-internacionais\/inbox"/.test(
        SIDEBAR_TSX,
      ),
    ).toBe(true);
  });

  it("Compras Nacionais aparece no grupo Fábrica", () => {
    expect(
      /MenuItemLink[\s\S]*?to="\/dashboard\/compras-nacionais"[\s\S]*?colorKey="fabrica"/.test(
        SIDEBAR_TSX,
      ),
      "Compras Nacionais não está mais no grupo Fábrica",
    ).toBe(true);
  });
});
