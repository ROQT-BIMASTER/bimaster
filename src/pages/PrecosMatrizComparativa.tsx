import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MatrizPrecosComparativa } from "@/components/fabrica/MatrizPrecosComparativa";

// Force module refresh v2.6.1
export default function PrecosMatrizComparativa() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <MatrizPrecosComparativa />
      </div>
    </DashboardLayout>
  );
}
