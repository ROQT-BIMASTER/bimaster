import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
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
  updated: number;
  errors: number;
  errorMessages: string[];
}

const CHUNK_SIZE = 500; // Process 500 records at a time

export default function ImportarContasReceberCSV({ 
  open, 
  onOpenChange,
  onSuccess 
}: ImportarContasReceberCSVProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'idle' | 'reading' | 'processing' | 'done'>('idle');

  const parseCSVLine = (line: string): string[] => {
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
      } else if ((char === ',' || char === ';') && !inQuotes) {
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
      .replace(/\./g, '')
      .replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  };

  type ContaReceberRecord = {
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
  };

  const mapRowToRecord = (row: Record<string, string>): ContaReceberRecord | null => {
    const getValue = (keys: string[]): string => {
      for (const key of keys) {
        const normalizedKey = normalizeColumnName(key);
        for (const [csvCol, value] of Object.entries(row)) {
          if (normalizeColumnName(csvCol) === normalizedKey || csvCol === key) {
            return value || '';
          }
        }
      }
      return '';
    };

    // Map common column names to database fields
    const clienteCodigo = getValue(['cliente_codigo', 'cod_cliente', 'codigo_cliente', 'cliente', 'cod']);
    const clienteNome = getValue(['cliente_nome', 'nome_cliente', 'razao_social', 'cliente', 'nome']);
    
    if (!clienteCodigo && !clienteNome) return null;

    const parcelaStr = getValue(['parcela', 'parc', 'num_parcela']);
    const parcelaNum = parcelaStr ? parseInt(parcelaStr) : null;

    return {
      cliente_codigo: clienteCodigo || 'N/D',
      cliente_nome: clienteNome || 'Não informado',
      numero_documento: getValue(['numero_documento', 'documento', 'num_doc', 'nota', 'nf', 'numero']),
      parcela: isNaN(parcelaNum as number) ? null : parcelaNum,
      data_emissao: parseDate(getValue(['data_emissao', 'emissao', 'dt_emissao', 'data_nf'])),
      data_vencimento: parseDate(getValue(['data_vencimento', 'vencimento', 'dt_vencimento', 'venc'])),
      data_recebimento: parseDate(getValue(['data_recebimento', 'recebimento', 'dt_recebimento', 'data_pagamento', 'pagamento'])),
      valor_original: parseNumber(getValue(['valor_original', 'valor', 'vlr_original', 'valor_titulo', 'vlr'])),
      valor_aberto: parseNumber(getValue(['valor_aberto', 'saldo', 'vlr_aberto', 'valor_saldo'])),
      valor_recebido: parseNumber(getValue(['valor_recebido', 'vlr_recebido', 'valor_pago', 'vlr_pago'])),
      valor_juros: parseNumber(getValue(['valor_juros', 'juros', 'vlr_juros'])),
      valor_desconto: parseNumber(getValue(['valor_desconto', 'desconto', 'vlr_desconto'])),
      status: getValue(['status', 'situacao', 'sit']) || 'pendente',
      empresa_id: parseInt(getValue(['empresa_id', 'empresa', 'cod_empresa', 'filial'])) || 1,
      empresa_nome: getValue(['empresa_nome', 'nome_empresa', 'filial_nome']),
      vendedor_codigo: getValue(['vendedor_codigo', 'cod_vendedor', 'vendedor']),
      vendedor_nome: getValue(['vendedor_nome', 'nome_vendedor']),
      tipo_documento: getValue(['tipo_documento', 'tipo', 'tipo_doc']),
      portador: getValue(['portador', 'banco', 'conta']),
      observacoes: getValue(['observacoes', 'obs', 'observacao']),
      dias_atraso: parseInt(getValue(['dias_atraso', 'atraso', 'dias'])) || null,
    };
  };

  const processChunk = async (
    records: ContaReceberRecord[],
    stats: ImportStats
  ): Promise<ImportStats> => {
    const newStats = { ...stats };
    
    try {
      const recordsWithKeys = records.map(record => ({
        ...record,
        erp_id: `${record.cliente_codigo}_${record.numero_documento}_${record.parcela || '1'}`,
      }));

      const { data, error } = await supabase
        .from('contas_receber')
        .upsert(recordsWithKeys, { 
          onConflict: 'erp_id',
          ignoreDuplicates: false 
        })
        .select('id');

      if (error) {
        newStats.errors += records.length;
        newStats.errorMessages.push(`Erro no chunk: ${error.message}`);
      } else {
        newStats.inserted += data?.length || 0;
      }
    } catch (err) {
      newStats.errors += records.length;
      newStats.errorMessages.push(`Erro: ${err instanceof Error ? err.message : 'Desconhecido'}`);
    }

    newStats.processed += records.length;
    return newStats;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStats(null);
      setProgress(0);
      setStage('idle');
    }
  };

  const processFile = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setStage('reading');
    setProgress(0);

    const newStats: ImportStats = {
      total: 0,
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      errorMessages: [],
    };

    try {
      // Read file in chunks using FileReader
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('Arquivo vazio ou sem dados');
      }

      // Detect delimiter and parse header
      const delimiter = detectDelimiter(lines[0]);
      const headers = parseCSVLine(lines[0].replace(new RegExp(delimiter, 'g'), ','));
      
      newStats.total = lines.length - 1;
      setStats({ ...newStats });
      setStage('processing');

      // Process data in chunks
      const dataLines = lines.slice(1);
      const records: ContaReceberRecord[] = [];

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        if (!line.trim()) continue;

        const values = parseCSVLine(line.replace(new RegExp(delimiter, 'g'), ','));
        const row: Record<string, string> = {};
        
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        const record = mapRowToRecord(row);
        if (record) {
          records.push(record);
        }

        // Process chunk when it reaches CHUNK_SIZE
        if (records.length >= CHUNK_SIZE) {
          const updatedStats = await processChunk(records, newStats);
          Object.assign(newStats, updatedStats);
          records.length = 0;
          
          const progressPercent = Math.round((newStats.processed / newStats.total) * 100);
          setProgress(progressPercent);
          setStats({ ...newStats });
        }
      }

      // Process remaining records
      if (records.length > 0) {
        const updatedStats = await processChunk(records, newStats);
        Object.assign(newStats, updatedStats);
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
      console.error('Erro ao processar arquivo:', error);
      newStats.errorMessages.push(error instanceof Error ? error.message : 'Erro desconhecido');
      setStats({ ...newStats });
      toast.error('Erro ao processar arquivo');
    } finally {
      setIsProcessing(false);
    }
  }, [file, onSuccess]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Contas a Receber (CSV)
          </DialogTitle>
          <DialogDescription>
            Suporta arquivos grandes (até 100MB). O processamento é feito em lotes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Input */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
              disabled={isProcessing}
            />
            <label 
              htmlFor="csv-upload" 
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Clique para selecionar ou arraste o arquivo CSV
              </span>
            </label>
          </div>

          {/* Selected File Info */}
          {file && (
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  <strong>{file.name}</strong> ({formatFileSize(file.size)})
                </span>
                {!isProcessing && stage === 'idle' && (
                  <Button onClick={processFile} size="sm">
                    Iniciar Importação
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {stage === 'reading' && 'Lendo arquivo...'}
                  {stage === 'processing' && `Processando registros...`}
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Stats */}
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

          {/* Error Messages */}
          {stats?.errorMessages && stats.errorMessages.length > 0 && (
            <ScrollArea className="h-32 border rounded-lg p-3">
              <div className="space-y-1">
                {stats.errorMessages.slice(0, 20).map((msg, idx) => (
                  <p key={idx} className="text-xs text-destructive flex items-start gap-1">
                    <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    {msg}
                  </p>
                ))}
                {stats.errorMessages.length > 20 && (
                  <p className="text-xs text-muted-foreground">
                    ... e mais {stats.errorMessages.length - 20} erros
                  </p>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Success */}
          {stage === 'done' && stats?.errors === 0 && (
            <Alert className="bg-emerald-500/10 border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-600">
                Importação concluída com sucesso!
              </AlertDescription>
            </Alert>
          )}

          {/* Column Mapping Info */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <p className="font-medium mb-1">Colunas reconhecidas automaticamente:</p>
            <p>cliente_codigo, cliente_nome, numero_documento, parcela, data_emissao, data_vencimento, data_recebimento, valor_original, valor_aberto, status, empresa_id, vendedor_codigo, vendedor_nome</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
