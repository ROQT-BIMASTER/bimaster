import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface MentionableUser {
  user_id: string;
  nome: string | null;
  avatar_url?: string | null;
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">;

interface Props extends TextareaProps {
  value: string;
  onChange: (v: string) => void;
  members: MentionableUser[];
  /** Quando o usuário pressiona Enter sem Shift e o picker está fechado. */
  onSubmitShortcut?: () => void;
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea(
  { value, onChange, members, onSubmitShortcut, onKeyDown, className, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Posição (no value) do '@' que abriu o picker
  const triggerStartRef = useRef<number | null>(null);

  const candidates = useMemo(() => {
    const list = members.filter((m) => m.nome && m.nome.trim().length > 0);
    if (!query) return list.slice(0, 8);
    const q = normalize(query);
    return list
      .filter((m) => {
        const n = normalize(m.nome!);
        return n.includes(q) || n.split(/\s+/).some((p) => p.startsWith(q));
      })
      .slice(0, 8);
  }, [members, query]);

  useEffect(() => {
    if (active >= candidates.length) setActive(0);
  }, [candidates.length, active]);

  const closePicker = useCallback(() => {
    setOpen(false);
    setQuery("");
    triggerStartRef.current = null;
  }, []);

  const detectTrigger = useCallback((text: string, caret: number) => {
    // Encontra o '@' mais próximo à esquerda do cursor que esteja em
    // início de string ou precedido por espaço/quebra de linha, e cuja
    // sequência até o cursor não contenha espaço.
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "@") {
        const prev = i === 0 ? " " : text[i - 1];
        if (prev === " " || prev === "\n" || prev === "\t") {
          const between = text.slice(i + 1, caret);
          if (!/[\s]/.test(between)) {
            return { start: i, query: between };
          }
        }
        return null;
      }
      if (ch === " " || ch === "\n" || ch === "\t") return null;
      i--;
    }
    return null;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onChange(text);
    const caret = e.target.selectionStart ?? text.length;
    const trig = detectTrigger(text, caret);
    if (trig) {
      triggerStartRef.current = trig.start;
      setQuery(trig.query);
      setOpen(true);
      setActive(0);
    } else {
      closePicker();
    }
  };

  const insertMention = (m: MentionableUser) => {
    const ta = innerRef.current;
    const start = triggerStartRef.current;
    if (!ta || start == null) return;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(caret);
    const mentionText = `@${(m.nome ?? "").trim()} `;
    const next = `${before}${mentionText}${after}`;
    onChange(next);
    closePicker();
    requestAnimationFrame(() => {
      const pos = (before + mentionText).length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && candidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % candidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + candidates.length) % candidates.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(candidates[active]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closePicker();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !open && onSubmitShortcut) {
      e.preventDefault();
      onSubmitShortcut();
      return;
    }
    onKeyDown?.(e);
  };

  // Recalcula o trigger ao mover o cursor sem digitar (clique, setas).
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const caret = ta.selectionStart ?? value.length;
    const trig = detectTrigger(value, caret);
    if (trig) {
      triggerStartRef.current = trig.start;
      setQuery(trig.query);
      setOpen(true);
    } else if (open) {
      closePicker();
    }
  };

  return (
    <div className="relative">
      <Textarea
        {...rest}
        ref={innerRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onBlur={() => {
          // dá tempo do click no item ser processado
          setTimeout(closePicker, 120);
        }}
        className={className}
      />
      {open && candidates.length > 0 && (
        <div
          className="absolute z-50 bottom-full left-2 mb-1 w-64 max-h-60 overflow-auto rounded-md border border-border bg-popover shadow-lg p-1"
          role="listbox"
        >
          {candidates.map((m, i) => (
            <button
              key={m.user_id}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(ev) => {
                // evita blur antes do click
                ev.preventDefault();
                insertMention(m);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left text-xs",
                i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
              )}
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={m.avatar_url ?? undefined} />
                <AvatarFallback className="text-[9px]">{initials(m.nome)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{m.nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
