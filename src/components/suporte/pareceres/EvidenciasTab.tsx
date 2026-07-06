import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  Eye,
  FileText,
  Link2,
  Lock,
  MoreVertical,
  Plus,
  ShieldCheck,
  History,
  FileArchive,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  useTicketEvidencias,
  useBaixarEvidencia,
  useBloquearEvidencia,
  useEvidenciaAutores,
  CATEGORIA_LABEL,
  type EvidenciaCategoria,
  type SuporteEvidencia,
} from "@/hooks/suporte/useEvidencias";
import { EvidenciaUploadDialog } from "./EvidenciaUploadDialog";
import { EvidenciaAcessosDialog } from "./EvidenciaAcessosDialog";
import { EvidenciaPreviewDialog } from "./EvidenciaPreviewDialog";
import { EvidenciaVinculoDialog } from "./EvidenciaVinculoDialog";
import { gerarDossieJuridico } from "@/lib/suporte/exportarDossie";

interface Props {
  ticketId: string;
  canWrite: boolean;
  isAdmin?: boolean;
}

type SortKey = "data_desc" | "data_asc" | "nome" | "tamanho_desc";

export function EvidenciasTab({ ticketId, canWrite, isAdmin = false }: Props) {
  const { data: evidencias = [], isLoading } = useTicketEvidencias(ticketId);
  const { data: autoresMap } = useEvidenciaAutores(evidencias);
  const baixar = useBaixarEvidencia();
  const bloquear = useBloquearEvidencia();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [acessosOpen, setAcessosOpen] = useState(false);
  const [acessosEvid, setAcessosEvid] = useState<SuporteEvidencia | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewEvid, setPreviewEvid] = useState<SuporteEvidencia | null>(null);
  const [vincOpen, setVincOpen] = useState(false);
  const [vincEvid, setVincEvid] = useState<SuporteEvidencia | null>(null);

  // filtros
  const [q, setQ] = useState("");
  const [filtroCat, setFiltroCat] = useState<string>("todas");
  const [filtroAutor, setFiltroAutor] = useState<string>("todos");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [somenteRetencao, setSomenteRetencao] = useState(false);
  const [somenteVinculados, setSomenteVinculados] = useState(false);
  const [sort, setSort] = useState<SortKey>("data_desc");

  const [exportando, setExportando] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const autoresUnicos = useMemo(() => {
    const ids = Array.from(new Set(evidencias.map((e) => e.uploaded_by)));
    return ids.map((id) => ({
      id,
      nome: autoresMap?.get(id)?.nome ?? id.slice(0, 8),
    }));
  }, [evidencias, autoresMap]);

  const filtered = useMemo(() => {
    const qNorm = q.trim().toLowerCase();
    const dFrom = dataDe ? startOfDay(parseISO(dataDe)) : null;
    const dTo = dataAte ? endOfDay(parseISO(dataAte)) : null;

    let out = evidencias.filter((e) => {
      if (filtroCat !== "todas" && e.categoria !== filtroCat) return false;
      if (filtroAutor !== "todos" && e.uploaded_by !== filtroAutor) return false;
      if (somenteRetencao && !e.locked_juridico) return false;
      if (somenteVinculados && !e.parecer_id && !e.trilha_id) return false;
      if (qNorm) {
        const hay = [
          e.nome_arquivo,
          e.descricao ?? "",
          e.hash_sha256,
          CATEGORIA_LABEL[e.categoria],
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qNorm)) return false;
      }
      const dt = new Date(e.created_at);
      if (dFrom && isBefore(dt, dFrom)) return false;
      if (dTo && isAfter(dt, dTo)) return false;
      return true;
    });

    out = [...out].sort((a, b) => {
      switch (sort) {
        case "data_asc":
          return a.created_at.localeCompare(b.created_at);
        case "nome":
          return a.nome_arquivo.localeCompare(b.nome_arquivo);
        case "tamanho_desc":
          return (b.tamanho ?? 0) - (a.tamanho ?? 0);
        case "data_desc":
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return out;
  }, [
    evidencias,
    q,
    filtroCat,
    filtroAutor,
    dataDe,
    dataAte,
    somenteRetencao,
    somenteVinculados,
    sort,
  ]);

  const filtrosAtivos =
    q ||
    filtroCat !== "todas" ||
    filtroAutor !== "todos" ||
    dataDe ||
    dataAte ||
    somenteRetencao ||
    somenteVinculados;

  function limparFiltros() {
    setQ("");
    setFiltroCat("todas");
    setFiltroAutor("todos");
    setDataDe("");
    setDataAte("");
    setSomenteRetencao(false);
    setSomenteVinculados(false);
  }

  function verAcessos(e: SuporteEvidencia) {
    setAcessosEvid(e);
    setAcessosOpen(true);
  }
  function abrirPreview(e: SuporteEvidencia) {
    setPreviewEvid(e);
    setPreviewOpen(true);
  }
  function abrirVinculo(e: SuporteEvidencia) {
    setVincEvid(e);
    setVincOpen(true);
  }

  async function exportarDossie() {
    if (evidencias.length === 0) {
      toast.error("Sem evidências para exportar");
      return;
    }
    setExportando(true);
    setExportMsg("Iniciando...");
    try {
      const { blob, filename } = await gerarDossieJuridico(
        ticketId,
        filtered.length > 0 ? filtered : evidencias,
        (p) => setExportMsg(`${p.step} (${p.pct}%)`),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Dossiê exportado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar dossiê");
    } finally {
      setExportando(false);
      setExportMsg("");
    }
  }

  return (
    <div className="p-3 space-y-3">
      {/* Barra principal */}
      <div className="flex items-center gap-2 flex-wrap">
        {canWrite && (
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setUploadOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Enviar documento
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8"
          onClick={exportarDossie}
          disabled={exportando || evidencias.length === 0}
        >
          {exportando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileArchive className="h-3.5 w-3.5" />
          )}
          Exportar dossiê jurídico
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {evidencias.length} documento
          {evidencias.length === 1 ? "" : "s"}
        </span>
      </div>

      {exportando && (
        <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
          {exportMsg || "Gerando pacote..."}
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-md border bg-muted/20 p-2 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, descrição, hash..."
              className="h-8 text-xs pl-7"
            />
          </div>
          <Select value={filtroCat} onValueChange={setFiltroCat}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {(Object.keys(CATEGORIA_LABEL) as EvidenciaCategoria[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {CATEGORIA_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroAutor} onValueChange={setFiltroAutor}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos autores</SelectItem>
              {autoresUnicos.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data_desc">Mais recentes</SelectItem>
              <SelectItem value="data_asc">Mais antigos</SelectItem>
              <SelectItem value="nome">Nome (A→Z)</SelectItem>
              <SelectItem value="tamanho_desc">Tamanho</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground">De</span>
            <Input
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className="h-8 text-xs w-[140px]"
            />
            <span className="text-[11px] text-muted-foreground">até</span>
            <Input
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className="h-8 text-xs w-[140px]"
            />
          </div>
          <Button
            size="sm"
            variant={somenteRetencao ? "default" : "outline"}
            className="h-8 text-xs gap-1"
            onClick={() => setSomenteRetencao((v) => !v)}
          >
            <Lock className="h-3 w-3" /> Retenção
          </Button>
          <Button
            size="sm"
            variant={somenteVinculados ? "default" : "outline"}
            className="h-8 text-xs gap-1"
            onClick={() => setSomenteVinculados((v) => !v)}
          >
            <Link2 className="h-3 w-3" /> Vinculados
          </Button>
          {filtrosAtivos && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1 ml-auto"
              onClick={limparFiltros}
            >
              <X className="h-3 w-3" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">
            {evidencias.length === 0
              ? "Nenhum documento neste cofre."
              : "Nenhum documento corresponde aos filtros."}
            {canWrite && evidencias.length === 0 && " Clique em Enviar documento para começar."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => (
            <li key={e.id} className="rounded-md border bg-card p-3 space-y-2">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {e.nome_arquivo}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORIA_LABEL[e.categoria]}
                    </Badge>
                    {e.locked_juridico && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <Lock className="h-3 w-3" /> Retenção jurídica
                      </Badge>
                    )}
                    {e.parecer_id && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Link2 className="h-3 w-3" /> parecer
                      </Badge>
                    )}
                    {e.trilha_id && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Link2 className="h-3 w-3" /> trilha
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    {e.tamanho != null && <span>{(e.tamanho / 1024).toFixed(0)} KB</span>}
                    <span className="font-mono" title={e.hash_sha256}>
                      SHA-256 {e.hash_sha256.slice(0, 10)}…
                    </span>
                    <span>
                      {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                    <span>
                      por {autoresMap?.get(e.uploaded_by)?.nome ?? "—"}
                    </span>
                  </div>
                  {e.descricao && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {e.descricao}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => abrirPreview(e)}
                    title="Visualizar"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() =>
                      baixar.mutate({ evidencia: e, applyWatermark: !isAdmin })
                    }
                    title={isAdmin ? "Baixar original" : "Baixar (com marca em imagens)"}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => abrirVinculo(e)}>
                        <Link2 className="h-3.5 w-3.5 mr-2" />
                        Vincular / desvincular
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => verAcessos(e)}>
                        <History className="h-3.5 w-3.5 mr-2" />
                        Ver cadeia de custódia
                      </DropdownMenuItem>
                      {isAdmin && !e.locked_juridico && (
                        <DropdownMenuItem
                          onClick={() => bloquear.mutate(e.id)}
                          className="text-destructive"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                          Aplicar retenção jurídica
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EvidenciaUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        ticketId={ticketId}
      />
      <EvidenciaAcessosDialog
        open={acessosOpen}
        onOpenChange={setAcessosOpen}
        evidenciaId={acessosEvid?.id ?? null}
        nomeArquivo={acessosEvid?.nome_arquivo}
      />
      <EvidenciaPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        evidencia={previewEvid}
        isAdmin={isAdmin}
      />
      <EvidenciaVinculoDialog
        open={vincOpen}
        onOpenChange={setVincOpen}
        evidencia={vincEvid}
      />
    </div>
  );
}
