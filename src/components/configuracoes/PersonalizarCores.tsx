import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Palette, RotateCcw } from "lucide-react";

interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
}

const defaultColors: ColorScheme = {
  primary: "262.1 83.3% 57.8%",
  secondary: "220 14.3% 95.9%",
  accent: "220 14.3% 95.9%",
  background: "0 0% 100%",
  foreground: "222.2 84% 4.9%",
};

const presetThemes = [
  {
    name: "Padrão (Roxo)",
    colors: defaultColors
  },
  {
    name: "Oceano",
    colors: {
      primary: "199 89% 48%",
      secondary: "197 37% 24%",
      accent: "199 89% 48%",
      background: "0 0% 100%",
      foreground: "222.2 84% 4.9%",
    }
  },
  {
    name: "Floresta",
    colors: {
      primary: "142 76% 36%",
      secondary: "142 25% 90%",
      accent: "142 76% 36%",
      background: "0 0% 100%",
      foreground: "222.2 84% 4.9%",
    }
  },
  {
    name: "Sunset",
    colors: {
      primary: "24 95% 53%",
      secondary: "45 100% 51%",
      accent: "24 95% 53%",
      background: "0 0% 100%",
      foreground: "222.2 84% 4.9%",
    }
  },
  {
    name: "Corporate",
    colors: {
      primary: "221.2 83.2% 53.3%",
      secondary: "210 40% 96.1%",
      accent: "221.2 83.2% 53.3%",
      background: "0 0% 100%",
      foreground: "222.2 84% 4.9%",
    }
  },
];

export function PersonalizarCores() {
  const [colors, setColors] = useState<ColorScheme>(defaultColors);
  const [customColors, setCustomColors] = useState({
    primary: "#8b5cf6",
    secondary: "#f1f5f9",
    accent: "#f1f5f9",
  });

  useEffect(() => {
    // Carregar cores salvas do localStorage
    const savedColors = localStorage.getItem("customTheme");
    if (savedColors) {
      const parsed = JSON.parse(savedColors);
      setColors(parsed);
      applyTheme(parsed);
    }
  }, []);

  const applyTheme = (scheme: ColorScheme) => {
    const root = document.documentElement;
    root.style.setProperty("--primary", scheme.primary);
    root.style.setProperty("--secondary", scheme.secondary);
    root.style.setProperty("--accent", scheme.accent);
    root.style.setProperty("--background", scheme.background);
    root.style.setProperty("--foreground", scheme.foreground);
  };

  const hexToHSL = (hex: string): string => {
    // Remove o # se existir
    hex = hex.replace(/^#/, '');
    
    // Converte hex para RGB
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return `${h} ${s}% ${l}%`;
  };

  const handleColorChange = (key: keyof typeof customColors, value: string) => {
    setCustomColors(prev => ({ ...prev, [key]: value }));
  };

  const applyCustomColors = () => {
    const newScheme: ColorScheme = {
      primary: hexToHSL(customColors.primary),
      secondary: hexToHSL(customColors.secondary),
      accent: hexToHSL(customColors.accent),
      background: colors.background,
      foreground: colors.foreground,
    };

    setColors(newScheme);
    applyTheme(newScheme);
    localStorage.setItem("customTheme", JSON.stringify(newScheme));
    toast.success("Cores personalizadas aplicadas!");
  };

  const applyPreset = (preset: typeof presetThemes[0]) => {
    setColors(preset.colors);
    applyTheme(preset.colors);
    localStorage.setItem("customTheme", JSON.stringify(preset.colors));
    toast.success(`Tema "${preset.name}" aplicado!`);
  };

  const resetToDefault = () => {
    setColors(defaultColors);
    applyTheme(defaultColors);
    localStorage.removeItem("customTheme");
    setCustomColors({
      primary: "#8b5cf6",
      secondary: "#f1f5f9",
      accent: "#f1f5f9",
    });
    toast.success("Cores restauradas para o padrão!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Personalizar Cores do Sistema
          </CardTitle>
          <CardDescription>
            Customize as cores principais da interface para combinar com sua marca
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Temas Predefinidos */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Temas Predefinidos</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {presetThemes.map((theme) => (
                <Button
                  key={theme.name}
                  variant="outline"
                  className="h-auto flex-col items-start p-4 gap-3"
                  onClick={() => applyPreset(theme)}
                >
                  <div className="flex gap-2 w-full">
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-border"
                      style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
                    />
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-border"
                      style={{ backgroundColor: `hsl(${theme.colors.secondary})` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{theme.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Cores Personalizadas */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Cores Personalizadas</Label>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Cor Primária</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary-color"
                    type="color"
                    value={customColors.primary}
                    onChange={(e) => handleColorChange("primary", e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={customColors.primary}
                    onChange={(e) => handleColorChange("primary", e.target.value)}
                    placeholder="#8b5cf6"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary-color">Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary-color"
                    type="color"
                    value={customColors.secondary}
                    onChange={(e) => handleColorChange("secondary", e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={customColors.secondary}
                    onChange={(e) => handleColorChange("secondary", e.target.value)}
                    placeholder="#f1f5f9"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accent-color">Cor de Destaque</Label>
                <div className="flex gap-2">
                  <Input
                    id="accent-color"
                    type="color"
                    value={customColors.accent}
                    onChange={(e) => handleColorChange("accent", e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={customColors.accent}
                    onChange={(e) => handleColorChange("accent", e.target.value)}
                    placeholder="#f1f5f9"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={applyCustomColors}>
                <Palette className="h-4 w-4 mr-2" />
                Aplicar Cores Personalizadas
              </Button>
              <Button variant="outline" onClick={resetToDefault}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar Padrão
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Pré-visualização</Label>
            <div className="p-6 border rounded-lg space-y-4 bg-background">
              <div className="flex gap-2">
                <Button>Botão Primário</Button>
                <Button variant="secondary">Botão Secundário</Button>
                <Button variant="outline">Botão Outline</Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Card de Exemplo</CardTitle>
                  <CardDescription>Este é um exemplo de como os cards ficarão</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Conteúdo do card com texto secundário</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
