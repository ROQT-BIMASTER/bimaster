import { useState } from "react";
import { Shield, ShieldAlert, Lock, Unlock, History, AlertTriangle, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useBuckets,
  useChangeBucketVisibility,
  useVisibilityAuditLog,
} from "@/hooks/useStorageManagement";

export default function StorageManagementPanel() {
  const { data: buckets, isLoading: bucketsLoading } = useBuckets();
  const { data: auditLog, isLoading: auditLoading } = useVisibilityAuditLog();
  const changeMutation = useChangeBucketVisibility();

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    bucketId: string;
    makePublic: boolean;
  }>({ open: false, bucketId: "", makePublic: false });
  const [reason, setReason] = useState("");

  const privateBuckets = buckets?.filter((b) => !b.public) || [];
  const publicBuckets = buckets?.filter((b) => b.public) || [];

  const handleToggle = (bucketId: string, currentPublic: boolean) => {
    if (!currentPublic) {
      // Making public — requires confirmation
      setConfirmDialog({ open: true, bucketId, makePublic: true });
      setReason("");
    } else {
      // Making private — safe, just do it
      changeMutation.mutate({ bucketId, makePublic: false, reason: "Convertido para privado" });
    }
  };

  const confirmMakePublic = () => {
    if (!reason.trim()) return;
    changeMutation.mutate({
      bucketId: confirmDialog.bucketId,
      makePublic: true,
      reason: reason.trim(),
    });
    setConfirmDialog({ open: false, bucketId: "", makePublic: false });
    setReason("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Gestão de Armazenamento</h2>
          <p className="text-sm text-muted-foreground">
            Controle de visibilidade e auditoria de buckets
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4 flex items-center gap-3">
            <Lock className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-500">{privateBuckets.length}</p>
              <p className="text-sm text-muted-foreground">Buckets Privados</p>
            </div>
          </CardContent>
        </Card>
        <Card className={publicBuckets.length > 0 ? "border-orange-500/30 bg-orange-500/5" : "border-green-500/30 bg-green-500/5"}>
          <CardContent className="pt-4 flex items-center gap-3">
            {publicBuckets.length > 0 ? (
              <ShieldAlert className="h-8 w-8 text-orange-500" />
            ) : (
              <Check className="h-8 w-8 text-green-500" />
            )}
            <div>
              <p className={`text-2xl font-bold ${publicBuckets.length > 0 ? "text-orange-500" : "text-green-500"}`}>
                {publicBuckets.length}
              </p>
              <p className="text-sm text-muted-foreground">Buckets Públicos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <History className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{auditLog?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Alterações Registradas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="buckets">
        <TabsList>
          <TabsTrigger value="buckets">Buckets</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        {/* Buckets Tab */}
        <TabsContent value="buckets" className="space-y-3 mt-4">
          {bucketsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))
          ) : (
            buckets?.map((bucket) => (
              <Card key={bucket.id} className={`transition-colors ${bucket.public ? "border-orange-500/40" : "border-border"}`}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {bucket.public ? (
                      <Unlock className="h-5 w-5 text-orange-500" />
                    ) : (
                      <Lock className="h-5 w-5 text-green-500" />
                    )}
                    <div>
                      <p className="font-medium">{bucket.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Criado em {format(new Date(bucket.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={bucket.public ? "destructive" : "default"}
                      className={bucket.public ? "bg-orange-500/20 text-orange-500 border-orange-500/30" : "bg-green-500/20 text-green-500 border-green-500/30"}
                    >
                      {bucket.public ? "PÚBLICO" : "PRIVADO"}
                    </Badge>
                    <Button
                      size="sm"
                      variant={bucket.public ? "default" : "outline"}
                      onClick={() => handleToggle(bucket.id, bucket.public)}
                      disabled={changeMutation.isPending}
                      className={bucket.public ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {bucket.public ? (
                        <>
                          <Lock className="h-3.5 w-3.5 mr-1" /> Tornar Privado
                        </>
                      ) : (
                        <>
                          <Unlock className="h-3.5 w-3.5 mr-1" /> Tornar Público
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" /> Log de Alterações de Visibilidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : !auditLog?.length ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Nenhuma alteração registrada
                </p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {auditLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="mt-0.5">
                        {entry.new_visibility === "public" ? (
                          <ShieldAlert className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Lock className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{entry.entity_name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {entry.old_visibility} → {entry.new_visibility}
                          </Badge>
                        </div>
                        {entry.reason && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Motivo: {entry.reason}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {entry.changed_by_name || "Sistema"} •{" "}
                          {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog for making public */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog({ open: false, bucketId: "", makePublic: false });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-500">
              <AlertTriangle className="h-5 w-5" />
              Tornar bucket público?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a tornar o bucket{" "}
                <strong className="text-foreground">"{confirmDialog.bucketId}"</strong> público.
                Isso significa que <strong className="text-destructive">qualquer pessoa com o link</strong>{" "}
                poderá acessar os arquivos.
              </p>
              <p className="text-destructive font-medium">
                ⚠️ Dados sensíveis podem ser expostos. Esta ação será registrada na auditoria.
              </p>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Justificativa obrigatória:
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explique por que este bucket precisa ser público..."
                  className="min-h-[80px]"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmMakePublic}
              disabled={!reason.trim()}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Confirmar — Tornar Público
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
