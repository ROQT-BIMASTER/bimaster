import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { StitchDesignStudio } from "@/components/marketing/StitchDesignStudio";
import { PageHeader } from "@/components/ui/page-header";
import { Wand2 } from "lucide-react";

const DesignStudioPage = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <PageHeader
        title="Design Studio"
        subtitle="Hub criativo com IA — Templates, Brand Kit, Aprovação e Exportação"
        icon={Wand2}
      />
      <StitchDesignStudio initialTab={tabFromUrl || undefined} />
    </div>
  );
};

export default DesignStudioPage;
