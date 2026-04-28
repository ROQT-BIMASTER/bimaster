import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Palette, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { isDarkHex } from "@/lib/colorUtils";

const PRESET_COLORS = [
  // Clássicos (paleta original)
  "#FFFFFF", "#F3F4F6", "#FEF9C3", "#FDE68A", "#FECACA", "#FBCFE8",
  "#D1FAE5", "#A7F3D0", "#BFDBFE", "#C7D2FE", "#E9D5FF", "#DDD6FE",
  // Neutros claros extras
  "#F8FAFC", "#E5E7EB", "#FAF5FF", "#FFF7ED", "#FEF3C7", "#FED7AA",
  // Pasteis adicionais
  "#F5D0FE", "#BAE6FD", "#FCE7F3", "#E0E7FF", "#CCFBF1", "#FEE2E2",
  // Tons médios suaves
  "#86EFAC", "#67E8F9", "#93C5FD", "#C4B5FD", "#F0ABFC", "#FDA4AF",
  // Saturados médios
  "#34D399", "#38BDF8", "#6366F1", "#A855F7", "#EC4899", "#F97316",
  // Terrosos / quentes
  "#D97706", "#B45309", "#92400E", "#7C2D12", "#9F1239", "#831843",
  // Escuros / noite
  "#111111", "#0F172A", "#111827", "#1E293B", "#1F2937", "#312E81", "#4C1D95", "#000000",
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
      <PopoverContent className="w-[260px] p-3" align="start" side="bottom">
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
