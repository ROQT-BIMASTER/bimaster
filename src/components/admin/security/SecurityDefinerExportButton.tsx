import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { SecurityDefinerFunctionEnriched } from "@/lib/security/securityDefinerStatus";

interface Props {
  rows: SecurityDefinerFunctionEnriched[];
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function SecurityDefinerExportButton({ rows }: Props) {
  const handleExport = () => {
    const headers = [
      "schema",
      "name",
      "signature",
      "used_in_frontend",
      "callers_count",
      "status_final",
      "status_override",
      "nota",
      "reviewed_by",
      "reviewed_at",
      "granted_authenticated",
      "granted_anon",
      "granted_service_role",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.schema_name,
          r.function_name,
          r.function_signature,
          r.used_in_frontend ? "sim" : "não",
          r.callers_count,
          r.status_final,
          r.override?.status_override ?? "",
          r.override?.nota ?? "",
          r.override?.reviewed_by ?? "",
          r.override?.reviewed_at ?? "",
          r.granted_to_authenticated,
          r.granted_to_anon,
          r.granted_to_service_role,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-definer-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
      <Download className="h-4 w-4" />
      Exportar CSV ({rows.length})
    </Button>
  );
}
