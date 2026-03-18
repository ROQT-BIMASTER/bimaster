import { Check, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme, themes, ThemeKey } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export const ThemeSelectorPopover = () => {
  const { currentTheme, setTheme } = useTheme();
  const { toast } = useToast();

  const handleSelect = async (key: ThemeKey) => {
    await setTheme(key);
    toast({ title: "Tema aplicado", description: `Tema ${themes.find(t => t.key === key)?.label} salvo.` });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 hover:bg-[var(--sidebar-hover-raw)] text-[#8896ab] hover:text-[#c8d3e0]"
          title="Escolher tema"
        >
          <Palette className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-56 p-2 bg-[var(--sidebar-bg-raw)] border border-white/10 shadow-xl"
      >
        <p className="text-[10px] uppercase tracking-wider font-bold text-[#4a5a70] mb-2 px-2">
          Tema de Cores
        </p>
        <div className="space-y-0.5">
          {themes.map((theme) => (
            <button
              key={theme.key}
              onClick={() => handleSelect(theme.key)}
              className={cn(
                "flex items-center gap-3 w-full px-2 py-2 rounded-md text-sm transition-all duration-150",
                currentTheme === theme.key
                  ? "bg-white/10 text-white"
                  : "text-[#8896ab] hover:bg-white/5 hover:text-[#c8d3e0]"
              )}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded-full border border-white/20"
                  style={{ backgroundColor: theme.primary }}
                />
                <div
                  className="w-3 h-3 rounded-full border border-white/10"
                  style={{ backgroundColor: theme.sidebarBg }}
                />
              </div>
              <span className="flex-1 text-left">{theme.label}</span>
              {currentTheme === theme.key && (
                <Check className="h-3.5 w-3.5 text-white" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
