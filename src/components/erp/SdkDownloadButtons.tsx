import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const SDK_VERSION = "3.3.1";

type SdkLang = "ts" | "js" | "py";

const SDK_CONFIG: Record<SdkLang, { url: string; filename: string; label: string }> = {
  ts: { url: "/sdk/bimaster-sdk.ts.template", filename: "huggs-erp-sdk.ts", label: "TypeScript" },
  js: { url: "/sdk/bimaster-sdk.js.template", filename: "huggs-erp-sdk.js", label: "JavaScript" },
  py: { url: "/sdk/bimaster-sdk.py.template", filename: "huggs_erp_sdk.py", label: "Python" },
};

function sdkHeader(lang: SdkLang): string {
  const date = new Date().toISOString().slice(0, 10);
  const comment = lang === "py" ? "#" : "//";
  const langName = lang === "py" ? "Python" : lang === "ts" ? "TypeScript" : "JavaScript";
  return [
    `${comment} BiMaster ERP Integration SDK — ${langName}`,
    `${comment} Versão do SDK: ${SDK_VERSION}`,
    `${comment} Gerado em: ${date}`,
    `${comment} Cobertura: fluxos financeiros principais (Contas a Pagar/Receber, Clientes, Fornecedores,`,
    `${comment}            Empresas, Boletos, Webhooks). Demais módulos disponíveis via OpenAPI.`,
  ].join("\n");
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SdkDownloadButtons() {
  const [downloading, setDownloading] = useState<SdkLang | null>(null);

  const handleDownload = async (lang: SdkLang) => {
    const cfg = SDK_CONFIG[lang];
    setDownloading(lang);
    try {
      const resp = await fetch(cfg.url, { cache: "no-cache" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = await resp.text();
      const content = sdkHeader(lang) + "\n" + body;
      downloadFile(content, cfg.filename);
    } catch (err) {
      logger.error("Falha ao baixar SDK", { lang, err });
      toast.error(`Falha ao baixar SDK ${cfg.label}. Tente novamente.`);
    } finally {
      setDownloading(null);
    }
  };

  const renderButton = (lang: SdkLang) => {
    const cfg = SDK_CONFIG[lang];
    const isThis = downloading === lang;
    return (
      <Button
        key={lang}
        variant="outline"
        size="sm"
        disabled={downloading !== null}
        onClick={() => handleDownload(lang)}
      >
        {isThis ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        {cfg.label}
      </Button>
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(SDK_CONFIG) as SdkLang[]).map(renderButton)}
    </div>
  );
}
