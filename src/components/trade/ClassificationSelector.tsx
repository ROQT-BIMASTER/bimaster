import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CLASSIFICATION_OPTIONS, StoreClassification } from "./ClassificationBadge";
import { cn } from "@/lib/utils";

interface ClassificationSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const classificationColors: Record<StoreClassification, string> = {
  "A+": "data-[state=on]:bg-purple-500 data-[state=on]:text-white data-[state=on]:border-purple-600",
  "A": "data-[state=on]:bg-blue-500 data-[state=on]:text-white data-[state=on]:border-blue-600",
  "B": "data-[state=on]:bg-green-500 data-[state=on]:text-white data-[state=on]:border-green-600",
  "C": "data-[state=on]:bg-yellow-500 data-[state=on]:text-white data-[state=on]:border-yellow-600",
  "D": "data-[state=on]:bg-orange-500 data-[state=on]:text-white data-[state=on]:border-orange-600",
  "E": "data-[state=on]:bg-gray-400 data-[state=on]:text-white data-[state=on]:border-gray-500",
};

export function ClassificationSelector({ 
  value, 
  onChange, 
  disabled = false,
  className 
}: ClassificationSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>Classificação Comercial</Label>
      <ToggleGroup 
        type="single" 
        value={value || "C"} 
        onValueChange={(val) => val && onChange(val)}
        disabled={disabled}
        className="flex flex-wrap gap-1"
      >
        {CLASSIFICATION_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={cn(
              "px-3 py-1.5 font-bold text-sm border",
              classificationColors[option.value]
            )}
            title={option.description}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">
        Indica o potencial comercial do PDV (A+ = Premium, E = Baixo potencial)
      </p>
    </div>
  );
}
