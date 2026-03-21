import { useTradeBanners, useDeleteBanner, useUpdateBanner, type TradeBanner } from "@/hooks/useTradeBanners";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Copy, ToggleLeft, ToggleRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  onEdit: (banner: TradeBanner) => void;
  onDuplicate: (banner: TradeBanner) => void;
}

function getStatus(banner: TradeBanner) {
  if (!banner.ativo) return { label: "Inativo", variant: "secondary" as const };
  const now = new Date();
  if (new Date(banner.data_inicio) > now) return { label: "Agendado", variant: "outline" as const };
  if (banner.data_fim && new Date(banner.data_fim) < now) return { label: "Expirado", variant: "destructive" as const };
  return { label: "Ativo", variant: "default" as const };
}

export function BannerListTable({ onEdit, onDuplicate }: Props) {
  const { data: banners, isLoading } = useTradeBanners();
  const deleteBanner = useDeleteBanner();
  const updateBanner = useUpdateBanner();

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  return (
    <div className="rounded-2xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-20">Imagem</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {banners?.map((banner) => {
            const status = getStatus(banner);
            return (
              <TableRow key={banner.id}>
                <TableCell>
                  <img src={banner.imagem_url} alt="" className="w-16 h-10 object-cover rounded-lg" />
                </TableCell>
                <TableCell className="font-medium">{banner.titulo}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(banner.data_inicio), "dd/MM/yy", { locale: ptBR })}
                  {banner.data_fim && ` — ${format(new Date(banner.data_fim), "dd/MM/yy", { locale: ptBR })}`}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => onEdit(banner)}><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDuplicate(banner)}><Copy className="h-4 w-4" /></Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => updateBanner.mutate({ id: banner.id, ativo: !banner.ativo })}
                    >
                      {banner.ativo ? <ToggleRight className="h-4 w-4 text-success" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteBanner.mutate(banner.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {!banners?.length && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                Nenhum banner cadastrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
