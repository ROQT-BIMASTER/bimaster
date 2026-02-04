import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StoreClassification = "A+" | "A" | "B" | "C" | "D" | "E";

export const CLASSIFICATION_OPTIONS: { value: StoreClassification; label: string; description: string }[] = [
  { value: "A+", label: "A+", description: "Cliente Premium" },
  { value: "A", label: "A", description: "Muito importante" },
  { value: "B", label: "B", description: "Importante" },
  { value: "C", label: "C", description: "Médio" },
  { value: "D", label: "D", description: "Pequeno" },
  { value: "E", label: "E", description: "Baixo potencial" },
];

const classificationStyles: Record<StoreClassification, string> = {
  "A+": "bg-purple-500 hover:bg-purple-600 text-white border-purple-600",
  "A": "bg-blue-500 hover:bg-blue-600 text-white border-blue-600",
  "B": "bg-green-500 hover:bg-green-600 text-white border-green-600",
  "C": "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600",
  "D": "bg-orange-500 hover:bg-orange-600 text-white border-orange-600",
  "E": "bg-gray-400 hover:bg-gray-500 text-white border-gray-500",
};

interface ClassificationBadgeProps {
  classification?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function ClassificationBadge({ 
  classification, 
  size = "md",
  showLabel = false,
  className 
}: ClassificationBadgeProps) {
  const value = (classification as StoreClassification) || "C";
  const option = CLASSIFICATION_OPTIONS.find(o => o.value === value);
  
  const sizeClasses = {
    sm: "text-[10px] h-5 px-1.5",
    md: "text-xs h-6 px-2",
    lg: "text-sm h-7 px-3",
  };

  return (
    <Badge 
      className={cn(
        classificationStyles[value] || classificationStyles["C"],
        sizeClasses[size],
        "font-bold",
        className
      )}
    >
      {value}
      {showLabel && option && <span className="ml-1 font-normal">- {option.description}</span>}
    </Badge>
  );
}
