import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

interface MeetingMindMapProps {
  mermaidCode?: string | null;
}

export function MeetingMindMap({ mermaidCode }: MeetingMindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mermaidCode || !containerRef.current) return;

    const renderMermaid = async () => {
      try {
        // Dynamic import from CDN
        const mermaidModule = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs");
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });

        const { svg } = await mermaid.render("meeting-mindmap-" + Date.now(), mermaidCode);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (e: any) {
        console.error("Mermaid render error:", e);
        setError("Erro ao renderizar mapa mental");
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre class="text-xs p-4 rounded-lg overflow-auto" style="background: var(--muted); color: var(--muted-foreground);">${mermaidCode}</pre>`;
        }
      }
    };

    renderMermaid();
  }, [mermaidCode]);

  if (!mermaidCode) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Nenhum mapa mental disponível
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
      <div ref={containerRef} className="overflow-auto max-h-[500px] flex items-center justify-center" />
    </div>
  );
}
