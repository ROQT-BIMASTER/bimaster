import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MatrizPrecosComparativa } from "@/components/fabrica/MatrizPrecosComparativa";

// Module version: 2.6.2
export default function PrecosMatrizComparativa() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <MatrizPrecosComparativa />
      </div>
    </DashboardLayout>
  );
}
