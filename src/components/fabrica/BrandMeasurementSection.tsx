import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Calculator, Plus, X, ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// Marcas padrão que sempre aparecem
const DEFAULT_BRAND_NAMES = ["Melu", "Ruby Rose"];

interface BrandMeasurement {
  brand_id: string;
  brand_name: string;
  header_dimensions: string; // Testeira (LxA)
  width_cm: string;
  shelf_count: string;
}

interface BrandMeasurementSectionProps {
  brandMeasurements: BrandMeasurement[];
  onBrandMeasurementsChange: (measurements: BrandMeasurement[]) => void;
  totalShelfWidthCm: string;
  totalShelfCount: string;
}

export default function BrandMeasurementSection({
  brandMeasurements,
  onBrandMeasurementsChange,
  totalShelfWidthCm,
  totalShelfCount,
}: BrandMeasurementSectionProps) {
  const hasInitialized = useRef(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  
  // Fetch all our brands
  const { data: ourBrands } = useQuery({
    queryKey: ["our-brands-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("our_brands")
        .select("id, brand_name")
        .eq("active", true)
        .order("brand_name");

      if (error) throw error;
      return data || [];
    },
  });

  // Initialize brand measurements with only default brands (Melu, Ruby Rose)
  useEffect(() => {
    if (ourBrands && ourBrands.length > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      
      // Filter only default brands
      const defaultBrands = ourBrands.filter(brand => 
        DEFAULT_BRAND_NAMES.includes(brand.brand_name)
      );
      
      const initialMeasurements = defaultBrands.map((brand) => ({
        brand_id: brand.id,
        brand_name: brand.brand_name,
        header_dimensions: "",
        width_cm: "",
        shelf_count: "",
      }));
      
      setTimeout(() => {
        onBrandMeasurementsChange(initialMeasurements);
      }, 0);
    }
  }, [ourBrands]);

  // Get available brands that haven't been added yet
  const availableBrands = ourBrands?.filter(
    (brand) => !brandMeasurements.some((m) => m.brand_id === brand.id)
  ) || [];

  const addBrand = (brandId: string, brandName: string) => {
    const newMeasurement: BrandMeasurement = {
      brand_id: brandId,
      brand_name: brandName,
      header_dimensions: "",
      width_cm: "",
      shelf_count: "",
    };
    onBrandMeasurementsChange([...brandMeasurements, newMeasurement]);
    setPopoverOpen(false);
  };

  const removeBrand = (brandId: string) => {
    // Don't allow removing default brands
    const brandToRemove = brandMeasurements.find(m => m.brand_id === brandId);
    if (brandToRemove && DEFAULT_BRAND_NAMES.includes(brandToRemove.brand_name)) {
      return;
    }
    
    const updated = brandMeasurements.filter((m) => m.brand_id !== brandId);
    onBrandMeasurementsChange(updated);
  };

  const updateBrandMeasurement = (brandId: string, field: "header_dimensions" | "width_cm" | "shelf_count", value: string) => {
    const updated = brandMeasurements.map((m) =>
      m.brand_id === brandId ? { ...m, [field]: value } : m
    );
    onBrandMeasurementsChange(updated);
  };

  const calculateTotal = (measurement: BrandMeasurement): { cm: number; meters: number } => {
    const width = parseFloat(measurement.width_cm) || 0;
    const shelves = parseInt(measurement.shelf_count) || 0;
    const totalCm = width * shelves;
    return { cm: totalCm, meters: totalCm / 100 };
  };

  const totalOurBrandsCm = brandMeasurements.reduce((sum, m) => sum + calculateTotal(m).cm, 0);
  
  const totalShelfArea = (parseFloat(totalShelfWidthCm) || 0) * (parseInt(totalShelfCount) || 1);
  const sharePercentage = totalShelfArea > 0 ? (totalOurBrandsCm / totalShelfArea) * 100 : 0;

  if (!ourBrands || ourBrands.length === 0) {
    return (
      <div className="p-3 rounded-lg border bg-muted/50 text-center text-sm text-muted-foreground">
        Carregando marcas...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Tag className="h-4 w-4 text-primary" />
          Medidas por Marca
        </Label>
        
        {availableBrands.length > 0 && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Buscar marca..." />
                <CommandList>
                  <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
                  <CommandGroup>
                    {availableBrands.map((brand) => (
                      <CommandItem
                        key={brand.id}
                        value={brand.brand_name}
                        onSelect={() => addBrand(brand.id, brand.brand_name)}
                      >
                        🏷️ {brand.brand_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="space-y-3">
        {brandMeasurements.map((measurement) => {
          const total = calculateTotal(measurement);
          const isDefaultBrand = DEFAULT_BRAND_NAMES.includes(measurement.brand_name);
          
          return (
            <div
              key={measurement.brand_id}
              className="p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="font-medium">
                  🏷️ {measurement.brand_name}
                </Badge>
                {total.cm > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    <Calculator className="h-3 w-3 mr-1" />
                    {total.cm} cm ({total.meters.toFixed(2)} m)
                  </Badge>
                )}
                {!isDefaultBrand && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeBrand(measurement.brand_id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Testeira (LxA)</Label>
                  <Input
                    type="text"
                    placeholder="Ex: 90x15"
                    value={measurement.header_dimensions}
                    onChange={(e) => updateBrandMeasurement(measurement.brand_id, "header_dimensions", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Largura (cm)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 60"
                    value={measurement.width_cm}
                    onChange={(e) => updateBrandMeasurement(measurement.brand_id, "width_cm", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Prateleiras</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 3"
                    value={measurement.shelf_count}
                    onChange={(e) => updateBrandMeasurement(measurement.brand_id, "shelf_count", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumo com detalhes expansíveis */}
      {totalOurBrandsCm > 0 && (
        <Collapsible>
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Total Nossas Marcas:</span>
              <span className="font-bold text-primary">{totalOurBrandsCm.toFixed(0)} cm</span>
            </div>
            {totalShelfArea > 0 && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Share Total:</span>
                <Badge variant="default">{sharePercentage.toFixed(1)}%</Badge>
              </div>
            )}
            
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <Info className="h-3 w-3" />
                Ver detalhes do cálculo
                <ChevronDown className="h-3 w-3 ml-auto transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-2 pt-2 border-t border-primary/20">
              <div className="space-y-3 text-xs">
                {/* Detalhamento por marca */}
                <div className="space-y-1.5">
                  <p className="font-medium text-muted-foreground">Cálculo por Marca:</p>
                  {brandMeasurements.map((m) => {
                    const result = calculateTotal(m);
                    if (result.cm === 0) return null;
                    return (
                      <div key={m.brand_id} className="flex items-center justify-between pl-3 py-1 bg-background/50 rounded">
                        <span>{m.brand_name}: {m.width_cm} cm × {m.shelf_count} prat.</span>
                        <span className="font-medium">{result.cm} cm <span className="text-muted-foreground">({result.meters.toFixed(2)} m)</span></span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pl-3 pt-1 font-medium border-t border-dashed">
                    <span>Total Nossas Marcas</span>
                    <span className="text-primary">{totalOurBrandsCm.toFixed(0)} cm <span className="text-muted-foreground">({(totalOurBrandsCm / 100).toFixed(2)} m)</span></span>
                  </div>
                </div>
                
                {/* Fórmula do Share */}
                {totalShelfArea > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-medium text-muted-foreground">Cálculo do Share:</p>
                    <div className="pl-3 space-y-1 text-muted-foreground">
                      <p>Área Total Gôndola = {totalShelfWidthCm} cm × {totalShelfCount} prat. = <span className="font-medium text-foreground">{totalShelfArea.toFixed(0)} cm ({(totalShelfArea / 100).toFixed(2)} m)</span></p>
                      <p>Share = ({totalOurBrandsCm.toFixed(0)} ÷ {totalShelfArea.toFixed(0)}) × 100 = <span className="font-medium text-primary">{sharePercentage.toFixed(1)}%</span></p>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  );
}
