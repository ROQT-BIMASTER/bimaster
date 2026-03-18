import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme, themes, ThemeKey } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Palette } from "lucide-react";
import { useState } from "react";

export const ThemeSelector = () => {
  const { currentTheme, setTheme } = useTheme();
  const { toast } = useToast();
  const [selected, setSelected] = useState<ThemeKey>(currentTheme);

  const handleSave = async () => {
    await setTheme(selected);
    toast({ title: "Preferência salva", description: "Seu tema foi atualizado com sucesso." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Aparência
        </CardTitle>
        <CardDescription>
          Escolha o tema de cores que será aplicado em toda a interface.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.key}
              onClick={() => setSelected(theme.key)}
              className={cn(
                "relative rounded-[10px] border-2 overflow-hidden transition-all duration-200 hover:-translate-y-0.5",
                selected === theme.key
                  ? "border-current shadow-md"
                  : "border-[#dde1e9] hover:shadow-md"
              )}
              style={selected === theme.key ? { borderColor: theme.primary } : undefined}
            >
              {/* Preview miniature */}
              <div className="flex h-20">
                {/* Sidebar preview */}
                <div
                  className="w-1/3 flex flex-col items-center justify-center gap-1 p-1"
                  style={{ backgroundColor: theme.sidebarBg }}
                >
                  <div className="w-4 h-1 rounded-full" style={{ backgroundColor: theme.primary, opacity: 0.6 }} />
                  <div className="w-5 h-1 rounded-full bg-white/20" />
                  <div className="w-5 h-1 rounded-full bg-white/10" />
                  <div className="w-5 h-1 rounded-full bg-white/10" />
                </div>
                {/* Content preview */}
                <div className="flex-1 bg-[#eef0f5] flex flex-col items-center justify-center gap-1 p-2">
                  <div className="w-full h-1.5 rounded bg-white" />
                  <div className="flex gap-1 w-full">
                    <div className="flex-1 h-3 rounded bg-white" />
                    <div className="flex-1 h-3 rounded bg-white" />
                  </div>
                  <div
                    className="w-10 h-3 rounded"
                    style={{ backgroundColor: theme.primary }}
                  />
                </div>
              </div>
              {/* Label */}
              <div className="px-2 py-1.5 bg-white text-center">
                <span className="text-xs font-medium text-[#0f1623]">{theme.label}</span>
              </div>
              {/* Check mark */}
              {selected === theme.key && (
                <div
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: theme.primary }}
                >
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Button onClick={handleSave} disabled={selected === currentTheme}>
            Salvar preferências
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
