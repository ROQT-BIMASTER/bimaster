import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * Renders CRM message content. Many channels (WhatsApp Cloud API, Blip, etc.)
 * persist the raw provider payload as a JSON string. We try to parse it and
 * present a human-readable view: text, buttons, lists, replies, media.
 */
export function MessageBody({ conteudo, tipo }: { conteudo: string | null | undefined; tipo: string | null | undefined }) {
  const [raw, setRaw] = useState(false);

  if (conteudo == null || conteudo === "") {
    return <div className="italic opacity-70">[{tipo ?? "vazio"}]</div>;
  }

  const trimmed = String(conteudo).trim();
  const looksJson = (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));

  if (!looksJson) {
    return <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(trimmed) }} />;
  }

  let parsed: any;
  try { parsed = JSON.parse(trimmed); }
  catch { return <div className="whitespace-pre-wrap break-words">{trimmed}</div>; }

  return (
    <div className="space-y-1.5">
      {renderParsed(parsed)}
      <button
        type="button"
        onClick={() => setRaw(v => !v)}
        className="inline-flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100"
      >
        {raw ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        {raw ? "Ocultar payload" : "Ver payload técnico"}
      </button>
      {raw && (
        <pre className="text-[10px] bg-black/20 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )}
    </div>
  );
}

function renderParsed(p: any): JSX.Element {
  // Reply context (Blip): { replied: {...}, inReplyTo: {...} }
  if (p?.replied) {
    return (
      <div className="space-y-1.5">
        <div className="border-l-2 border-primary/40 pl-2 opacity-80">
          <div className="text-[10px] uppercase tracking-wide opacity-70">Resposta</div>
          {renderParsed(p.replied)}
        </div>
        {p.inReplyTo && (
          <div className="text-[10px] opacity-60">↳ referente a mensagem anterior</div>
        )}
      </div>
    );
  }

  // Simple text/plain
  if (p?.type === "text/plain" && typeof p.value === "string") {
    return <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(p.value) }} />;
  }
  if (typeof p?.text === "string" && !p?.type) {
    return <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(p.text) }} />;
  }

  // WhatsApp interactive (Cloud API / Blip wrapper)
  const interactive = p?.interactive ?? (p?.type === "interactive" ? p : null);
  if (interactive) {
    const body = interactive?.body?.text ?? interactive?.body;
    const footer = interactive?.footer?.text ?? interactive?.footer;
    const header = interactive?.header?.text;
    const action = interactive?.action ?? {};
    const buttons: any[] = action?.buttons ?? [];
    const sections: any[] = action?.sections ?? [];
    return (
      <div className="space-y-1.5">
        {header && <div className="font-semibold" dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(String(header)) }} />}
        {body && <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(String(body)) }} />}
        {buttons.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {buttons.map((b, i) => (
              <span key={i} className="inline-flex items-center rounded border border-current/30 px-1.5 py-0.5 text-[10px] opacity-90">
                {b?.reply?.title ?? b?.title ?? b?.text ?? "Botão"}
              </span>
            ))}
          </div>
        )}
        {sections.length > 0 && (
          <div className="space-y-1 pt-1">
            {sections.map((s, i) => (
              <div key={i} className="space-y-0.5">
                {s?.title && <div className="text-[10px] font-semibold opacity-80">{s.title}</div>}
                <div className="flex flex-wrap gap-1">
                  {(s?.rows ?? []).map((r: any, j: number) => (
                    <span key={j} className="inline-flex items-center rounded border border-current/30 px-1.5 py-0.5 text-[10px]">
                      {r?.title ?? r?.id}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {footer && <div className="text-[10px] opacity-70 italic">{String(footer)}</div>}
      </div>
    );
  }

  // Media (image/audio/video/document)
  const mediaUrl = p?.url ?? p?.link ?? p?.uri ?? p?.image?.link ?? p?.video?.link ?? p?.audio?.link ?? p?.document?.link;
  const mime = p?.mimeType ?? p?.mime_type ?? p?.type;
  if (mediaUrl && typeof mediaUrl === "string") {
    if (typeof mime === "string" && mime.startsWith("image/")) {
      return <img src={mediaUrl} alt="" className="rounded max-h-64 max-w-full" loading="lazy" />;
    }
    return <a href={mediaUrl} target="_blank" rel="noreferrer" className="underline">Anexo ({mime ?? "arquivo"})</a>;
  }

  // Location
  if (p?.location || (p?.latitude && p?.longitude)) {
    const loc = p.location ?? p;
    return <div className="opacity-90">📍 Localização: {loc.latitude}, {loc.longitude}{loc.name ? ` · ${loc.name}` : ""}</div>;
  }

  // Fallback: show key fields
  return <div className="opacity-80 italic text-[11px]">Mensagem do tipo "{p?.type ?? "desconhecido"}" — clique em "Ver payload técnico" para detalhes.</div>;
}

function sanitizeBasicHtml(s: string): string {
  // Permite apenas <b>, <strong>, <i>, <em>, <br>. Resto é escapado.
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/&lt;(\/?)(b|strong|i|em|br)\s*\/?&gt;/gi, "<$1$2>")
    .replace(/\n/g, "<br>");
}
