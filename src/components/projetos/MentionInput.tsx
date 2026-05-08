import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface MentionUser {
  id: string;
  nome: string;
  avatar_url: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string, mentionIds: string[]) => void;
  users: MentionUser[];
  placeholder?: string;
  showSendButton?: boolean;
  className?: string;
  minRows?: number;
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  users,
  placeholder = "Escreva um comentário...",
  showSendButton = true,
  className,
  minRows = 2,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<MentionUser[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Mapa de menções escolhidas explicitamente via dropdown — fonte de verdade.
  // Evita o falso positivo de prefixo (ex.: "Isabella" matchando "Isabella Moraes")
  // e o falso negativo de acento/case do String.includes.
  const selectedMentionsRef = useRef<Map<string, string>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const buildMentionIds = useCallback((text: string): string[] => {
    const ids: string[] = [];
    selectedMentionsRef.current.forEach((nome, id) => {
      if (text.includes(`@${nome}`)) ids.push(id);
    });
    return [...new Set(ids)];
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPosition(pos);

    const textBeforeCursor = newValue.substring(0, pos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === " " || textBeforeCursor[atIndex - 1] === "\n")) {
      const query = textBeforeCursor.substring(atIndex + 1);
      if (!query.includes(" ") || query.length < 20) {
        const q = query.toLowerCase();
        const filtered = users
          .filter(u => u.nome?.toLowerCase().includes(q))
          .slice(0, 5);
        setFilteredUsers(filtered);
        setShowSuggestions(filtered.length > 0);
        setSelectedIndex(0);
        return;
      }
    }
    setShowSuggestions(false);
  };

  const insertMention = (user: MentionUser) => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const before = value.substring(0, atIndex);
    const after = value.substring(cursorPosition);
    const newValue = `${before}@${user.nome} ${after}`;
    selectedMentionsRef.current.set(user.id, user.nome);
    onChange(newValue);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredUsers.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredUsers[selectedIndex]) insertMention(filteredUsers[selectedIndex]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!value.trim()) return;
    const ids = buildMentionIds(value);
    onSubmit(value.trim(), ids);
    selectedMentionsRef.current.clear();
    onChange("");
  };

  return (
    <div className={cn("relative", className)}>
      {showSuggestions && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {filteredUsers.map((user, i) => (
            <button
              key={user.id}
              onClick={() => insertMention(user)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                i === selectedIndex && "bg-muted/50"
              )}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                  {user.nome?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{user.nome}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={minRows}
          className="text-sm bg-muted/30 border-border/50 resize-none flex-1"
        />
        {showSendButton && (
          <Button
            size="icon"
            className="h-9 w-9 rounded-full flex-shrink-0"
            onClick={handleSubmit}
            disabled={!value.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        Use <span className="font-mono bg-muted px-1 rounded">@</span> para mencionar colegas
      </p>
    </div>
  );
}
