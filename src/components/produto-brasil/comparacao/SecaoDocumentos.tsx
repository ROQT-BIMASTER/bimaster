import { useQuery } from "@tanstack/react-query";
import { FileText, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ComparacaoSection } from "./ComparacaoSection";

interface Props {
  produtoBrasilId: string;
  submissaoChinaId: string | null;
}

interface DocChina {
  id: string;
  nome_arquivo: string | null;
  tipo_documento: string | null;
  status: string | null;
}

interface DocBR {
  id: string;
  nome_arquivo: string | null;
  tipo_documento: string | null;
  status: string | null;
}

function useDocsChina(id: string | null) {
  return useQuery({
    queryKey: ["china-docs-comparacao", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_produto_documentos" as any)
        .select("id, nome_arquivo, tipo_documento, status")
        .eq("submissao_id", id!) as any);
      if (error) return [] as DocChina[];
      return (data || []) as DocChina[];
    },
  });
}

function useDocsBrasil(id: string) {
  return useQuery({
    queryKey: ["produto-brasil-docs-comparacao", id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produto_brasil_documentos" as any)
        .select("id, nome_arquivo, tipo_documento, status")
        .eq("produto_brasil_id", id) as any);
      if (error) return [] as DocBR[];
      return (data || []) as DocBR[];
    },
  });
}

export function SecaoDocumentos({ produtoBrasilId, submissaoChinaId }: Props) {
  const { data: china = [] } = useDocsChina(submissaoChinaId);
  const { data: brasil = [] } = useDocsBrasil(produtoBrasilId);

  return (
    <ComparacaoSection
      title="Documentos vinculados"
      icon={<FileText className="h-4 w-4 text-primary" />}
      action={
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`?tab=pasta`}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Abrir pasta digital
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            China — {china.length} documento{china.length !== 1 ? "s" : ""}
          </p>
          {china.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum.</p>
          ) : (
            <div className="space-y-1">
              {china.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 bg-muted/40 rounded px-2 py-1.5"
                >
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs flex-1 truncate">
                    {d.nome_arquivo || d.tipo_documento}
                  </span>
                  {d.status && (
                    <Badge variant="outline" className="text-[10px] h-4">
                      {d.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 text-right">
            Brasil — {brasil.length} documento{brasil.length !== 1 ? "s" : ""}
          </p>
          {brasil.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-right">
              Nenhum.
            </p>
          ) : (
            <div className="space-y-1">
              {brasil.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 bg-card border border-border rounded px-2 py-1.5"
                >
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs flex-1 truncate">
                    {d.nome_arquivo || d.tipo_documento}
                  </span>
                  {d.status && (
                    <Badge variant="outline" className="text-[10px] h-4">
                      {d.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ComparacaoSection>
  );
}
