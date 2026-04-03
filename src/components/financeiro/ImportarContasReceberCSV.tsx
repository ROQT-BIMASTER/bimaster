import { useState, useCallback } from "react";
import { formatCurrency as formatCurrencyBase } from "@/lib/formatters";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Trash2, Eye, Sparkles, ArrowRight, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportarContasReceberCSVProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ImportStats {
  total: number;
  processed: number;
  inserted: number;
  errors: number;
  errorMessages: string[];
  deleted?: number;
}

interface ParsedRow {
  cliente_codigo: string;
  cliente_nome: string;
  numero_documento: string;
  parcela: number | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_recebimento: string | null;
  valor_original: number | null;
  valor_aberto: number | null;
  valor_recebido: number | null;
  valor_juros: number | null;
  valor_desconto: number | null;
  status: string;
  empresa_id: number;
  empresa_nome: string;
  vendedor_codigo: string;
  vendedor_nome: string;
  tipo_documento: string;
  portador: string;
  observacoes: string;
  dias_atraso: number | null;
}

interface ColumnMapping {
  csv_column: string;
  db_field: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason?: string;
}

interface AIMapResult {
  success: boolean;
  mappings: ColumnMapping[];
  document_field_found: boolean;
  suggestions?: string[];
  dbSchema: string[];
  error?: string;
}

const CHUNK_SIZE = 500;

const DB_FIELDS_LABELS: Record<string, string> = {
  cliente_codigo: "Cód. Cliente",
  cliente_nome: "Nome Cliente",
  numero_documento: "Nº Documento *",
  parcela: "Parcela",
  data_emissao: "Data Emissão",
  data_vencimento: "Data Vencimento",
  data_recebimento: "Data Recebimento",
  valor_original: "Valor Original",
  valor_aberto: "Valor Aberto",
  valor_recebido: "Valor Recebido",
  valor_juros: "Juros",
  valor_desconto: "Desconto",
  status: "Status",
  empresa_id: "ID Empresa",
  empresa_nome: "Nome Empresa",
  vendedor_codigo: "Cód. Vendedor",
  vendedor_nome: "Nome Vendedor",
  tipo_documento: "Tipo Doc.",
  portador: "Portador",
  dias_atraso: "Dias Atraso",
};

export default function ImportarContasReceberCSV({ 
  open, 
  onOpenChange,
  onSuccess 
}: ImportarContasReceberCSVProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'idle' | 'analyzing' | 'mapping' | 'preview' | 'deleting' | 'processing' | 'done'>('idle');
  const [clearExisting, setClearExisting] = useState(true);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [allParsedRows, setAllParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [dbSchema, setDbSchema] = useState<string[]>([]);

  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const detectDelimiter = (firstLine: string): string => {
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    
    if (tabCount > semicolonCount && tabCount > commaCount) return '\t';
    return semicolonCount > commaCount ? ';' : ',';
  };

  const normalizeColumnName = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const parseDate = (value: string): string | null => {
    if (!value || value.trim() === '') return null;
    
    // Try DD/MM/YYYY format
    const brMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Try YYYY-MM-DD format
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return value;
    
    // Try DD-MM-YYYY format
    const dashMatch = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dashMatch) {
      const [, day, month, year] = dashMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return null;
  };

  const parseNumber = (value: string): number | null => {
    if (!value || value.trim() === '') return null;
    // Handle Brazilian number format (1.234,56)
    const normalized = value
      .replace(/\s/g, '')
      .replace(/R\$/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  };

  const mapRowToRecord = (row: Record<string, string>, rowIndex: number): ParsedRow | null => {
    const getValue = (keys: string[]): string => {
      for (const key of keys) {
        const normalizedKey = normalizeColumnName(key);
        for (const [csvCol, value] of Object.entries(row)) {
          const normalizedCsvCol = normalizeColumnName(csvCol);
          if (normalizedCsvCol === normalizedKey || csvCol === key) {
            return value || '';
          }
        }
      }
      return '';
    };

    // Extended list of aliases for common column variations
    const clienteCodigo = getValue([
      'cliente_codigo', 'cod_cliente', 'codigo_cliente', 'cliente', 'cod', 'codigo',
      'codcliente', 'clientecod', 'cli', 'cli_cod', 'id_cliente', 'cliente_id',
      'codigocliente', 'codcli', 'cod_cli'
    ]);
    
    const clienteNome = getValue([
      'cliente_nome', 'nome_cliente', 'razao_social', 'nome', 'razao',
      'nomecliente', 'clientenome', 'cli_nome', 'razao_social_cliente', 'razaosocial',
      'cliente_razao', 'fantasia', 'nome_fantasia'
    ]);
    
    const numeroDocumento = getValue([
      'numero_documento', 'documento', 'num_doc', 'nota', 'nf', 'numero', 'nro_documento',
      'numerodocumento', 'doc', 'nr_doc', 'nr_documento', 'nota_fiscal', 'notafiscal',
      'num_titulo', 'titulo', 'nro', 'numero_titulo', 'numerotitulo', 'nr', 'num',
      'nro_doc', 'numero_doc', 'doc_numero', 'documento_numero', 'nr_nota',
      'documento_nr', 'prefixo', 'num_nf', 'numnf', 'docto', 'doctto'
    ]);
    
    // Debug: log first few rows to see what columns are being detected
    if (rowIndex < 3) {
      console.log(`[CSV Import] Row ${rowIndex} columns:`, Object.keys(row));
      console.log(`[CSV Import] Row ${rowIndex} values:`, row);
      console.log(`[CSV Import] Document detected:`, numeroDocumento);
    }
    
    // Try to find ANY numeric/string value that could be a document if nothing found
    if (!numeroDocumento) {
      // Get first non-empty value as fallback
      const values = Object.values(row).filter(v => v && v.trim());
      if (values.length > 0 && rowIndex < 3) {
        console.log(`[CSV Import] No document found, available values:`, values.slice(0, 5));
      }
      return null;
    }

    const parcelaStr = getValue([
      'parcela', 'parc', 'num_parcela', 'nro_parcela', 'parcelas',
      'nr_parcela', 'parcela_nr', 'seq', 'sequencia', 'seq_parcela'
    ]);
    const parcelaNum = parcelaStr ? parseInt(parcelaStr) : 1;
    
    const empresaIdStr = getValue([
      'empresa_id', 'empresa', 'cod_empresa', 'filial', 'codigo_empresa',
      'id_empresa', 'cod_filial', 'filial_id', 'emp', 'emp_id'
    ]);
    const empresaId = parseInt(empresaIdStr) || 1;
    
    const tipoDocumento = getValue([
      'tipo_documento', 'tipo', 'tipo_doc', 'tp_documento',
      'tipodocumento', 'tp_doc', 'tipo_titulo', 'natureza'
    ]) || '1';

    return {
      cliente_codigo: clienteCodigo || 'N/D',
      cliente_nome: clienteNome || 'Não informado',
      numero_documento: numeroDocumento,
      parcela: isNaN(parcelaNum) ? 1 : parcelaNum,
      data_emissao: parseDate(getValue([
        'data_emissao', 'emissao', 'dt_emissao', 'data_nf', 'dataemissao',
        'dt_emis', 'data_emis', 'emis', 'data_lancamento', 'dtemissao'
      ])),
      data_vencimento: parseDate(getValue([
        'data_vencimento', 'vencimento', 'dt_vencimento', 'venc', 'dt_venc',
        'datavencimento', 'data_venc', 'dtvencimento', 'dt_vcto', 'vcto', 'vencto'
      ])),
      data_recebimento: parseDate(getValue([
        'data_recebimento', 'recebimento', 'dt_recebimento', 'data_pagamento', 'pagamento', 'dt_pagto',
        'datarecebimento', 'dtrecebimento', 'data_baixa', 'dt_baixa', 'baixa',
        'data_receb', 'data_pgto', 'dtpagto', 'datapagamento'
      ])),
      valor_original: parseNumber(getValue([
        'valor_original', 'valor', 'vlr_original', 'valor_titulo', 'vlr', 'vlr_titulo',
        'valororiginal', 'vlroriginal', 'valor_bruto', 'vlr_bruto', 'vl_titulo',
        'vl_original', 'vlr_documento', 'valor_documento'
      ])),
      valor_aberto: parseNumber(getValue([
        'valor_aberto', 'saldo', 'vlr_aberto', 'valor_saldo', 'vlr_saldo',
        'valoraberto', 'vlraberto', 'saldo_aberto', 'saldo_devedor', 'vl_aberto',
        'vl_saldo', 'valor_restante', 'vlr_restante'
      ])),
      valor_recebido: parseNumber(getValue([
        'valor_recebido', 'vlr_recebido', 'valor_pago', 'vlr_pago',
        'valorrecebido', 'vlrrecebido', 'vl_recebido', 'vl_pago', 'pago'
      ])),
      valor_juros: parseNumber(getValue([
        'valor_juros', 'juros', 'vlr_juros', 'valorjuros', 'vlrjuros', 'vl_juros'
      ])),
      valor_desconto: parseNumber(getValue([
        'valor_desconto', 'desconto', 'vlr_desconto', 'valordesconto', 'vlrdesconto', 'vl_desconto', 'desc'
      ])),
      status: getValue([
        'status', 'situacao', 'sit', 'estado', 'status_titulo', 'situacao_titulo'
      ]) || 'pendente',
      empresa_id: empresaId,
      empresa_nome: getValue(['empresa_nome', 'nome_empresa', 'filial_nome', 'razao_empresa']),
      vendedor_codigo: getValue([
        'vendedor_codigo', 'cod_vendedor', 'vendedor', 'codvendedor', 'rep', 'representante'
      ]),
      vendedor_nome: getValue(['vendedor_nome', 'nome_vendedor', 'nomevendedor', 'rep_nome']),
      tipo_documento: tipoDocumento,
      portador: getValue(['portador', 'banco', 'conta', 'carteira', 'cod_portador']),
      observacoes: getValue(['observacoes', 'obs', 'observacao', 'historico', 'descricao']),
      dias_atraso: parseInt(getValue(['dias_atraso', 'atraso', 'dias', 'dias_em_atraso'])) || null,
    };
  };

  // AI-powered column mapping
  const analyzeWithAI = async (headerRow: string[], sampleRows: Record<string, string>[]) => {
    setStage('analyzing');
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-map-csv-columns', {
        body: {
          headers: headerRow,
          sampleRows: sampleRows,
          tableName: 'contas_receber'
        }
      });

      if (error) throw error;

      const result = data as AIMapResult;
      
      if (!result.success) {
        throw new Error(result.error || 'Erro na análise da IA');
      }

      setColumnMappings(result.mappings);
      setAiSuggestions(result.suggestions || []);
      setDbSchema(result.dbSchema);
      setStage('mapping');

      if (!result.document_field_found) {
        toast.warning('Atenção: O campo "Número do Documento" não foi identificado. Verifique o mapeamento.');
      } else {
        toast.success('IA analisou o arquivo e sugeriu o mapeamento das colunas!');
      }

    } catch (error) {
      console.error('[AI Map] Error:', error);
      toast.error('Erro ao analisar com IA. Usando mapeamento manual.');
      
      // Fallback: create basic mappings without AI
      const basicMappings: ColumnMapping[] = headerRow.map(col => ({
        csv_column: col,
        db_field: null,
        confidence: 'low' as const
      }));
      setColumnMappings(basicMappings);
      setDbSchema(Object.keys(DB_FIELDS_LABELS));
      setStage('mapping');
    }
  };

  // Update a single column mapping
  const updateMapping = (csvColumn: string, dbField: string | null) => {
    setColumnMappings(prev => 
      prev.map(m => 
        m.csv_column === csvColumn 
          ? { ...m, db_field: dbField, confidence: 'high' as const } 
          : m
      )
    );
  };

  // Apply mappings and parse rows
  const applyMappingsAndParse = () => {
    const mappingDict: Record<string, string> = {};
    columnMappings.forEach(m => {
      if (m.db_field) {
        mappingDict[m.csv_column] = m.db_field;
      }
    });

    // Check if numero_documento is mapped
    const hasDocumento = Object.values(mappingDict).includes('numero_documento');
    if (!hasDocumento) {
      toast.error('O campo "Número do Documento" é obrigatório. Mapeie uma coluna para ele.');
      return;
    }

    const parsedRows: ParsedRow[] = [];
    
    for (const row of rawRows) {
      const mappedRow: Record<string, string> = {};
      
      // Map CSV columns to DB fields
      for (const [csvCol, dbField] of Object.entries(mappingDict)) {
        mappedRow[dbField] = row[csvCol] || '';
      }

      // Build the record
      const record = buildRecordFromMappedRow(mappedRow);
      if (record) {
        parsedRows.push(record);
      }
    }

    if (parsedRows.length === 0) {
      toast.error('Nenhum registro válido após aplicar mapeamento');
      return;
    }

    setAllParsedRows(parsedRows);
    setPreviewRows(parsedRows.slice(0, 10));
    setStage('preview');
    toast.success(`${parsedRows.length} registros prontos para importar`);
  };

  // Build record from mapped row (simplified version using direct field names)
  const buildRecordFromMappedRow = (row: Record<string, string>): ParsedRow | null => {
    const doc = row['numero_documento'];
    if (!doc || !doc.trim()) return null;

    const parcelaNum = parseInt(row['parcela'] || '1');
    const empresaId = parseInt(row['empresa_id'] || '1');

    return {
      numero_documento: doc,
      cliente_codigo: row['cliente_codigo'] || 'N/D',
      cliente_nome: row['cliente_nome'] || 'Não informado',
      parcela: isNaN(parcelaNum) ? 1 : parcelaNum,
      data_emissao: parseDate(row['data_emissao'] || ''),
      data_vencimento: parseDate(row['data_vencimento'] || ''),
      data_recebimento: parseDate(row['data_recebimento'] || ''),
      valor_original: parseNumber(row['valor_original'] || ''),
      valor_aberto: parseNumber(row['valor_aberto'] || ''),
      valor_recebido: parseNumber(row['valor_recebido'] || ''),
      valor_juros: parseNumber(row['valor_juros'] || ''),
      valor_desconto: parseNumber(row['valor_desconto'] || ''),
      status: row['status'] || 'pendente',
      empresa_id: isNaN(empresaId) ? 1 : empresaId,
      empresa_nome: row['empresa_nome'] || '',
      vendedor_codigo: row['vendedor_codigo'] || '',
      vendedor_nome: row['vendedor_nome'] || '',
      tipo_documento: row['tipo_documento'] || '1',
      portador: row['portador'] || '',
      observacoes: row['observacoes'] || '',
      dias_atraso: parseInt(row['dias_atraso'] || '') || null,
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStats(null);
    setProgress(0);
    setStage('idle');
    setPreviewRows([]);
    setAllParsedRows([]);
    setColumnMappings([]);
    setRawRows([]);

    try {
      const text = await selectedFile.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('Arquivo vazio ou sem dados');
        return;
      }

      const delimiter = detectDelimiter(lines[0]);
      const headerRow = parseCSVLine(lines[0], delimiter);
      setHeaders(headerRow);

      console.log('[CSV Import] Delimiter:', delimiter === '\t' ? 'TAB' : delimiter);
      console.log('[CSV Import] Headers:', headerRow);
      console.log('[CSV Import] Lines:', lines.length);
      
      // Parse all raw rows (without mapping)
      const rawDataRows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const values = parseCSVLine(line, delimiter);
        const row: Record<string, string> = {};
        
        headerRow.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        
        rawDataRows.push(row);
      }

      setRawRows(rawDataRows);
      
      // Call AI to analyze and map columns
      toast.info('Analisando colunas com IA...');
      await analyzeWithAI(headerRow, rawDataRows.slice(0, 5));

    } catch (error) {
      console.error('[CSV Import] Erro:', error);
      toast.error('Erro ao ler arquivo CSV');
    }
  };

  const processChunk = async (
    records: ParsedRow[],
    currentStats: ImportStats
  ): Promise<ImportStats> => {
    const newStats = { ...currentStats };
    
    try {
      // Generate erp_id matching existing format: empresa_id-tipo_doc-numero_doc-parcela-cliente_codigo
      const recordsWithKeys = records.map(record => ({
        ...record,
        erp_id: `${record.empresa_id}-${record.tipo_documento}-${record.numero_documento}-${record.parcela || 1}-${record.cliente_codigo}`,
      }));

      const { error, count } = await supabase
        .from('contas_receber')
        .upsert(recordsWithKeys, { 
          onConflict: 'erp_id',
          ignoreDuplicates: false 
        });

      if (error) {
        newStats.errors += records.length;
        newStats.errorMessages.push(`Erro no chunk: ${error.message}`);
      } else {
        newStats.inserted += records.length;
      }
    } catch (err) {
      newStats.errors += records.length;
      newStats.errorMessages.push(`Erro: ${err instanceof Error ? err.message : 'Desconhecido'}`);
    }

    newStats.processed += records.length;
    return newStats;
  };

  const processImport = useCallback(async () => {
    if (allParsedRows.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    const newStats: ImportStats = {
      total: allParsedRows.length,
      processed: 0,
      inserted: 0,
      errors: 0,
      errorMessages: [],
      deleted: 0,
    };

    try {
      // Clear existing data if requested
      if (clearExisting) {
        setStage('deleting');
        const { count, error } = await supabase
          .from('contas_receber')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error) {
          newStats.errorMessages.push(`Erro ao limpar dados: ${error.message}`);
        } else {
          newStats.deleted = count || 0;
          toast.info(`${count || 0} registros antigos removidos`);
        }
      }

      setStage('processing');
      setStats({ ...newStats });

      // Process in chunks
      for (let i = 0; i < allParsedRows.length; i += CHUNK_SIZE) {
        const chunk = allParsedRows.slice(i, i + CHUNK_SIZE);
        const updatedStats = await processChunk(chunk, newStats);
        Object.assign(newStats, updatedStats);
        
        const progressPercent = Math.round((newStats.processed / newStats.total) * 100);
        setProgress(progressPercent);
        setStats({ ...newStats });
      }

      setProgress(100);
      setStats({ ...newStats });
      setStage('done');

      if (newStats.errors === 0) {
        toast.success(`${newStats.inserted} registros importados com sucesso!`);
        onSuccess?.();
      } else {
        toast.warning(`Importação concluída com ${newStats.errors} erros`);
      }

    } catch (error) {
      console.error('Erro ao processar:', error);
      newStats.errorMessages.push(error instanceof Error ? error.message : 'Erro desconhecido');
      setStats({ ...newStats });
      toast.error('Erro ao processar importação');
    } finally {
      setIsProcessing(false);
    }
  }, [allParsedRows, clearExisting, onSuccess]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const resetState = () => {
    setFile(null);
    setStats(null);
    setProgress(0);
    setStage('idle');
    setPreviewRows([]);
    setAllParsedRows([]);
    setHeaders([]);
    setRawRows([]);
    setColumnMappings([]);
    setAiSuggestions([]);
    setDbSchema([]);
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <Badge variant="default" className="bg-emerald-500 text-xs">Alta</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-amber-500 text-white text-xs">Média</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-xs">Baixa</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Contas a Receber (CSV)
          </DialogTitle>
          <DialogDescription>
            Suporta arquivos grandes (até 100MB). Processamento em lotes de {CHUNK_SIZE} registros.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* File Input */}
          {stage === 'idle' && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.txt,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
                disabled={isProcessing}
              />
              <label 
                htmlFor="csv-upload" 
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <Upload className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="font-medium">Clique para selecionar o arquivo CSV</p>
                  <p className="text-sm text-muted-foreground">A IA irá analisar e mapear as colunas automaticamente</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-primary">
                  <Sparkles className="h-4 w-4" />
                  Mapeamento inteligente com IA
                </div>
              </label>
            </div>
          )}

          {/* AI Analyzing Stage */}
          {stage === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="relative">
                <Sparkles className="h-12 w-12 text-primary animate-pulse" />
                <Loader2 className="h-6 w-6 text-primary animate-spin absolute -bottom-1 -right-1" />
              </div>
              <div className="text-center">
                <p className="font-medium">Analisando planilha com IA...</p>
                <p className="text-sm text-muted-foreground">
                  Identificando colunas e mapeando para o banco de dados
                </p>
              </div>
            </div>
          )}

          {/* Column Mapping Stage */}
          {stage === 'mapping' && (
            <>
              <Alert className="bg-primary/5 border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertDescription>
                  <strong>{file?.name}</strong> - {rawRows.length.toLocaleString()} registros encontrados.
                  Revise o mapeamento sugerido pela IA abaixo.
                </AlertDescription>
              </Alert>

              {aiSuggestions.length > 0 && (
                <Alert variant="default" className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <ul className="list-disc list-inside text-sm">
                      {aiSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Mapping Table */}
              <div className="border rounded-lg">
                <div className="p-3 bg-muted text-sm font-medium flex items-center justify-between">
                  <span>Mapeamento de Colunas</span>
                  <span className="text-xs text-muted-foreground">
                    {columnMappings.filter(m => m.db_field).length} de {columnMappings.length} mapeadas
                  </span>
                </div>
                <ScrollArea className="h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Coluna CSV</TableHead>
                        <TableHead className="w-8 text-center"></TableHead>
                        <TableHead className="w-1/3">Campo no Banco</TableHead>
                        <TableHead className="w-20 text-center">Confiança</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {columnMappings.map((mapping, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">
                            {mapping.csv_column}
                            {rawRows[0] && (
                              <span className="block text-muted-foreground truncate max-w-[200px]" title={rawRows[0][mapping.csv_column]}>
                                Ex: {rawRows[0][mapping.csv_column] || '(vazio)'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={mapping.db_field || '_none'}
                              onValueChange={(value) => updateMapping(mapping.csv_column, value === '_none' ? null : value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Selecionar campo..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">
                                  <span className="text-muted-foreground">— Ignorar coluna —</span>
                                </SelectItem>
                                {Object.entries(DB_FIELDS_LABELS).map(([field, label]) => (
                                  <SelectItem key={field} value={field}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-center">
                            {mapping.db_field && getConfidenceBadge(mapping.confidence)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={resetState} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Novo arquivo
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetState}>
                    Cancelar
                  </Button>
                  <Button onClick={applyMappingsAndParse} className="gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Aplicar Mapeamento
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Preview */}
          {stage === 'preview' && previewRows.length > 0 && (
            <>
              <Alert>
                <Eye className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    <strong>{file?.name}</strong> ({formatFileSize(file?.size || 0)}) - 
                    <strong> {allParsedRows.length.toLocaleString()}</strong> registros encontrados
                  </span>
                </AlertDescription>
              </Alert>

              {/* Options */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="clear-existing"
                    checked={clearExisting}
                    onCheckedChange={setClearExisting}
                  />
                  <Label htmlFor="clear-existing" className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    Substituir todos os dados existentes
                  </Label>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border rounded-lg">
                <div className="p-2 bg-muted text-sm font-medium">
                  Preview (primeiros 10 registros)
                </div>
                <ScrollArea className="h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Documento</TableHead>
                        <TableHead className="w-16">Parc.</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="w-28">Vencimento</TableHead>
                        <TableHead className="w-28 text-right">Valor</TableHead>
                        <TableHead className="w-28 text-right">Saldo</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{row.numero_documento}</TableCell>
                          <TableCell>{row.parcela}</TableCell>
                          <TableCell className="truncate max-w-[200px]" title={row.cliente_nome}>
                            {row.cliente_nome}
                          </TableCell>
                          <TableCell>{row.data_vencimento || '-'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.valor_original)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.valor_aberto)}</TableCell>
                          <TableCell>{row.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetState}>
                  Cancelar
                </Button>
                <Button onClick={processImport} disabled={isProcessing}>
                  {clearExisting ? 'Substituir e Importar' : 'Importar'}
                  {` ${allParsedRows.length.toLocaleString()} registros`}
                </Button>
              </div>
            </>
          )}

          {/* Progress */}
          {(stage === 'deleting' || stage === 'processing') && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {stage === 'deleting' && 'Limpando dados existentes...'}
                    {stage === 'processing' && `Importando registros...`}
                  </span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>

              {stats && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{stats.processed.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Processados</p>
                  </div>
                  <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{stats.inserted.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Importados</p>
                  </div>
                  <div className="bg-destructive/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{stats.errors.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Done */}
          {stage === 'done' && stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {stats.deleted !== undefined && stats.deleted > 0 && (
                  <div className="bg-orange-500/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-600">{stats.deleted.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Removidos</p>
                  </div>
                )}
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{stats.inserted.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                <div className="bg-destructive/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{stats.errors.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>

              {stats.errors === 0 ? (
                <Alert className="bg-emerald-500/10 border-emerald-500/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-600">
                    Importação concluída com sucesso!
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-32 border rounded-lg p-3">
                  <div className="space-y-1">
                    {stats.errorMessages.slice(0, 20).map((msg, idx) => (
                      <p key={idx} className="text-xs text-destructive flex items-start gap-1">
                        <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        {msg}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <div className="flex justify-end">
                <Button onClick={() => onOpenChange(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
