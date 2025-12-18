import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdsDashboard } from "@/components/marketing/ads";

export default function AdsDashboardPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 px-4">
        <AdsDashboard />
      </div>
    </DashboardLayout>
  );
}
