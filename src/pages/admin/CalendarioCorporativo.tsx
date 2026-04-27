import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarDays, RefreshCw, Plus, Trash2, Loader2 } from "lucide-react";
import { useFeriados, type Feriado } from "@/hooks/useFeriados";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPOS = [
  { value: "nacional", label: "Nacional" },
  { value: "estadual", label: "Estadual" },
  { value: "municipal", label: "Municipal" },
  { value: "empresa", label: "Empresa" },
];

export default function CalendarioCorporativo() {
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const { feriados, isLoading, sincronizar, criarFeriado, removerFeriado } = useFeriados(ano);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoData, setNovoData] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<Feriado["tipo"]>("empresa");
  const [novoUf, setNovoUf] = useState("");

  const adicionar = async () => {
    if (!novoData || !novoNome) return;
    await criarFeriado.mutateAsync({
      data: novoData,
      nome: novoNome,
      tipo: novoTipo,
      uf: novoUf || null,
      ano: parseInt(novoData.split("-")[0]),
    });
    setNovoData("");
    setNovoNome("");
    setNovoUf("");
    setDialogOpen(false);
  };

  const tipoBadge = (tipo: string) => {
    const map: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      nacional: "default",
      estadual: "secondary",
      municipal: "outline",
      empresa: "outline",
    };
    return map[tipo] || "outline";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <CalendarDays className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Calendário Corporativo</h1>
            </div>

            <Card>
              <CardContent className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Ano:</Label>
                  <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v))}>
                    <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027, 2028].map((a) => (
                        <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sincronizar.mutate()}
                    disabled={sincronizar.isPending}
                  >
                    {sincronizar.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Sincronizar BrasilAPI
                  </Button>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo feriado
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar feriado</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Data</Label>
                          <Input type="date" value={novoData} onChange={(e) => setNovoData(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Aniversário da empresa" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={novoTipo} onValueChange={(v: any) => setNovoTipo(v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>UF (opcional)</Label>
                            <Input value={novoUf} onChange={(e) => setNovoUf(e.target.value.toUpperCase())} placeholder="SP, RJ..." maxLength={2} />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={adicionar} disabled={!novoData || !novoNome || criarFeriado.isPending}>
                          {criarFeriado.isPending ? "Salvando..." : "Adicionar"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Feriados de {ano}
                  <Badge variant="outline" className="text-[10px]">{feriados.length} cadastrados</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-sm text-muted-foreground text-center py-8">Carregando…</div>
                ) : feriados.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    Nenhum feriado cadastrado para {ano}. Use "Sincronizar BrasilAPI" para importar os feriados nacionais.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {feriados.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                        <div className="w-14 text-center">
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(f.data), "MMM", { locale: ptBR }).toUpperCase()}
                          </div>
                          <div className="text-lg font-bold">
                            {format(parseISO(f.data), "dd")}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={tipoBadge(f.tipo)} className="text-[9px]">
                              {TIPOS.find((t) => t.value === f.tipo)?.label || f.tipo}
                            </Badge>
                            {f.uf && <Badge variant="outline" className="text-[9px]">{f.uf}</Badge>}
                            <span className="text-[10px] text-muted-foreground">
                              fonte: {f.fonte}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            if (confirm(`Remover feriado "${f.nome}"?`)) removerFeriado.mutate(f.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
