import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Palette, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

function isDarkHex(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.4;
}

const PRESET_COLORS = [
  "#FFFFFF", "#F3F4F6", "#FEF9C3", "#FDE68A",
  "#FECACA", "#FBCFE8", "#D1FAE5", "#A7F3D0",
  "#BFDBFE", "#C7D2FE", "#E9D5FF", "#DDD6FE",
  "#111111", "#1A1A2E", "#1E293B", "#1C1917",
];

interface ProjetoBgColorPickerProps {
  value: string | null;
  onChange: (cor: string | null) => void;
}

export function ProjetoBgColorPicker({ value, onChange }: ProjetoBgColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value || "");

  const handleSelect = (color: string) => {
    onChange(color);
    setHexInput(color);
    setOpen(false);
  };

  const handleRemove = () => {
    onChange(null);
    setHexInput("");
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
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 px-2">
          <div
            className="h-4 w-4 rounded-full border border-border"
            style={value ? { backgroundColor: value } : undefined}
          />
          <Palette className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-3" align="start" side="bottom">
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cor de fundo</p>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  "h-6 w-6 rounded-md border cursor-pointer transition-transform hover:scale-110 flex items-center justify-center",
                  color === "#FFFFFF" ? "border-border" : "border-transparent",
                  value === color && "ring-2 ring-primary ring-offset-1"
                )}
                style={{ backgroundColor: color }}
                onClick={() => handleSelect(color)}
                title={color}
              >
                {value === color && <Check className={`h-3 w-3 ${isDarkHex(color) ? "text-white" : "text-black"}`} />}
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
            </div>
          </div>

          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-destructive gap-1"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" /> Remover cor
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
