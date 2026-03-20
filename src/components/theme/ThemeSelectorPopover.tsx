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
        <div
          role="button"
          tabIndex={0}
          className="flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 cursor-pointer hover:bg-[var(--sidebar-item-hover-raw)] text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)]"
          title="Escolher tema"
        >
          <Palette className="h-4 w-4" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-56 p-2 bg-[var(--sidebar-bg-raw)] border shadow-xl"
        style={{ borderColor: 'var(--sidebar-border-raw)' }}
      >
        <p className="text-[10px] uppercase tracking-wider font-bold mb-2 px-2" style={{ color: 'var(--sidebar-text-muted-raw)' }}>
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
                  ? "text-[var(--sidebar-text-active-raw)]"
                  : "text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)]"
              )}
              style={currentTheme === theme.key ? { backgroundColor: 'var(--sidebar-item-hover-raw)' } : undefined}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.primary }}
                />
                <div
                  className="w-3 h-3 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.sidebarBg }}
                />
              </div>
              <span className="flex-1 text-left">{theme.label}</span>
              {currentTheme === theme.key && (
                <Check className="h-3.5 w-3.5" style={{ color: 'var(--sidebar-text-active-raw)' }} />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
