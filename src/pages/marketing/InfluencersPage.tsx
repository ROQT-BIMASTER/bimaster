import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { InfluencerDashboard } from "@/components/marketing/influencers/InfluencerDashboard";
import { Users } from "lucide-react";

export default function InfluencersPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Influenciadores</h1>
            <p className="text-muted-foreground mt-1">
              Central de Inteligência de Influenciadores com ranking automático e análise por IA.
            </p>
          </div>
        </div>
        <InfluencerDashboard />
      </div>
    </DashboardLayout>
  );
}
