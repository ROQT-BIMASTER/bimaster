import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface Props {
  disabled?: boolean;
  onSubmit: (text: string) => void;
  placeholder?: string;
}

export function CopilotComposer({ disabled, onSubmit, placeholder = "Pergunte algo…" }: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSubmit(t);
    setText("");
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div className="border-t border-border p-3 bg-background">
      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          value={text}
          disabled={disabled}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          className="resize-none min-h-[44px]"
        />
        <Button size="sm" onClick={send} disabled={disabled || text.trim().length === 0}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
