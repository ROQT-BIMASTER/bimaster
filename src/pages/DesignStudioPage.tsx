import { StitchDesignStudio } from "@/components/marketing/StitchDesignStudio";
import { PageHeader } from "@/components/ui/page-header";
import { Wand2 } from "lucide-react";

const DesignStudioPage = () => {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <PageHeader
        title="Design Studio"
        subtitle="Hub criativo com IA — Templates, Brand Kit, Aprovação e Exportação"
        icon={Wand2}
      />
      <StitchDesignStudio />
    </div>
  );
};

export default DesignStudioPage;
