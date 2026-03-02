import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  // Row 1 - Vibrant
  "#E53935", "#FF6D00", "#FFB300", "#43A047",
  "#1E88E5", "#5E35B1", "#D81B60", "#000000",
  // Row 2 - Soft / Pastel
  "#EF9A9A", "#FFCC80", "#FFF59D", "#A5D6A7",
  "#90CAF9", "#CE93D8", "#F48FB1", "#FFFFFF",
  // Row 3 - Neutral / Nature
  "#8D6E63", "#BCAAA4", "#78909C", "#B0BEC5",
  "#FFE0B2", "#D7CCC8", "#CFD8DC", "#E0E0E0",
];

interface ColorPickerPopoverProps {
  value?: string;
  onChange: (hex: string) => void;
}

export function ColorPickerPopover({ value, onChange }: ColorPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value || "");

  const handleSelect = (color: string) => {
    onChange(color);
    setHexInput(color);
    setOpen(false);
  };

  const handleHexSubmit = () => {
    const hex = hexInput.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
      setOpen(false);
    }
  };

  const handleHexChange = (val: string) => {
    let hex = val;
    if (hex && !hex.startsWith("#")) hex = "#" + hex;
    setHexInput(hex);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setHexInput(value || ""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-6 w-6 rounded border border-input shrink-0 flex items-center justify-center cursor-pointer transition-colors hover:border-primary/50",
            !value && "bg-muted"
          )}
          style={value ? { backgroundColor: value } : undefined}
          title={value || "Selecionar cor"}
        >
          {!value && <Palette className="h-3 w-3 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-3" align="start" side="bottom">
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cores rápidas</p>
          <div className="grid grid-cols-8 gap-1">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  "h-5 w-5 rounded-sm border cursor-pointer transition-transform hover:scale-110 flex items-center justify-center",
                  color === "#FFFFFF" ? "border-border" : "border-transparent",
                  value === color && "ring-2 ring-primary ring-offset-1"
                )}
                style={{ backgroundColor: color }}
                onClick={() => handleSelect(color)}
                title={color}
              >
                {value === color && (
                  <Check className={cn("h-3 w-3", color === "#FFFFFF" || color === "#FFF59D" || color === "#FFE0B2" || color === "#E0E0E0" ? "text-foreground" : "text-white")} />
                )}
              </button>
            ))}
          </div>

          <div className="border-t pt-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Cor personalizada</p>
            <div className="flex items-center gap-1.5">
              <Input
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#FF5733"
                className="h-7 text-[11px] font-mono flex-1 px-2"
                maxLength={7}
                onKeyDown={(e) => e.key === "Enter" && handleHexSubmit()}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 w-7 p-0"
                onClick={handleHexSubmit}
                disabled={!/^#[0-9A-Fa-f]{6}$/.test(hexInput)}
              >
                <Check className="h-3 w-3" />
              </Button>
              {value && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px] text-destructive"
                  onClick={() => { onChange(""); setHexInput(""); setOpen(false); }}
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
