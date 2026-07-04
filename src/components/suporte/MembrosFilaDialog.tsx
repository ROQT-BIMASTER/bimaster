import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Crown, User, Search, X, UserPlus, Loader2 } from "lucide-react";
import {
  useFilaMembros,
  useFilaMembrosMutations,
  useChatDirectory,
} from "@/hooks/suporte/useFilaMembros";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filaId: string;
  filaNome: string;
}

function initials(nome: string) {
  return nome
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MembrosFilaDialog({ open, onOpenChange, filaId, filaNome }: Props) {
  const { isAdmin } = useUserRole();
  const { data: membros = [], isLoading } = useFilaMembros(filaId);
  const { acao } = useFilaMembrosMutations(filaId);

  const [aba, setAba] = useState<"lista" | "adicionar">("lista");
  const [termo, setTermo] = useState("");
  const { data: dir = [] } = useChatDirectory(termo);

  const membroIds = useMemo(() => new Set(membros.map((m) => m.user_id)), [membros]);
  const candidatos = useMemo(
    () => dir.filter((d) => !membroIds.has(d.id)),
    [dir, membroIds],
  );

  const [removerAlvo, setRemoverAlvo] = useState<{ user_id: string; nome: string } | null>(
    null,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Membros — {filaNome}
              <Badge variant="secondary" className="ml-1">
                {membros.length}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Quem está aqui atende os chamados do departamento e participa das conversas
              dos tickets. {isAdmin ? "" : "Apenas administradores gerenciam líderes."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1 border-b">
            <button
              className={`px-3 py-2 text-sm font-medium border-b-2 ${
                aba === "lista" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
              }`}
              onClick={() => setAba("lista")}
            >
              Membros ativos
            </button>
            <button
              className={`px-3 py-2 text-sm font-medium border-b-2 gap-1.5 inline-flex items-center ${
                aba === "adicionar" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
              }`}
              onClick={() => setAba("adicionar")}
            >
              <UserPlus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {aba === "lista" ? (
              isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : membros.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhum membro ativo. Use "Adicionar" para vincular.
                </p>
              ) : (
                <ul className="divide-y">
                  {membros.map((m) => (
                    <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                      <Avatar className="h-9 w-9">
                        {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.nome} />}
                        <AvatarFallback>{initials(m.nome)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{m.nome}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          {m.papel === "lider" ? (
                            <>
                              <Crown className="h-3 w-3 text-amber-500" /> Líder
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3" /> Agente
                            </>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <Select
                          value={m.papel}
                          onValueChange={(v) =>
                            acao.mutate({
                              user_id: m.user_id,
                              acao: "papel",
                              papel: v as "agente" | "lider",
                            })
                          }
                          disabled={acao.isPending}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agente">Agente</SelectItem>
                            <SelectItem value="lider">Líder</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        disabled={acao.isPending}
                        onClick={() =>
                          setRemoverAlvo({ user_id: m.user_id, nome: m.nome })
                        }
                        aria-label="Remover membro"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="pl-8 h-9"
                    placeholder="Buscar pessoa pelo nome…"
                    value={termo}
                    onChange={(e) => setTermo(e.target.value)}
                  />
                </div>
                {candidatos.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nenhum candidato encontrado.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {candidatos.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 py-2">
                        <Avatar className="h-8 w-8">
                          {c.avatar_url && <AvatarImage src={c.avatar_url} alt={c.nome} />}
                          <AvatarFallback>{initials(c.nome ?? "")}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-sm truncate">{c.nome}</div>
                        {isAdmin ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              disabled={acao.isPending}
                              onClick={() =>
                                acao.mutate({
                                  user_id: c.id,
                                  acao: "adicionar",
                                  papel: "agente",
                                })
                              }
                            >
                              Agente
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              disabled={acao.isPending}
                              onClick={() =>
                                acao.mutate({
                                  user_id: c.id,
                                  acao: "adicionar",
                                  papel: "lider",
                                })
                              }
                            >
                              <Crown className="h-3 w-3 text-amber-500" /> Líder
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            className="h-8"
                            disabled={acao.isPending}
                            onClick={() =>
                              acao.mutate({
                                user_id: c.id,
                                acao: "adicionar",
                                papel: "agente",
                              })
                            }
                          >
                            Adicionar
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!removerAlvo}
        onOpenChange={(v) => !v && setRemoverAlvo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {removerAlvo?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O vínculo é desativado (histórico preservado). Os chamados abertos que
              esta pessoa atendia voltam para o pool do departamento, sem responsável.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removerAlvo) {
                  acao.mutate({ user_id: removerAlvo.user_id, acao: "remover" });
                  setRemoverAlvo(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
