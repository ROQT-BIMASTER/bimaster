import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModulePermissionsIndex } from "@/components/configuracoes/permissoes-modulo/ModulePermissionsIndex";
import { ModulePermissionsDetail } from "@/components/configuracoes/permissoes-modulo/ModulePermissionsDetail";

export default function PermissoesModulo() {
  const { moduleCode } = useParams<{ moduleCode: string }>();

  return (
    <DashboardLayout>
      {moduleCode ? (
        <ModulePermissionsDetail moduleCode={moduleCode} />
      ) : (
        <ModulePermissionsIndex />
      )}
    </DashboardLayout>
  );
}
