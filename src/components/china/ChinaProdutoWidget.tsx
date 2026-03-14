import { ChinaVinculo } from "@/hooks/useChinaProjeto";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Ship, ExternalLink, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_LABELS: Record<string, { pt: string; cn: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
  rascunho: { pt: "Rascunho", cn: "草稿", variant: "secondary" },
  enviado: { pt: "Enviado", cn: "已发送", variant: "default" },
  em_revisao: { pt: "Em Revisão", cn: "审核中", variant: "warning" },
  aprovado: { pt: "Aprovado", cn: "已批准", variant: "success" },
  rejeitado: { pt: "Rejeitado", cn: "已拒绝", variant: "destructive" },
  arte_enviada: { pt: "Docs Enviados", cn: "文件已发送", variant: "success" },
};

interface ChinaProdutoWidgetProps {
  vinculo: ChinaVinculo;
}

export function ChinaProdutoWidget({ vinculo }: ChinaProdutoWidgetProps) {
  const navigate = useNavigate();
  const statusInfo = STATUS_LABELS[vinculo.status] || { pt: vinculo.status, cn: "", variant: "secondary" as const };
  const docsPct = vinculo.total_docs > 0 ? Math.round((vinculo.docs_aprovados / vinculo.total_docs) * 100) : 0;

  return (
    <div
      className="p-3 rounded-lg border bg-warning/5 border-warning/20 cursor-pointer hover:bg-warning/10 transition-colors space-y-2"
      onClick={() => navigate(`/dashboard/fabrica-china/recebimentos/${vinculo.id}`)}
    >
      <div className="flex items-center gap-2">
        <Ship className="h-4 w-4 text-warning shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            {vinculo.produto_codigo} — {vinculo.produto_nome}
          </p>
          <p className="text-[10px] text-muted-foreground">Produto China 中国产品</p>
        </div>
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={statusInfo.variant} className="text-[10px]">
          {statusInfo.pt} {statusInfo.cn}
        </Badge>
        {vinculo.total_docs > 0 && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {vinculo.docs_aprovados}/{vinculo.total_docs} docs
          </span>
        )}
      </div>

      {vinculo.total_docs > 0 && (
        <Progress value={docsPct} className="h-1.5" />
      )}
    </div>
  );
}
