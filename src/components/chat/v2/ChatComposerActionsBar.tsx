/**
 * ChatComposerActionsBar — barra unificada de ações para o composer do chat.
 *
 * Apresenta sempre os 5 botões padrão (anexar arquivo, câmera, solicitar
 * aprovação, chamar atenção, emojis) para garantir paridade visual e
 * funcional entre as abas Pessoas, Submissões, Briefings e Projetos.
 *
 * Cada handler é definido pelo painel hospedeiro — em Pessoas a aprovação
 * abre o NovaAprovacaoDialog direto na conversa; nos demais escopos abre
 * uma conversa de Pessoas vinculada ao item via rpc_get_or_create_conversa_vinculada.
 */
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Paperclip, Smile, ClipboardCheck, AlertOctagon } from "lucide-react";
import { CameraCaptureButton } from "./CameraCaptureButton";
import { EmojiPicker } from "./EmojiPicker";
import { useRef } from "react";

interface Props {
  onAttachFile: (files: FileList) => void;
  onCameraCapture: (file: File) => void;
  onRequestApproval: () => void;
  onUrgentAlert: () => void;
  onEmojiPick: (emoji: string) => void;
  disabled?: boolean;
  /** Tooltip do botão de aprovação. */
  approvalTooltip?: string;
  /** Tooltip do botão de chamar atenção. */
  urgentTooltip?: string;
  /** Filtro de tipos aceitos no anexar (default: tudo). */
  accept?: string;
  /** Tamanho dos botões (default sm). */
  size?: "sm" | "md";
  className?: string;
}

export function ChatComposerActionsBar({
  onAttachFile,
  onCameraCapture,
  onRequestApproval,
  onUrgentAlert,
  onEmojiPick,
  disabled,
  approvalTooltip = "Solicitar aprovação",
  urgentTooltip = "Chamar atenção (mensagem urgente)",
  accept,
  size = "sm",
  className,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const btn = size === "md" ? "h-9 w-9" : "h-8 w-8";
  const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onAttachFile(e.target.files);
          }
          e.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={`${btn} shrink-0`}
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        title="Anexar arquivo"
        aria-label="Anexar arquivo"
      >
        <Paperclip className={icon} />
      </Button>

      <CameraCaptureButton onCapture={onCameraCapture} disabled={disabled} />

      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={`${btn} shrink-0`}
        onClick={onRequestApproval}
        disabled={disabled}
        title={approvalTooltip}
        aria-label={approvalTooltip}
      >
        <ClipboardCheck className={icon} />
      </Button>

      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={`${btn} shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive`}
        onClick={onUrgentAlert}
        disabled={disabled}
        title={urgentTooltip}
        aria-label={urgentTooltip}
      >
        <AlertOctagon className={icon} />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={`${btn} shrink-0`}
            disabled={disabled}
            title="Inserir emoji"
            aria-label="Inserir emoji"
          >
            <Smile className={icon} />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-auto p-0">
          <EmojiPicker onPick={onEmojiPick} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
