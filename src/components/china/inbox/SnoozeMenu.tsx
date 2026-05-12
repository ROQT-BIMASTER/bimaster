import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { addDays, addHours, format, set, startOfTomorrow } from "date-fns";
import { useSnoozeSubmissao } from "@/hooks/useChinaInboxSnooze";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  submissaoId: string;
  triggerVariant?: "icon" | "button";
}

const presetDefs = [
  { key: "preset3h", fn: () => addHours(new Date(), 3) },
  { key: "presetAmanha", fn: () => set(startOfTomorrow(), { hours: 9 }) },
  {
    key: "presetSegunda",
    fn: () => {
      let d = new Date();
      do { d = addDays(d, 1); } while (d.getDay() !== 1);
      return set(d, { hours: 9, minutes: 0, seconds: 0 });
    },
  },
  { key: "preset1Sem", fn: () => addDays(new Date(), 7) },
];

export function SnoozeMenu({ submissaoId, triggerVariant = "button" }: Props) {
  const snooze = useSnoozeSubmissao();
  const { t } = useChinaI18n();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const apply = (d: Date) => {
    snooze.mutate({ submissao_id: submissaoId, until: d });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerVariant === "icon" ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" title={t("inbox.snooze.trigger")}>
            <Clock className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" />
            {t("inbox.snooze.trigger")}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-2">
        <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          {t("inbox.snooze.titulo")}
        </p>
        <div className="space-y-0.5">
          {presetDefs.map((p) => {
            const d = p.fn();
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => apply(d)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted/40"
              >
                <span>{t(`inbox.snooze.${p.key}`)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(d, "dd/MM HH:mm")}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 border-t border-border pt-2">
          <p className="px-2 text-[11px] text-muted-foreground">{t("inbox.snooze.datahora")}</p>
          <div className="mt-1 flex gap-1.5 px-2">
            <Input
              type="datetime-local"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!custom}
              onClick={() => {
                const d = new Date(custom);
                if (!isNaN(d.getTime()) && d.getTime() > Date.now()) apply(d);
              }}
            >
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
