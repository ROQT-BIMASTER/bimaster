import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LookerStudioReports } from "@/components/marketing/LookerStudioReports";
import { BarChart3 } from "lucide-react";

export default function Marketing() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Marketing</h1>
            <p className="text-muted-foreground mt-1">
              Relatórios e dashboards integrados do Looker Studio
            </p>
          </div>
        </div>

        <LookerStudioReports />
      </div>
    </DashboardLayout>
  );
}
