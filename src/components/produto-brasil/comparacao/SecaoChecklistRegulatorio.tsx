import { ClipboardCheck, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";
import { ComparacaoSection } from "./ComparacaoSection";
import { ComparacaoRow } from "./ComparacaoRow";

interface Props {
  produto: ProdutoBrasil;
}

export function SecaoChecklistRegulatorio({ produto }: Props) {
  const rows = [
    {
      label: "Categoria regulatória",
      china: produto.china_categoria,
      brasil: produto.categoria_regulatoria,
    },
    {
      label: "Responsável técnico",
      china: "",
      brasil: produto.responsavel_tecnico,
    },
    {
      label: "Status ANVISA",
      china: "",
      brasil: produto.status_anvisa || produto.anvisa_pipeline_status,
    },
    {
      label: "Nº de registro / processo",
      china: "",
      brasil: produto.numero_registro || produto.processo_anvisa,
    },
    {
      label: "Data envio ANVISA",
      china: "",
      brasil: produto.anvisa_data_envio,
    },
    {
      label: "Data aprovação regulatória",
      china: "",
      brasil:
        produto.anvisa_data_aprovacao || produto.data_aprovacao_regulatorio,
    },
  ];

  return (
    <ComparacaoSection
      title="Checklist regulatório Brasil"
      icon={<ClipboardCheck className="h-4 w-4 text-primary" />}
      action={
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`?tab=checklist`}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir checklist
          </Link>
        </Button>
      }
    >
      {rows.map((r) => (
        <ComparacaoRow
          key={r.label}
          label={r.label}
          china={r.china || ""}
          brasil={r.brasil || ""}
        />
      ))}
    </ComparacaoSection>
  );
}
