import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, FileText, User, Calendar, History, Download, Filter } from "lucide-react";
import * as XLSX from 'xlsx';

interface PlanoContasAuditoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AuditRecord {
  id: string;
  conta_id: string | null;
  conta_codigo: string | null;
  conta_nome: string | null;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  tipo_alteracao: string;
  justificativa: string | null;
  usuario_id: string;
  usuario_email: string | null;
  usuario_nome: string | null;
  created_at: string;
}

const TIPO_ALTERACAO_LABELS: Record<string, string> = {
  'categoria_dre': 'Categoria DRE',
  'departamento': 'Departamento',
  'reclassificacao': 'Reclassificação',
  'exclusao': 'Exclusão',
  'criacao': 'Criação',
  'edicao': 'Edição',
};

const TIPO_ALTERACAO_COLORS: Record<string, string> = {
  'categoria_dre': 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  'departamento': 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  'reclassificacao': 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  'exclusao': 'bg-red-500/20 text-red-700 border-red-500/30',
  'criacao': 'bg-green-500/20 text-green-700 border-green-500/30',
  'edicao': 'bg-gray-500/20 text-gray-700 border-gray-500/30',
};

export function PlanoContasAuditoriaDialog({
  open,
  onOpenChange
}: PlanoContasAuditoriaDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");

  const { data: auditRecords, isLoading } = useQuery({
    queryKey: ['plano-contas-auditoria'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_contas_auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as AuditRecord[];
    },
    enabled: open
  });

  const filteredRecords = (auditRecords || []).filter(record => {
    const matchSearch = searchTerm === "" ||
      record.conta_codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.conta_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.usuario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.justificativa?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchTipo = filterTipo === "todos" || record.tipo_alteracao === filterTipo;

    return matchSearch && matchTipo;
  });

  const exportToExcel = () => {
    const exportData = filteredRecords.map(record => ({
      'Data/Hora': format(new Date(record.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      'Código Conta': record.conta_codigo || '-',
      'Nome Conta': record.conta_nome || '-',
      'Tipo Alteração': TIPO_ALTERACAO_LABELS[record.tipo_alteracao] || record.tipo_alteracao,
      'Campo Alterado': record.campo_alterado,
      'Valor Anterior': record.valor_anterior || '-',
      'Valor Novo': record.valor_novo || '-',
      'Usuário': record.usuario_nome || record.usuario_email || '-',
      'Justificativa': record.justificativa || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria');
    XLSX.writeFile(wb, `auditoria_plano_contas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Alterações - Plano de Contas
          </DialogTitle>
          <DialogDescription>
            Registro completo de todas as alterações realizadas no plano de contas e classificações DRE.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por conta, usuário ou justificativa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(TIPO_ALTERACAO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{filteredRecords.length} registro(s) encontrado(s)</span>
          </div>

          {/* Table */}
          <ScrollArea className="h-[500px] border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-36">Data/Hora</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="w-32">Tipo</TableHead>
                  <TableHead>Alteração</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Justificativa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum registro de auditoria encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(record.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.conta_codigo && (
                          <Badge variant="outline" className="font-mono text-xs mr-1">
                            {record.conta_codigo}
                          </Badge>
                        )}
                        <span className="text-sm">{record.conta_nome || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${TIPO_ALTERACAO_COLORS[record.tipo_alteracao] || ''}`}
                        >
                          {TIPO_ALTERACAO_LABELS[record.tipo_alteracao] || record.tipo_alteracao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="space-y-1">
                          <div className="text-muted-foreground">{record.campo_alterado}</div>
                          {record.valor_anterior && (
                            <div>
                              <span className="text-red-500 line-through">{record.valor_anterior}</span>
                              {' → '}
                              <span className="text-green-600">{record.valor_novo}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {record.usuario_nome || record.usuario_email || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-xs text-muted-foreground truncate" title={record.justificativa || ''}>
                          {record.justificativa || '-'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
