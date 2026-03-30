import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, FileText, Link2, Loader2, Eye } from "lucide-react";
import { AuditChinaVinculoBadge } from "@/components/china/AuditChinaVinculoBadge";
import { CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { cn } from "@/lib/utils";

function getDocTypeLabel(tipo: string) {
  const dt = CHINA_DOCUMENT_TYPES.find(d => d.tipo === tipo);
  return dt ? dt.labelPt : tipo;
}

interface Props {
  submissaoId: string;
  secoes: any[];
  tarefas: any[];
  vinculos: any[];
  docVinculos: any[];
  documentos: any[];
  checkedTarefas: Set<string>;
  onToggleTarefa: (id: string) => void;
  onVincular: () => void;
  onToggleDocVinculo: (docId: string, tarefaId: string) => void;
  vinculosPending: boolean;
  auditResult: any;
  auditLoading: boolean;
  onPreviewDoc: (doc: any) => void;
}

export function VincularChinaVincularTab({
  submissaoId, secoes, tarefas, vinculos, docVinculos, documentos,
  checkedTarefas, onToggleTarefa, onVincular, onToggleDocVinculo,
  vinculosPending, auditResult, auditLoading, onPreviewDoc,
}: Props) {
  const [selectedTarefaForDocs, setSelectedTarefaForDocs] = useState<string | null>(null);

  const vinculosByTarefa = new Map<string, string>();
  vinculos.forEach((v: any) => vinculosByTarefa.set(v.tarefa_id, v.id));

  const docVinculoMap = new Map<string, string>();
  docVinculos.forEach((v: any) => docVinculoMap.set(`${v.documento_id}-${v.tarefa_id}`, v.id));

  return (
    <div className="space-y-3">
      {secoes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma seção no projeto</p>
      ) : (
        secoes.map((secao: any) => {
          const secaoTarefas = tarefas.filter((t: any) => t.secao_id === secao.id);
          if (secaoTarefas.length === 0) return null;
          return (
            <div key={secao.id}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{secao.nome}</p>
              <div className="space-y-0.5">
                {secaoTarefas.map((tarefa: any) => {
                  const isLinked = vinculosByTarefa.has(tarefa.id);
                  const isChecked = checkedTarefas.has(tarefa.id);
                  const docCount = docVinculos.filter((dv: any) => dv.tarefa_id === tarefa.id).length;
                  const isDocTarget = selectedTarefaForDocs === tarefa.id;
                  return (
                    <div
                      key={tarefa.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-xs",
                        isLinked && "bg-success/5",
                        isDocTarget && "ring-1 ring-primary/30 bg-primary/5"
                      )}
                    >
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        {isLinked ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        ) : (
                          <Checkbox checked={isChecked} onCheckedChange={() => onToggleTarefa(tarefa.id)} />
                        )}
                        <span className="truncate">{tarefa.titulo}</span>
                      </label>
                      {docCount > 0 && (
                        <Badge variant="secondary" className="text-[9px] h-4">
                          <FileText className="h-2.5 w-2.5 mr-0.5" />{docCount}
                        </Badge>
                      )}
                      {isLinked && (
                        <Button
                          variant={isDocTarget ? "default" : "ghost"}
                          size="sm"
                          className="h-6 px-1.5 text-[10px]"
                          onClick={() => setSelectedTarefaForDocs(isDocTarget ? null : tarefa.id)}
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Vincular button */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <AuditChinaVinculoBadge result={auditResult} loading={auditLoading} />
        <Button
          onClick={onVincular}
          disabled={checkedTarefas.size === 0 || vinculosPending}
          className="ml-auto"
          size="sm"
        >
          {vinculosPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Link2 className="h-3.5 w-3.5 mr-1" />}
          Vincular {checkedTarefas.size > 0 ? `(${checkedTarefas.size})` : ""}
        </Button>
      </div>

      {/* Docs for selected tarefa */}
      {selectedTarefaForDocs && documentos.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vincular Documentos</p>
          {documentos.map((doc: any) => {
            const key = `${doc.id}-${selectedTarefaForDocs}`;
            const isDocLinked = docVinculoMap.has(key);
            return (
              <div
                key={doc.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs transition-colors",
                  isDocLinked ? "bg-success/5 border-success/20" : "border-border"
                )}
              >
                <Checkbox
                  checked={isDocLinked}
                  onCheckedChange={() => onToggleDocVinculo(doc.id, selectedTarefaForDocs)}
                />
                <span className="flex-1 truncate">{doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onPreviewDoc(doc)}>
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
