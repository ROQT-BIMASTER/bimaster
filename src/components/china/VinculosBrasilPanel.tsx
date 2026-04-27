import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Factory, ShoppingBag, Package2, User, Calendar, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { useVinculosPorOC, useRemoverVinculo } from "@/hooks/useComprasInternacionalVinculos";
import { VincularBrasilDialog } from "@/components/compras/VincularBrasilDialog";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  ocId: string;
  numeroOC: string;
  produtoNome?: string;
}

export function VinculosBrasilPanel({ ocId, numeroOC, produtoNome }: Props) {
  const { isBrasilUser } = useChinaUserContext();
  const { data: vinculos = [], isLoading } = useVinculosPorOC(ocId);
  const remover = useRemoverVinculo();
  const [openVincular, setOpenVincular] = useState(false);
  const [confirmRemover, setConfirmRemover] = useState<string | null>(null);

  // Buscar nomes dos criadores
  const userIds = Array.from(
    new Set(vinculos.map((v: any) => v.created_by).filter(Boolean)),
  ) as string[];
  const { data: profiles = [] } = useQuery({
    queryKey: ["civ-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      return data || [];
    },
  });
  const nomes = new Map((profiles as any[]).map((p) => [p.id, p.full_name]));

  const totalAlocado = vinculos.reduce((s, v) => s + Number(v.qty_alocada || 0), 0);

  return (
    <>
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <BilingualLabel
              pt="Vínculos com o Brasil"
              cn="与巴西的关联"
              size="md"
              className="mb-1"
            />
            <p className="text-xs text-muted-foreground">
              Auditoria das alocações desta OC para OPs, compras nacionais e matérias-primas no Brasil.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {vinculos.length > 0 && (
              <Badge variant="outline" className="font-mono">
                {totalAlocado.toLocaleString("pt-BR")} alocado
              </Badge>
            )}
            {isBrasilUser && (
              <Button size="sm" onClick={() => setOpenVincular(true)} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Vincular Brasil
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : vinculos.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <Link2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum vínculo registrado ainda.
            </p>
            {isBrasilUser && (
              <p className="text-xs text-muted-foreground mt-1">
                Use "Vincular Brasil" para alocar esta OC a uma OP, compra ou MP.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {vinculos.map((v: any) => {
              const tipo = v.fabrica_op
                ? { icon: Factory, label: "OP Fábrica", value: v.fabrica_op.numero, sub: v.fabrica_op.status }
                : v.fabrica_compra
                  ? { icon: ShoppingBag, label: "Compra Nacional", value: v.fabrica_compra.nota_fiscal || v.fabrica_compra.id.slice(0, 8), sub: null }
                  : v.fabrica_mp
                    ? { icon: Package2, label: "Matéria-Prima", value: v.fabrica_mp.nome, sub: null }
                    : { icon: Link2, label: "Vínculo", value: "—", sub: null };
              const Icon = tipo.icon;
              return (
                <div
                  key={v.id}
                  className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {tipo.label}
                        </Badge>
                        <span className="font-medium text-sm truncate">{tipo.value}</span>
                        {tipo.sub && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {tipo.sub}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(v.created_at).toLocaleString("pt-BR")}
                        </span>
                        {v.created_by && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {nomes.get(v.created_by) || v.created_by.slice(0, 8)}
                          </span>
                        )}
                      </div>
                      {v.observacoes && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                          "{v.observacoes}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant="default" className="font-mono">
                      {Number(v.qty_alocada).toLocaleString("pt-BR")}
                    </Badge>
                    {isBrasilUser && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setConfirmRemover(v.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <VincularBrasilDialog
        open={openVincular}
        onOpenChange={setOpenVincular}
        ocId={ocId}
        ocNumero={numeroOC}
        produtoNome={produtoNome}
      />

      <AlertDialog open={!!confirmRemover} onOpenChange={(o) => !o && setConfirmRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O vínculo será removido permanentemente do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmRemover) {
                  await remover.mutateAsync(confirmRemover);
                  setConfirmRemover(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
