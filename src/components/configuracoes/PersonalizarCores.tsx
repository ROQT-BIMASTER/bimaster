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

interface BackgroundOption {
  name: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
}

const backgroundOptions: BackgroundOption[] = [
  {
    name: "Branco (Padrão)",
    background: "0 0% 100%",
    foreground: "222.2 84% 4.9%",
    card: "0 0% 100%",
    cardForeground: "222.2 84% 4.9%",
  },
  {
    name: "Cinza Claro",
    background: "220 14% 96%",
    foreground: "222 47% 11%",
    card: "0 0% 100%",
    cardForeground: "222 47% 11%",
  },
  {
    name: "Azul Gelo",
    background: "210 40% 98%",
    foreground: "222 47% 11%",
    card: "210 40% 99%",
    cardForeground: "222 47% 11%",
  },
  {
    name: "Verde Menta",
    background: "150 40% 97%",
    foreground: "160 60% 10%",
    card: "150 40% 99%",
    cardForeground: "160 60% 10%",
  },
  {
    name: "Lavanda",
    background: "260 30% 97%",
    foreground: "260 50% 10%",
    card: "260 30% 99%",
    cardForeground: "260 50% 10%",
  },
  {
    name: "Creme",
    background: "40 30% 96%",
    foreground: "30 50% 10%",
    card: "40 30% 99%",
    cardForeground: "30 50% 10%",
  },
  {
    name: "Modo Escuro",
    background: "222 47% 8%",
    foreground: "220 14% 96%",
    card: "222 47% 11%",
    cardForeground: "220 14% 96%",
  },
];

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
  const [selectedBackground, setSelectedBackground] = useState<BackgroundOption>(backgroundOptions[0]);
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
    
    // Carregar fundo salvo
    const savedBackground = localStorage.getItem("customBackground");
    if (savedBackground) {
      const parsedBg = JSON.parse(savedBackground);
      setSelectedBackground(parsedBg);
      applyBackground(parsedBg);
    }
  }, []);

  const applyBackground = (bg: BackgroundOption) => {
    const root = document.documentElement;
    root.style.setProperty("--background", bg.background);
    root.style.setProperty("--foreground", bg.foreground);
    root.style.setProperty("--card", bg.card);
    root.style.setProperty("--card-foreground", bg.cardForeground);
    root.style.setProperty("--popover", bg.card);
    root.style.setProperty("--popover-foreground", bg.cardForeground);
    root.style.setProperty("--sidebar-background", bg.background);
    root.style.setProperty("--sidebar-foreground", bg.foreground);
  };

  const applyTheme = (scheme: ColorScheme) => {
    const root = document.documentElement;
    root.style.setProperty("--primary", scheme.primary);
    root.style.setProperty("--secondary", scheme.secondary);
    root.style.setProperty("--accent", scheme.accent);
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

  const handleBackgroundSelect = (bg: BackgroundOption) => {
    setSelectedBackground(bg);
    applyBackground(bg);
    localStorage.setItem("customBackground", JSON.stringify(bg));
    toast.success(`Fundo "${bg.name}" aplicado!`);
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
    
    // Reset background também
    const defaultBg = backgroundOptions[0];
    setSelectedBackground(defaultBg);
    applyBackground(defaultBg);
    localStorage.removeItem("customBackground");
    
    setCustomColors({
      primary: "#8b5cf6",
      secondary: "#f1f5f9",
      accent: "#f1f5f9",
    });
    toast.success("Cores e fundo restaurados para o padrão!");
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

          {/* Cor de Fundo */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Cor de Fundo</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {backgroundOptions.map((bg) => (
                <Button
                  key={bg.name}
                  variant="outline"
                  className={`h-auto flex-col items-center p-3 gap-2 ${
                    selectedBackground.name === bg.name ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleBackgroundSelect(bg)}
                >
                  <div 
                    className="w-10 h-10 rounded-lg border-2 border-border flex items-center justify-center"
                    style={{ 
                      backgroundColor: `hsl(${bg.background})`,
                      color: `hsl(${bg.foreground})`
                    }}
                  >
                    <span className="text-xs font-bold">Aa</span>
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">{bg.name}</span>
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
