import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Edit3 } from "lucide-react";

interface FiscalFieldWithOptionsProps {
  label: string;
  xmlValue?: string | number | null;
  aiSuggestion?: {
    value: string;
    reason: string;
  };
  currentValue: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  required?: boolean;
}

export const FiscalFieldWithOptions = ({
  label,
  xmlValue,
  aiSuggestion,
  currentValue,
  onChange,
  type = "text",
  required = false
}: FiscalFieldWithOptionsProps) => {
  const [mode, setMode] = useState<"xml" | "ai" | "edit">("edit");

  const handleModeChange = (newMode: "xml" | "ai" | "edit") => {
    setMode(newMode);
    if (newMode === "xml" && xmlValue !== null && xmlValue !== undefined) {
      onChange(String(xmlValue));
    } else if (newMode === "ai" && aiSuggestion) {
      onChange(aiSuggestion.value);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>

      {/* Opções de origem */}
      <div className="flex gap-2 flex-wrap">
        {xmlValue !== null && xmlValue !== undefined && (
          <Button
            type="button"
            size="sm"
            variant={mode === "xml" ? "default" : "outline"}
            onClick={() => handleModeChange("xml")}
            className="h-7 text-xs"
          >
            <FileText className="h-3 w-3 mr-1" />
            XML: {xmlValue}
          </Button>
        )}
        
        {aiSuggestion && (
          <Button
            type="button"
            size="sm"
            variant={mode === "ai" ? "default" : "outline"}
            onClick={() => handleModeChange("ai")}
            className="h-7 text-xs"
            title={aiSuggestion.reason}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            IA: {aiSuggestion.value}
          </Button>
        )}
        
        <Button
          type="button"
          size="sm"
          variant={mode === "edit" ? "default" : "outline"}
          onClick={() => handleModeChange("edit")}
          className="h-7 text-xs"
        >
          <Edit3 className="h-3 w-3 mr-1" />
          Editar
        </Button>
      </div>

      {/* Campo de input */}
      <Input
        type={type}
        value={currentValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={mode !== "edit"}
        className={mode !== "edit" ? "bg-muted" : ""}
      />

      {/* Informação adicional */}
      {mode === "ai" && aiSuggestion && (
        <p className="text-xs text-muted-foreground">{aiSuggestion.reason}</p>
      )}
    </div>
  );
};
