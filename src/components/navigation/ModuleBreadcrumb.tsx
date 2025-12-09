import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface ModuleBreadcrumbProps {
  moduleName: string;
  moduleHref: string;
  currentPage: string;
}

export const ModuleBreadcrumb = ({ moduleName, moduleHref, currentPage }: ModuleBreadcrumbProps) => {
  return (
    <div className="flex items-center gap-4 mb-6">
      <Button variant="ghost" size="sm" asChild className="gap-2">
        <Link to={moduleHref}>
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Button>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={moduleHref}>{moduleName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{currentPage}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
