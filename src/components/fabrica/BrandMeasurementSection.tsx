import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tag, Calculator } from "lucide-react";

interface BrandMeasurement {
  brand_id: string;
  brand_name: string;
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
  // Fetch our brands
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

  // Initialize brand measurements when brands are loaded
  const initializeBrandMeasurements = () => {
    if (ourBrands && ourBrands.length > 0 && brandMeasurements.length === 0) {
      const initialMeasurements = ourBrands.map((brand) => ({
        brand_id: brand.id,
        brand_name: brand.brand_name,
        width_cm: "",
        shelf_count: "",
      }));
      onBrandMeasurementsChange(initialMeasurements);
    }
  };

  // Call initialization when brands load
  if (ourBrands && ourBrands.length > 0 && brandMeasurements.length === 0) {
    initializeBrandMeasurements();
  }

  const updateBrandMeasurement = (brandId: string, field: "width_cm" | "shelf_count", value: string) => {
    const updated = brandMeasurements.map((m) =>
      m.brand_id === brandId ? { ...m, [field]: value } : m
    );
    onBrandMeasurementsChange(updated);
  };

  const calculateTotal = (measurement: BrandMeasurement): number => {
    const width = parseFloat(measurement.width_cm) || 0;
    const shelves = parseInt(measurement.shelf_count) || 0;
    return width * shelves;
  };

  const totalOurBrandsCm = brandMeasurements.reduce((sum, m) => sum + calculateTotal(m), 0);
  
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
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Tag className="h-4 w-4 text-primary" />
        Medidas por Marca
      </Label>

      <div className="space-y-3">
        {brandMeasurements.map((measurement) => {
          const total = calculateTotal(measurement);
          return (
            <div
              key={measurement.brand_id}
              className="p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="font-medium">
                  🏷️ {measurement.brand_name}
                </Badge>
                {total > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    <Calculator className="h-3 w-3 mr-1" />
                    {total} cm
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
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

      {/* Resumo */}
      {totalOurBrandsCm > 0 && (
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
        </div>
      )}
    </div>
  );
}
