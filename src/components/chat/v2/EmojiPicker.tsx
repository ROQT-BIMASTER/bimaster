/**
 * EmojiPicker — picker de emojis categorizado, sem dependência externa.
 *
 * Substitui a grade fixa de 30 emojis no MessageInput. Organizado em
 * 6 abas: Smileys, Gestos, Pessoas, Coração, Objetos, Símbolos.
 * Cap em ~140 emojis úteis no contexto de chat corporativo — sem todas
 * as variações de pele/gênero pra não estourar o popover.
 */
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const CATEGORIAS = [
  {
    key: "smileys",
    label: "😀",
    emojis: [
      "😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊",
      "😋","😎","😍","🥰","😘","🤗","🤩","🤔","🤨","😐",
      "😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪",
      "😫","🥱","😴","😌","😛","😜","🤪","😝","🤤","😒",
      "😓","😔","😕","🙃","🫠","🫥","😬","🙂","😇","🤓",
    ],
  },
  {
    key: "gestos",
    label: "👍",
    emojis: [
      "👍","👎","👏","🙌","🤝","🙏","👌","🤞","✌️","🤘",
      "🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖",
      "👋","🤟","💪","🫶","🫰","🤌","🤏","✊","👊","🫵",
    ],
  },
  {
    key: "pessoas",
    label: "🧑",
    emojis: [
      "👶","🧒","👦","👧","🧑","👨","👩","🧓","👴","👵",
      "👮","🕵️","💂","👷","🤴","👸","🦸","🦹","🧙","🧑‍💼",
      "👨‍💻","👩‍💻","👨‍🔧","👩‍🔧","👨‍🏭","👩‍🏭","👨‍⚕️","👩‍⚕️","👨‍🚀","👩‍🚀",
    ],
  },
  {
    key: "coracao",
    label: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
      "❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️",
    ],
  },
  {
    key: "objetos",
    label: "📦",
    emojis: [
      "🔥","✨","💯","💥","💫","⚡","☀️","🌧️","❄️","🎉",
      "🎊","🎁","🎈","🏆","🥇","🥈","🥉","⚽","🏀","🎯",
      "📦","📋","📁","📂","📄","📊","📈","📉","💼","🗂️",
      "📌","📎","🖇️","📍","🔖","🏷️","💰","💳","🧾","💵",
    ],
  },
  {
    key: "simbolos",
    label: "✅",
    emojis: [
      "✅","❌","⚠️","🚫","⛔","✔️","❎","➕","➖","✖️",
      "❓","❗","❕","❔","💡","🔔","🔕","📣","📢","🔇",
      "▶️","⏸️","⏹️","⏺️","⏭️","⏮️","⏩","⏪","🔄","🔁",
      "🆕","🆗","🆙","🆒","🆓","🆖","🆔","🆘","☑️","🔘",
    ],
  },
] as const;

interface Props {
  onPick: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onPick, className }: Props) {
  const [tab, setTab] = useState<typeof CATEGORIAS[number]["key"]>("smileys");

  return (
    <div className={cn("w-72 p-1", className)}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-6 h-8 w-full mb-1.5">
          {CATEGORIAS.map((c) => (
            <TabsTrigger key={c.key} value={c.key} className="text-base p-0 leading-none">
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {CATEGORIAS.map((c) => (
          <TabsContent key={c.key} value={c.key} className="m-0">
            <div className="grid grid-cols-8 gap-0.5 max-h-56 overflow-y-auto">
              {c.emojis.map((e, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPick(e)}
                  className="h-8 w-8 rounded hover:bg-muted text-lg leading-none flex items-center justify-center"
                  title={e}
                >
                  {e}
                </button>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
