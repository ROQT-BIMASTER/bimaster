import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAsanaSync } from "@/hooks/useAsanaSync";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Link2, FolderKanban, ListTodo, MessageSquare, Users, RefreshCw, Sparkles, Copy, Check, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

export default function AsanaIntegracao() {
  const navigate = useNavigate();
  const { testConnection, listProjects, syncProjects, getSyncLogs, analyzeStructure, loading, syncStatus } = useAsanaSync();

  const [step, setStep] = useState(1);
  const [pat, setPat] = useState(() => localStorage.getItem("asana_pat") || "");

  // Persist PAT to localStorage
  const handlePatChange = (value: string) => {
    setPat(value);
    if (value) {
      localStorage.setItem("asana_pat", value);
    } else {
      localStorage.removeItem("asana_pat");
    }
  };
  const [userName, setUserName] = useState("");
  const [workspaces, setWorkspaces] = useState<{ gid: string; name: string }[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);

  useEffect(() => {
    getSyncLogs().then(setLogs);
  }, []);

  async function handleTestConnection() {
    try {
      const result = await testConnection(pat);
      setUserName(result.user.name);
      setWorkspaces(result.workspaces);
      setStep(2);
    } catch {
      // error handled in hook
    }
  }

  async function handleSelectWorkspace(gid: string) {
    setSelectedWorkspace(gid);
    try {
      const projs = await listProjects(pat, gid);
      setProjects(projs);
      setStep(3);
    } catch {
      // error handled in hook
    }
  }

  function toggleProject(gid: string) {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  }

  function toggleAll() {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(projects.map((p) => p.gid)));
    }
  }

  async function handleSync() {
    if (selectedProjects.size === 0) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncProjects(pat, selectedWorkspace, Array.from(selectedProjects));
      setSyncResult(result);
      setStep(4);
      getSyncLogs().then(setLogs);
    } catch {
      // error handled in hook
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integração Asana</h1>
          <p className="text-muted-foreground text-sm">Importe projetos, tarefas e comentários do Asana</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            {s < 4 && <div className={`w-8 h-0.5 ${s < step ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
        <span className="text-xs text-muted-foreground ml-2">
          {step === 1 && "Conexão"}
          {step === 2 && "Workspace"}
          {step === 3 && "Projetos"}
          {step === 4 && "Resultado"}
        </span>
      </div>

      {/* Step 1: PAT */}
      {step >= 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5" /> Conexão com Asana
            </CardTitle>
            <CardDescription>
              Cole seu Personal Access Token do Asana.{" "}
              <a
                href="https://app.asana.com/0/my-apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Criar token →
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Personal Access Token</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="1/1234567890:abcdef..."
                  value={pat}
                  onChange={(e) => handlePatChange(e.target.value)}
                  disabled={step > 1}
                />
                {step === 1 ? (
                  <Button onClick={handleTestConnection} disabled={!pat || loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep(1);
                      setWorkspaces([]);
                      setProjects([]);
                      setSelectedProjects(new Set());
                      setSyncResult(null);
                    }}
                  >
                    Alterar
                  </Button>
                )}
              </div>
            </div>
            {userName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Conectado como <strong>{userName}</strong>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Workspace */}
      {step >= 2 && workspaces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderKanban className="h-5 w-5" /> Workspace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedWorkspace}
              onValueChange={handleSelectWorkspace}
              disabled={step > 2 || loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.gid} value={w.gid}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      {step >= 2 && selectedWorkspace && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5" /> Análise Inteligente de Estrutura
            </CardTitle>
            <CardDescription>
              A IA analisa todos os campos, custom fields, tags e dependências do Asana e compara com o sistema local
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!analysisReport && !analyzing && (
              <Button
                onClick={async () => {
                  setAnalyzing(true);
                  try {
                    const result = await analyzeStructure(pat, selectedWorkspace);
                    setAnalysisReport(result.report);
                  } catch {
                    // handled in hook
                  } finally {
                    setAnalyzing(false);
                  }
                }}
                disabled={loading}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Analisar Estrutura com IA
              </Button>
            )}

            {analyzing && (
              <div className="py-8 flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Analisando estrutura do Asana com IA... Isso pode levar alguns segundos.
                </p>
              </div>
            )}

            {analysisReport && (
              <>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setAnalyzing(true);
                      setAnalysisReport(null);
                      try {
                        const result = await analyzeStructure(pat, selectedWorkspace);
                        setAnalysisReport(result.report);
                      } catch {
                        // handled
                      } finally {
                        setAnalyzing(false);
                      }
                    }}
                    className="gap-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reanalisar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(analysisReport);
                      setReportCopied(true);
                      toast.success("Relatório copiado!");
                      setTimeout(() => setReportCopied(false), 2000);
                    }}
                    className="gap-1"
                  >
                    {reportCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {reportCopied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
                <ScrollArea className="max-h-[60vh]">
                  <div className="prose prose-sm max-w-none dark:prose-invert px-2">
                    <ReactMarkdown>{analysisReport}</ReactMarkdown>
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Projects selection */}
      {step >= 3 && projects.length > 0 && !syncing && step < 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListTodo className="h-5 w-5" /> Projetos ({projects.length})
            </CardTitle>
            <CardDescription>Selecione quais projetos importar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selectedProjects.size === projects.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
              <Badge variant="secondary">{selectedProjects.size} selecionados</Badge>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
              {projects.map((p) => (
                <label
                  key={p.gid}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={selectedProjects.has(p.gid)}
                    onCheckedChange={() => toggleProject(p.gid)}
                  />
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color || "#6366f1" }}
                  />
                  <span className="text-sm">{p.name}</span>
                </label>
              ))}
            </div>

            <Button
              onClick={handleSync}
              disabled={selectedProjects.size === 0 || loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Importar {selectedProjects.size} projeto(s)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Syncing state */}
      {syncing && (
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {syncStatus || "Sincronizando projetos do Asana..."}
            </p>
            <Progress value={undefined} className="w-64" />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 4 && syncResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {syncResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              Resultado da Importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard icon={FolderKanban} label="Projetos" value={syncResult.projects_synced} />
              <StatCard icon={ListTodo} label="Seções" value={syncResult.sections_synced} />
              <StatCard icon={ListTodo} label="Tarefas" value={syncResult.tasks_synced} />
              <StatCard icon={MessageSquare} label="Comentários" value={syncResult.comments_synced} />
              <StatCard icon={Users} label="Usuários" value={syncResult.users_mapped} />
            </div>

            {syncResult.errors?.length > 0 && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                <p className="text-sm font-medium text-destructive mb-2">
                  {syncResult.errors.length} erro(s):
                </p>
                {syncResult.errors.map((e: any, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {JSON.stringify(e)}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(3);
                  setSyncResult(null);
                }}
              >
                Importar mais
              </Button>
              <Button onClick={() => navigate("/dashboard/projetos")}>
                Ver Projetos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync history */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Sincronizações</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Projetos</TableHead>
                  <TableHead>Tarefas</TableHead>
                  <TableHead>Comentários</TableHead>
                  <TableHead>Erros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === "completed"
                            ? "default"
                            : log.status === "running"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {log.status === "completed" ? "Concluído" : log.status === "running" ? "Em andamento" : "Falhou"}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.projects_synced}</TableCell>
                    <TableCell>{log.tasks_synced}</TableCell>
                    <TableCell>{log.comments_synced}</TableCell>
                    <TableCell>
                      {(log.errors as any[])?.length || 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="text-center p-3 bg-muted/50 rounded-lg">
      <Icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
