import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProspectMap } from "@/components/mapa/ProspectMap";
import { MapPin } from "lucide-react";

const Mapa = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-8 w-8 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">Mapa de Prospects</h2>
          </div>
          <p className="text-muted-foreground mt-2">
            Visualização geográfica dos prospects por status
          </p>
        </div>

        <ProspectMap />
      </div>
    </DashboardLayout>
  );
};

export default Mapa;
