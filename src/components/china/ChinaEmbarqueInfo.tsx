import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BilingualLabel } from "./BilingualLabel";
import { Ship, Anchor, MapPin, Calendar, Package, FileText, Image } from "lucide-react";
import { getSignedUrl } from "@/lib/utils/storage-helper";

interface ChinaEmbarqueInfoProps {
  embarque: any;
  documentos: any[];
}

const STATUS_MAP: Record<string, { pt: string; cn: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
  rascunho: { pt: "Rascunho", cn: "草稿", variant: "secondary" },
  enviado: { pt: "Enviado", cn: "已发送", variant: "warning" },
  confirmado: { pt: "Confirmado", cn: "已确认", variant: "success" },
  em_transito: { pt: "Em Trânsito", cn: "运输中", variant: "default" },
  entregue: { pt: "Entregue", cn: "已送达", variant: "success" },
};

export function ChinaEmbarqueInfo({ embarque, documentos }: ChinaEmbarqueInfoProps) {
  const status = STATUS_MAP[embarque.status] || STATUS_MAP.rascunho;

  const handleViewDoc = async (path: string) => {
    const { signedUrl } = await getSignedUrl("china-documentos", path);
    if (signedUrl) window.open(signedUrl, "_blank");
  };

  const InfoRow = ({ icon: Icon, labelPt, labelCn, value }: { icon: any; labelPt: string; labelCn: string; value: string | null }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-2.5 py-2">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{labelPt} {labelCn}</p>
          <p className="text-sm font-medium text-foreground break-all">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <Card className="p-5 border-blue-200 dark:border-blue-800/50 bg-blue-50/20 dark:bg-blue-950/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Ship className="h-5 w-5 text-blue-600" />
          <BilingualLabel pt="Dados de Embarque" cn="装运信息" size="md" />
        </div>
        <Badge variant={status.variant}>{status.pt} {status.cn}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 divide-y sm:divide-y-0">
        <div className="space-y-0 divide-y divide-border/50">
          <InfoRow icon={Package} labelPt="Container" labelCn="集装箱号" value={embarque.numero_container} />
          <InfoRow icon={FileText} labelPt="BL" labelCn="提单号" value={embarque.numero_bl} />
          <InfoRow icon={FileText} labelPt="Booking" labelCn="订舱号" value={embarque.booking_number} />
          <InfoRow icon={Anchor} labelPt="Navio" labelCn="船名" value={embarque.navio} />
          <InfoRow icon={MapPin} labelPt="Origem" labelCn="起运港" value={embarque.porto_origem} />
          <InfoRow icon={MapPin} labelPt="Destino" labelCn="目的港" value={embarque.porto_destino} />
        </div>

        <div className="space-y-0 divide-y divide-border/50">
          <InfoRow icon={Calendar} labelPt="Embarque" labelCn="装船日期" value={embarque.data_embarque ? new Date(embarque.data_embarque).toLocaleDateString("pt-BR") : null} />
          <InfoRow icon={Calendar} labelPt="ETA" labelCn="预计到达" value={embarque.data_eta ? new Date(embarque.data_eta).toLocaleDateString("pt-BR") : null} />
          <InfoRow icon={Package} labelPt="Peso" labelCn="重量" value={embarque.peso_total_kg ? `${Number(embarque.peso_total_kg).toLocaleString()} kg` : null} />
          <InfoRow icon={Package} labelPt="Volume" labelCn="体积" value={embarque.volume_cbm ? `${embarque.volume_cbm} CBM` : null} />
          <InfoRow icon={Package} labelPt="Volumes" labelCn="件数" value={embarque.qtd_volumes?.toString()} />
          <InfoRow icon={Package} labelPt="Modalidade" labelCn="运输方式" value={embarque.modalidade} />
          {embarque.valor_frete_usd && (
            <InfoRow icon={FileText} labelPt="Frete" labelCn="运费" value={`USD ${Number(embarque.valor_frete_usd).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
          )}
        </div>
      </div>

      {embarque.observacoes && (
        <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Observações 备注</p>
          <p className="text-sm text-foreground">{embarque.observacoes}</p>
        </div>
      )}

      {/* Documentos/Fotos */}
      {documentos.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Documentos anexos 附件 ({documentos.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {documentos.map((doc: any) => (
              <Button
                key={doc.id}
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => doc.arquivo_path && handleViewDoc(doc.arquivo_path)}
              >
                <Image className="h-3.5 w-3.5" />
                <span className="text-xs truncate max-w-[120px]">{doc.nome_arquivo || "Arquivo"}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
