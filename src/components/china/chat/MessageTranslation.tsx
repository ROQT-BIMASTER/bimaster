/**
 * MessageTranslation — exibe a tradução automática de uma mensagem
 * do chat China–Brasil no idioma do leitor, com a versão original
 * disponível abaixo (toggle).
 *
 * Comportamento:
 *  - Se idioma_origem === idioma do leitor → mostra só o conteúdo original.
 *  - Se a tradução para o idioma do leitor já está cacheada → mostra a
 *    tradução em destaque + linha "Original (XX): …" colapsada.
 *  - Se ainda está traduzindo (sem cache) → mostra original + spinner pequeno.
 */
import { useState } from "react";
import { ChevronDown, Languages, Loader2 } from "lucide-react";
import type { UserLanguage } from "@/hooks/useUserLanguage";
import { LANGUAGE_FLAG } from "@/hooks/useUserLanguage";

interface Props {
  conteudo: string;
  idiomaOrigem: string | null;
  traducoes: Record<string, string> | null;
  leitorIdioma: UserLanguage;
  isTranslating?: boolean;
  renderConteudo: (texto: string) => React.ReactNode;
  isLightBg?: boolean; // ajusta cor do meta para bolhas claras vs escuras
}

export function MessageTranslation({
  conteudo,
  idiomaOrigem,
  traducoes,
  leitorIdioma,
  isTranslating,
  renderConteudo,
  isLightBg,
}: Props) {
  const [showOriginal, setShowOriginal] = useState(false);

  const origem = (idiomaOrigem as UserLanguage | null) ?? null;
  const traduzida = traducoes?.[leitorIdioma]?.trim() || null;

  // Sem tradução necessária ou possível
  if (!origem || origem === leitorIdioma || !traduzida) {
    return (
      <div className="space-y-1">
        <p className="text-sm whitespace-pre-wrap">{renderConteudo(conteudo)}</p>
        {isTranslating && origem && origem !== leitorIdioma && (
          <div className={`flex items-center gap-1 text-[10px] ${isLightBg ? "text-muted-foreground" : "text-white/70"}`}>
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            <span>Traduzindo... 翻译中...</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm whitespace-pre-wrap">{renderConteudo(traduzida)}</p>
      <button
        type="button"
        onClick={() => setShowOriginal((v) => !v)}
        className={`flex items-center gap-1 text-[10px] hover:underline ${
          isLightBg ? "text-muted-foreground" : "text-white/70"
        }`}
      >
        <Languages className="h-2.5 w-2.5" />
        <span>{showOriginal ? "Esconder original" : `Original (${LANGUAGE_FLAG[origem]})`}</span>
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showOriginal ? "rotate-180" : ""}`} />
      </button>
      {showOriginal && (
        <p className={`text-xs whitespace-pre-wrap pl-2 border-l-2 ${
          isLightBg ? "border-border text-muted-foreground" : "border-white/30 text-white/80"
        }`}>
          {renderConteudo(conteudo)}
        </p>
      )}
    </div>
  );
}
