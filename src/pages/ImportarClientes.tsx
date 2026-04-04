import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, CheckCircle, XCircle, AlertCircle, Sparkles, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CNPJBizCreditos } from "@/components/prospects/CNPJBizCreditos";
import { CNPJBizFilters } from "@/components/prospects/CNPJBizFilters";
import { CNPJBizPreview } from "@/components/prospects/CNPJBizPreview";
import { CNPJBizSearch } from "@/components/prospects/CNPJBizSearch";
import { readExcelFile } from "@/utils/excelExport";
import { createImportTemplate } from "@/utils/excelExport";
import ExcelJS from 'exceljs';

interface ImportResult {
  total: number;
  distribuidos: number;
  nao_distribuidos: number;
  atualizados: number;
  inseridos: number;
  erros: string[];
  detalhes: Array<{
    linha: number;
    empresa: string;
    status: 'sucesso' | 'erro' | 'sem_vendedor' | 'atualizado';
    mensagem: string;
  }>;
}

const ImportarClientes = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [textoIA, setTextoIA] = useState("");
  const [loadingIA, setLoadingIA] = useState(false);
  const [apiFilters, setApiFilters] = useState<any>(null);
  const [apiCount, setApiCount] = useState<number>(0);
  const [showPreview, setShowPreview] = useState(false);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [supervisores, setSupervisores] = useState<any[]>([]);
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>("");
  const [supervisorSelecionado, setSupervisorSelecionado] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
    fetchUsuarios();
    fetchCurrentUser();
  }, []);

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsAdmin(roleData?.role === 'admin');
    } catch (error) {
      console.error("Erro ao verificar permissões:", error);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      setCurrentUserRole(roleData?.role || null);

      // Se for vendedor ou promotor, já seleciona ele mesmo
      if (roleData?.role === 'vendedor' || roleData?.role === 'promotor') {
        setVendedorSelecionado(user.id);
      }
    } catch (error) {
      console.error("Erro ao buscar usuário atual:", error);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("status", "ativo")
        .order("nome");

      if (!profiles) return;

      const userIds = profiles.map(p => p.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const vendedoresList = profiles
        .filter(p => {
          const role = roleMap.get(p.id);
          return role === 'vendedor' || role === 'promotor';
        })
        .map(p => ({ ...p, role: roleMap.get(p.id) }));

      const supervisoresList = profiles
        .filter(p => {
          const role = roleMap.get(p.id);
          return role === 'supervisor' || role === 'admin';
        })
        .map(p => ({ ...p, role: roleMap.get(p.id) }));

      setVendedores(vendedoresList);
      setSupervisores(supervisoresList);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') {
        setFile(selectedFile);
        setResult(null);
      } else {
        toast({
          title: "Formato inválido",
          description: "Apenas arquivos CSV ou Excel são aceitos",
          variant: "destructive",
        });
      }
    }
  };

  const validateCNPJ = (cnpj: string): boolean => {
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
    if (cleanCNPJ.length !== 14) return false;
    if (/^(\d)\1+$/.test(cleanCNPJ)) return false;
    
    let tamanho = cleanCNPJ.length - 2;
    let numeros = cleanCNPJ.substring(0, tamanho);
    const digitos = cleanCNPJ.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    
    tamanho = tamanho + 1;
    numeros = cleanCNPJ.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    return resultado === parseInt(digitos.charAt(1));
  };

  const padronizarMunicipio = async (municipio: string, uf?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('padronizar-municipio', {
        body: { municipio, uf }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Erro ao padronizar município:", error);
      return { municipio_padrao: municipio, uf_padrao: uf, regiao: null, confianca: 'baixa' };
    }
  };

  const classificarPorteEmpresa = (
    totalFuncionarios?: number | null,
    faixaFuncionarios?: string | null,
    faixaFaturamento?: string | null
  ): string | null => {
    // Valores aceitos pelo banco: MEI, ME, EPP, Grande
    
    // Prioriza total de funcionários se disponível
    if (totalFuncionarios !== null && totalFuncionarios !== undefined) {
      if (totalFuncionarios === 0 || totalFuncionarios === 1) return "MEI";
      if (totalFuncionarios <= 9) return "ME"; // Microempresa
      if (totalFuncionarios <= 49) return "EPP"; // Pequena
      return "Grande"; // 50+ funcionários
    }

    // Usa faixa de funcionários
    if (faixaFuncionarios) {
      const faixa = faixaFuncionarios.toLowerCase();
      if (faixa.includes("0") || faixa.includes("mei")) return "MEI";
      if (faixa.includes("1 a 9") || faixa.includes("micro")) return "ME";
      if (faixa.includes("10 a 49") || faixa.includes("pequena")) return "EPP";
      if (faixa.includes("50") || faixa.includes("média") || faixa.includes("grande")) return "Grande";
    }

    // Usa faixa de faturamento como fallback
    if (faixaFaturamento) {
      const faixa = faixaFaturamento.toLowerCase();
      if (faixa.includes("mei") || faixa.includes("81.000")) return "MEI";
      if (faixa.includes("360.000") || faixa.includes("micro")) return "ME";
      if (faixa.includes("4.8") || faixa.includes("pequena")) return "EPP";
      return "Grande";
    }

    return null; // Retorna null se não conseguir classificar
  };

  const handleImport = async () => {
    if (!file) return;

    logger.debug(`Iniciando importação do arquivo: ${file.name}`);
    setLoading(true);
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();
    
    reader.onerror = () => {
      console.error("❌ Erro ao ler arquivo");
      toast({
        title: "Erro ao ler arquivo",
        description: "Não foi possível ler o arquivo selecionado",
        variant: "destructive",
      });
      setLoading(false);
    };
    
    reader.onload = async (e) => {
      logger.debug("📖 Arquivo lido com sucesso, processando...");
      try {
        const data = e.target?.result;
        let rows: any[] = [];
        let headers: string[] = [];

        // Processar Excel
        if (extension === 'xlsx' || extension === 'xls') {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(data as ArrayBuffer);
          const worksheet = workbook.worksheets[0];
          
          if (!worksheet || worksheet.rowCount < 2) {
            throw new Error("Arquivo vazio ou sem dados");
          }
          
          const jsonData: any[][] = [];
          worksheet.eachRow((row, rowNumber) => {
            const rowData: any[] = [];
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
              rowData[colNumber - 1] = cell.value;
            });
            jsonData.push(rowData);
          });
          
          headers = jsonData[0].map((h: any) => String(h || '').trim().toLowerCase());
          rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
        }
        // Processar CSV
        else {
          const text = new TextDecoder('utf-8').decode(data as ArrayBuffer);
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            throw new Error("Arquivo vazio ou sem dados");
          }

          const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
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

          headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
          rows = lines.slice(1).map(line => parseCSVLine(line));
        }

        const prospects = [];
        const erros: string[] = [];
        const detalhes: ImportResult['detalhes'] = [];

        // Normalizar texto para busca (remove acentos e converte para lowercase)
        const normalizar = (texto: string) => {
          return texto
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        };

        const headersNormalizados = headers.map(h => normalizar(h));

        // Mapear índices das colunas (fora do loop para melhor performance)
        const nomeIdx = headersNormalizados.findIndex(h => h.includes('nome') && h.includes('empresa'));
        const cnpjIdx = headersNormalizados.findIndex(h => (h === 'cnpj' || h.startsWith('cnpj')) && !h.includes('raiz'));
        const cnpjRaizIdx = headersNormalizados.findIndex(h => h.includes('cnpj') && h.includes('raiz'));
        const dominioIdx = headersNormalizados.findIndex(h => h.includes('dominio'));
        const nomeFantasiaIdx = headersNormalizados.findIndex(h => h.includes('fantasia'));
        const perfilLinkedinIdx = headersNormalizados.findIndex(h => h.includes('linkedin'));
        const segmentoIdx = headersNormalizados.findIndex(h => h === 'segmento');
        const cnaeCodigoIdx = headersNormalizados.findIndex(h => h.includes('cnae') && (h.includes('codigo') || h.includes('(codigo)')));
        const cnaePrincipalIdx = headersNormalizados.findIndex(h => h.includes('cnae') && h.includes('principal') && !h.includes('codigo'));
        const tipoEstabelecimentoIdx = headersNormalizados.findIndex(h => h.includes('estabelecimento'));
        const porteIdx = headersNormalizados.findIndex(h => h.includes('porte'));
        const totalFuncionariosIdx = headersNormalizados.findIndex(h => h.includes('total') && h.includes('funcionario'));
        const faixaFuncionariosIdx = headersNormalizados.findIndex(h => h.includes('faixa') && h.includes('funcionario'));
        const faixaFaturamentoIdx = headersNormalizados.findIndex(h => h.includes('faturamento'));
        const totalFiliaisIdx = headersNormalizados.findIndex(h => h.includes('filiais'));
        const tipoEntidadeIdx = headersNormalizados.findIndex(h => h.includes('entidade'));
        const naturezaJuridicaIdx = headersNormalizados.findIndex(h => h.includes('natureza'));
        const dataAberturaIdx = headersNormalizados.findIndex(h => h.includes('abertura'));
        const nivelAtividadeIdx = headersNormalizados.findIndex(h => h.includes('nivel') && h.includes('atividade'));
        const tendenciaCrescimentoIdx = headersNormalizados.findIndex(h => h.includes('tendencia') && h.includes('crescimento'));
        const telefoneIdx = headersNormalizados.findIndex(h => h.includes('telefone') && h.includes('principal'));
        const demaisTelefonesIdx = headersNormalizados.findIndex(h => h.includes('demais') && h.includes('telefone'));
        const enderecoCompletoIdx = headersNormalizados.findIndex(h => h.includes('endereco') && h.includes('completo'));
        const tipoLogradouroIdx = headersNormalizados.findIndex(h => h.includes('tipo') && h.includes('logradouro'));
        const logradouroIdx = headersNormalizados.findIndex(h => h === 'logradouro');
        const numeroIdx = headersNormalizados.findIndex(h => h === 'numero');
        const cepIdx = headersNormalizados.findIndex(h => h === 'cep');
        const bairroIdx = headersNormalizados.findIndex(h => h === 'bairro');
        const municipioIdx = headersNormalizados.findIndex(h => h === 'municipio');
        const ufIdx = headersNormalizados.findIndex(h => h === 'uf');
        const emailIdx = headersNormalizados.findIndex(h => h.includes('email') && h.includes('principal'));
        const demaisEmailsIdx = headersNormalizados.findIndex(h => h.includes('demais') && h.includes('email'));
        const perfilFacebookIdx = headersNormalizados.findIndex(h => h.includes('facebook'));
        const perfilInstagramIdx = headersNormalizados.findIndex(h => h.includes('instagram'));
        const perfilTwitterIdx = headersNormalizados.findIndex(h => h.includes('twitter'));
        const urlCompanyPageIdx = headersNormalizados.findIndex(h => h.includes('url') && h.includes('company'));
        const situacaoIdx = headersNormalizados.findIndex(h => h === 'situacao');
        const territorioIdx = headersNormalizados.findIndex(h => h === 'territorio');
        const trmIdx = headersNormalizados.findIndex(h => h === 'trm');
        const faixaScorePropensaoIdx = headersNormalizados.findIndex(h => h.includes('faixa') && h.includes('score') && h.includes('propensao'));
        const scorePropensaoIdx = headersNormalizados.findIndex(h => h.includes('score') && h.includes('propensao') && !h.includes('faixa') && !h.includes('contactability'));
        const faixaScoreContactabilityIdx = headersNormalizados.findIndex(h => h.includes('contactability'));
        const variacaoScoreIdx = headersNormalizados.findIndex(h => h.includes('variacao') && h.includes('score'));
        const contatoIdx = headersNormalizados.findIndex(h => h.includes('contato') && !h.includes('telefone'));
        const observacoesIdx = headersNormalizados.findIndex(h => h.includes('observa') || h.includes('obs'));

        for (let i = 0; i < rows.length; i++) {
          const values = rows[i].map((v: any) => String(v || '').trim());

          const nome_empresa = (values[nomeIdx] || '').trim().replace(/^["']|["']$/g, '');
          const municipio_nome = (values[municipioIdx] || '').trim().replace(/^["']|["']$/g, '');
          const uf = (values[ufIdx] || '').trim().replace(/^["']|["']$/g, '');
          const cnpj = (values[cnpjIdx] || '').trim().replace(/^["']|["']$/g, '');

          if (!nome_empresa || !municipio_nome) {
            const mensagemErro = `Linha ${i + 1}: ${!nome_empresa ? 'Nome da empresa' : ''} ${!nome_empresa && !municipio_nome ? 'e' : ''} ${!municipio_nome ? 'Município' : ''} não informado`;
            erros.push(mensagemErro);
            detalhes.push({
              linha: i + 1,
              empresa: nome_empresa || 'N/A',
              status: 'erro',
              mensagem: 'Dados incompletos - verifique nome da empresa e município'
            });
            continue;
          }

          // Padronizar município com IA
          const municipioPadronizado = await padronizarMunicipio(municipio_nome, uf);
          const municipioFinal = municipioPadronizado.municipio_padrao || municipio_nome;
          const ufFinal = municipioPadronizado.uf_padrao || uf;
          const regiaoFinal = municipioPadronizado.regiao;

          // Validar CNPJ se fornecido
          let cnpjValidado = cnpj;
          let avisosCNPJ: string[] = [];
          if (cnpj && cnpj.length > 3 && !validateCNPJ(cnpj)) {
            avisosCNPJ.push(`CNPJ inválido (${cnpj}) - importado sem CNPJ`);
            cnpjValidado = '';
          }

          // Verificar duplicata por CNPJ e atualizar se existir
          let prospectExistenteId: string | null = null;
          if (cnpjValidado) {
            const { data: existente } = await supabase
              .from("prospects")
              .select("id")
              .eq("cnpj", cnpjValidado)
              .maybeSingle();

            if (existente) {
              prospectExistenteId = existente.id;
              logger.debug(`Prospect com CNPJ ${cnpjValidado} já existe, será atualizado`);
            }
          }

          // Buscar ou criar município
          let { data: municipio } = await supabase
            .from("municipios")
            .select("id, vendedor_id")
            .ilike("nome", municipioFinal)
            .maybeSingle();

          // Se município não existe, criar
          if (!municipio) {
            try {
              // Mapear região brasileira para zona da cidade (enum region_type)
              const mapearRegiaoParaZona = (regiao: string | null): 'Norte' | 'Sul' | 'Leste' | 'Oeste' | 'Centro' => {
                if (!regiao) return 'Centro';
                
                const regiaoLower = regiao.toLowerCase();
                // Mapeamento simples: usar Centro como padrão para qualquer região do Brasil
                // pois o enum representa zonas da cidade, não regiões do país
                return 'Centro';
              };

              const { data: novoMunicipio, error: municipioError } = await supabase
                .from("municipios")
                .insert({
                  nome: municipioFinal,
                  uf: ufFinal || 'N/A',
                  regiao: mapearRegiaoParaZona(regiaoFinal)
                } as any)
                .select("id, vendedor_id")
                .single();

              if (municipioError) {
                console.error("Erro ao criar município:", municipioError);
                erros.push(`Linha ${i + 1}: Erro ao criar município ${municipioFinal} - ${municipioError.message}`);
                detalhes.push({
                  linha: i + 1,
                  empresa: nome_empresa,
                  status: 'erro',
                  mensagem: `Erro ao criar município: ${municipioError.message}`
                });
                continue;
              } else {
                municipio = novoMunicipio;
                logger.debug(`Município criado: ${municipioFinal}/${ufFinal}`);
              }
            } catch (municipioException: any) {
              console.error("Exceção ao criar município:", municipioException);
              erros.push(`Linha ${i + 1}: Falha ao processar município ${municipioFinal}`);
              detalhes.push({
                linha: i + 1,
                empresa: nome_empresa,
                status: 'erro',
                mensagem: 'Falha ao processar município'
              });
              continue;
            }
          }

          const parseNumber = (val: string) => {
            const num = parseFloat(val.replace(/[^\d.-]/g, ''));
            return isNaN(num) ? null : num;
          };

          // Extrair dados para classificar porte
          const totalFuncionarios = parseNumber(values[totalFuncionariosIdx] || '');
          const faixaFuncionarios = (values[faixaFuncionariosIdx] || '').trim().replace(/^["']|["']$/g, '') || null;
          const faixaFaturamento = (values[faixaFaturamentoIdx] || '').trim().replace(/^["']|["']$/g, '') || null;
          
          // Classificar porte automaticamente
          const porteEmpresaClassificado = classificarPorteEmpresa(totalFuncionarios, faixaFuncionarios, faixaFaturamento);
          
          logger.debug(`Linha ${i + 1}: Funcionários=${totalFuncionarios}, Faixa Func="${faixaFuncionarios}", Faixa Fat="${faixaFaturamento}" → Porte="${porteEmpresaClassificado}"`);

          const prospectData = {
            nome_empresa,
            municipio_id: municipio?.id || null,
            vendedor_id: municipio?.vendedor_id || null,
            cnpj: cnpjValidado || null,
            cnpj_raiz: (values[cnpjRaizIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            dominio: (values[dominioIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            nome_fantasia: (values[nomeFantasiaIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            perfil_linkedin: (values[perfilLinkedinIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            segmento: (values[segmentoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            cnae_codigo: (values[cnaeCodigoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            cnae_principal: (values[cnaePrincipalIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            tipo_estabelecimento: (values[tipoEstabelecimentoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            porte_empresa: porteEmpresaClassificado,
            total_funcionarios: totalFuncionarios,
            faixa_funcionarios: faixaFuncionarios,
            faixa_faturamento: faixaFaturamento,
            total_filiais: parseNumber(values[totalFiliaisIdx] || ''),
            tipo_entidade: (values[tipoEntidadeIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            natureza_juridica: (values[naturezaJuridicaIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            data_abertura: (values[dataAberturaIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            nivel_atividade: (values[nivelAtividadeIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            tendencia_crescimento: (values[tendenciaCrescimentoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            telefone: (values[telefoneIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            demais_telefones: (values[demaisTelefonesIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            endereco: (values[enderecoCompletoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            tipo_logradouro: (values[tipoLogradouroIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            logradouro: (values[logradouroIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            numero: (values[numeroIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            cep: (values[cepIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            bairro: (values[bairroIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            municipio: municipioFinal,
            uf: ufFinal || null,
            email: (values[emailIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            demais_emails: (values[demaisEmailsIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            perfil_facebook: (values[perfilFacebookIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            perfil_instagram: (values[perfilInstagramIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            perfil_twitter: (values[perfilTwitterIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            url_company_page: (values[urlCompanyPageIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            situacao: (values[situacaoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            territorio: (values[territorioIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            trm: (values[trmIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            faixa_score_propensao: (values[faixaScorePropensaoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            score_propensao: parseNumber(values[scorePropensaoIdx] || ''),
            faixa_score_contactability: (values[faixaScoreContactabilityIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            variacao_score_propensao: parseNumber(values[variacaoScoreIdx] || ''),
            contato_principal: (values[contatoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            observacoes: (values[observacoesIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            importado_planilha: true,
            status: 'novo' as const
          };

          // Se prospect já existe, atualizar; senão, adicionar para inserção
          if (prospectExistenteId) {
            const { error: updateError } = await supabase
              .from("prospects")
              .update(prospectData)
              .eq("id", prospectExistenteId);

            if (updateError) {
              erros.push(`Linha ${i + 1}: Erro ao atualizar ${nome_empresa} - ${updateError.message}`);
              detalhes.push({
                linha: i + 1,
                empresa: nome_empresa,
                status: 'erro',
                mensagem: `Erro ao atualizar: ${updateError.message}`
              });
            } else {
              const mensagemSucesso = avisosCNPJ.length > 0 
                ? `Atualizado - ${avisosCNPJ[0]}` 
                : (municipio?.vendedor_id 
                  ? 'Atualizado e distribuído automaticamente' 
                  : 'Cliente atualizado com sucesso');
              
              detalhes.push({
                linha: i + 1,
                empresa: nome_empresa,
                status: 'atualizado',
                mensagem: mensagemSucesso
              });
            }
          } else {
            prospects.push(prospectData);
            detalhes.push({
              linha: i + 1,
              empresa: nome_empresa,
              status: municipio?.vendedor_id ? 'sucesso' : 'sem_vendedor',
              mensagem: avisosCNPJ.length > 0 
                ? avisosCNPJ[0] 
                : (municipio?.vendedor_id 
                  ? 'Distribuído automaticamente' 
                  : `Município ${municipio_nome} sem vendedor atribuído`)
            });
          }
        }

        logger.debug(`📊 Total de prospects processados: ${prospects.length} novos, ${detalhes.filter(d => d.status === 'atualizado').length} atualizados`);
        
        // Só inserir se houver prospects novos
        if (prospects.length > 0) {
          logger.debug(`📋 Validando dados antes da inserção...`);
          
          // Validar que todos os porte_empresa são válidos
          prospects.forEach((p, idx) => {
            if (p.porte_empresa && !['MEI', 'ME', 'EPP', 'Grande'].includes(p.porte_empresa)) {
              console.error(`❌ Porte inválido encontrado na linha ${idx + 1}: "${p.porte_empresa}"`);
              throw new Error(`Porte de empresa inválido: "${p.porte_empresa}". Valores aceitos: MEI, ME, EPP, Grande`);
            }
          });

          logger.debug(`✅ Todos os dados validados. Inserindo no banco...`);

          const { data: inserted, error: insertError } = await supabase
            .from("prospects")
            .insert(prospects)
            .select();

          if (insertError) {
            throw insertError;
          }
        }

        // Contar distribuídos e não distribuídos incluindo atualizados
        const atualizados = detalhes.filter(d => d.status === 'atualizado').length;
        const inseridos = prospects.length;
        const totalProcessadosSucesso = detalhes.filter(d => d.status === 'sucesso' || d.status === 'sem_vendedor' || d.status === 'atualizado').length;
        const distribuidos = detalhes.filter(d => (d.status === 'sucesso' || d.status === 'atualizado') && d.mensagem.includes('Distribuído')).length;
        const nao_distribuidos = totalProcessadosSucesso - distribuidos;

        setResult({
          total: rows.length,
          distribuidos,
          nao_distribuidos,
          atualizados,
          inseridos,
          erros,
          detalhes
        });

        logger.debug("✅ Importação concluída:", {
          inseridos,
          atualizados,
          distribuidos,
          nao_distribuidos
        });
        
        toast({
          title: "Importação concluída",
          description: `${inseridos} ${inseridos === 1 ? 'inserido' : 'inseridos'}, ${atualizados} ${atualizados === 1 ? 'atualizado' : 'atualizados'}`,
        });
      } catch (error: any) {
        console.error("❌ Erro durante o processamento:", error);
        toast({
          title: "Erro na importação",
          description: error.message || "Erro ao processar arquivo",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    logger.debug("📂 Iniciando leitura do arquivo...");
    reader.readAsArrayBuffer(file);
  };

  const handleImportIA = async () => {
    if (!textoIA.trim()) {
      toast({
        title: "Dados vazios",
        description: "Por favor, cole os dados da planilha ou insira informações para análise",
        variant: "destructive",
      });
      return;
    }

    setLoadingIA(true);
    logger.debug("🚀 Iniciando importação com IA...");

    try {
      // Chamar edge function para análise
      const { data: analiseData, error: analiseError } = await supabase.functions.invoke(
        'analisar-planilha-ia',
        {
          body: { 
            planilhaTexto: textoIA,
            tipo: 'prospects'
          }
        }
      );

      if (analiseError) {
        console.error("Erro na análise:", analiseError);
        throw new Error(analiseError.message || "Erro ao analisar dados com IA");
      }

      logger.debug("📊 Resultado da análise:", analiseData);

      if (!analiseData?.prospects || analiseData.prospects.length === 0) {
        toast({
          title: "Nenhum prospect encontrado",
          description: "A IA não conseguiu identificar empresas nos dados fornecidos",
          variant: "destructive",
        });
        return;
      }

      // Processar e inserir prospects
      const prospects = [];
      const erros: string[] = [];
      const detalhes: ImportResult['detalhes'] = [];

      for (let i = 0; i < analiseData.prospects.length; i++) {
        const p = analiseData.prospects[i];
        
        if (!p.nome_empresa || !p.municipio) {
          erros.push(`Prospect ${i + 1}: Nome da empresa ou município ausente`);
          continue;
        }

        // Mapear porte_empresa para valores aceitos: MEI, ME, EPP, Grande
        const mapearPorte = (porte: string | null): string | null => {
          if (!porte) return null;
          
          const porteNormalizado = porte.toLowerCase().trim();
          
          // Mapeamento de variações para valores aceitos
          if (porteNormalizado === 'mei' || porteNormalizado.includes('mei')) return 'MEI';
          if (porteNormalizado === 'me' || porteNormalizado.includes('micro')) return 'ME';
          if (porteNormalizado === 'epp' || porteNormalizado.includes('pequena')) return 'EPP';
          if (porteNormalizado === 'grande' || porteNormalizado.includes('média') || porteNormalizado.includes('media')) return 'Grande';
          
          // Se já está no formato correto
          if (['MEI', 'ME', 'EPP', 'Grande'].includes(porte)) return porte;
          
          return null;
        };

        const porteEmpresaMapeado = mapearPorte(p.porte_empresa);

        // Verificar se prospect já existe (por CNPJ)
        let prospectExistenteId: string | null = null;
        if (p.cnpj) {
          const { data: existente } = await supabase
            .from("prospects")
            .select("id")
            .eq("cnpj", p.cnpj)
            .maybeSingle();

          if (existente) {
            prospectExistenteId = existente.id;
            logger.debug(`Prospect com CNPJ ${p.cnpj} já existe, será atualizado`);
          }
        }

        // Buscar ou criar município (considerando município + UF)
        let municipio = null;
        
        // Se tiver UF, buscar considerando município E UF para evitar duplicatas
        if (p.uf) {
          const { data: municipioData } = await supabase
            .from("municipios")
            .select("id, vendedor_id")
            .ilike("nome", p.municipio)
            .ilike("uf", p.uf)
            .maybeSingle();

          if (municipioData) {
            municipio = municipioData;
          } else {
            // Criar município se não existir
            const { data: novoMunicipio } = await supabase
              .from("municipios")
              .insert({
                nome: p.municipio,
                uf: p.uf,
                regiao: 'Centro' // padrão
              } as any)
              .select("id, vendedor_id")
              .single();
            
            if (novoMunicipio) {
              municipio = novoMunicipio;
            }
          }
        } else {
          // Se não tiver UF, buscar apenas por nome
          const { data: municipioData } = await supabase
            .from("municipios")
            .select("id, vendedor_id")
            .ilike("nome", p.municipio)
            .maybeSingle();

          municipio = municipioData;
        }

        // Buscar supervisor_id do vendedor se foi selecionado e não foi informado supervisor
        let supervisorId = supervisorSelecionado || null;
        if (!supervisorId && vendedorSelecionado) {
          const { data: vendedorProfile } = await supabase
            .from("profiles")
            .select("supervisor_id")
            .eq("id", vendedorSelecionado)
            .maybeSingle();
          
          supervisorId = vendedorProfile?.supervisor_id || null;
        }

        // Determinar vendedor_id final: usar selecionado manualmente ou do município
        const vendedorFinal = vendedorSelecionado || municipio?.vendedor_id || null;

        const prospectData = {
          nome_empresa: p.nome_empresa,
          municipio_id: municipio?.id || null,
          vendedor_id: vendedorFinal,
          supervisor_id: supervisorId,
          cnpj: p.cnpj || null,
          cnpj_raiz: p.cnpj_raiz || null,
          dominio: p.dominio || null,
          nome_fantasia: p.nome_fantasia || null,
          perfil_linkedin: p.perfil_linkedin || null,
          segmento: p.segmento || null,
          cnae_codigo: p.cnae_codigo || null,
          cnae_principal: p.cnae_principal || null,
          tipo_estabelecimento: p.tipo_estabelecimento || null,
          total_funcionarios: p.total_funcionarios || null,
          faixa_funcionarios: p.faixa_funcionarios || null,
          faixa_faturamento: p.faixa_faturamento || null,
          porte_empresa: porteEmpresaMapeado,
          contato_principal: p.contato_principal || null,
          email: p.email || null,
          demais_emails: p.demais_emails || null,
          telefone: p.telefone || null,
          demais_telefones: p.demais_telefones || null,
          tipo_logradouro: p.tipo_logradouro || null,
          logradouro: p.logradouro || null,
          numero: p.numero || null,
          cep: p.cep || null,
          bairro: p.bairro || null,
          municipio: p.municipio,
          uf: p.uf || null,
          perfil_facebook: p.perfil_facebook || null,
          perfil_instagram: p.perfil_instagram || null,
          perfil_twitter: p.perfil_twitter || null,
          observacoes: p.observacoes || null,
          importado_planilha: true,
          status: 'novo' as const
        };

        // Se prospect já existe, atualizar; senão, adicionar para inserção
        if (prospectExistenteId) {
          const { error: updateError } = await supabase
            .from("prospects")
            .update(prospectData)
            .eq("id", prospectExistenteId);

          if (updateError) {
            erros.push(`Prospect ${i + 1}: Erro ao atualizar ${p.nome_empresa} - ${updateError.message}`);
            detalhes.push({
              linha: i + 1,
              empresa: p.nome_empresa,
              status: 'erro',
              mensagem: `Erro ao atualizar: ${updateError.message}`
            });
          } else {
            const mensagemSucesso = vendedorFinal 
              ? 'Atualizado e distribuído' 
              : 'Cliente atualizado com sucesso';
            
            detalhes.push({
              linha: i + 1,
              empresa: p.nome_empresa,
              status: 'atualizado',
              mensagem: mensagemSucesso
            });
          }
        } else {
          prospects.push(prospectData);
          detalhes.push({
            linha: i + 1,
            empresa: p.nome_empresa,
            status: vendedorFinal ? 'sucesso' : 'sem_vendedor',
            mensagem: vendedorFinal 
              ? 'Distribuído automaticamente' 
              : 'Município sem vendedor atribuído'
          });
        }
      }

      // Só inserir se houver prospects novos
      if (prospects.length > 0) {
        const { error: insertError } = await supabase
          .from("prospects")
          .insert(prospects);

        if (insertError) {
          console.error("Erro ao inserir:", insertError);
          throw insertError;
        }
      }

      // Contar distribuídos e não distribuídos incluindo atualizados
      const atualizados = detalhes.filter(d => d.status === 'atualizado').length;
      const inseridos = prospects.length;
      const totalProcessadosSucesso = detalhes.filter(d => d.status === 'sucesso' || d.status === 'sem_vendedor' || d.status === 'atualizado').length;
      const distribuidos = detalhes.filter(d => (d.status === 'sucesso' || d.status === 'atualizado') && d.mensagem.includes('Distribuído')).length;
      const nao_distribuidos = totalProcessadosSucesso - distribuidos;

      setResult({
        total: analiseData.prospects.length,
        distribuidos,
        nao_distribuidos,
        atualizados,
        inseridos,
        erros,
        detalhes
      });

      toast({
        title: "✨ Importação com IA concluída",
        description: `${inseridos} ${inseridos === 1 ? 'inserido' : 'inseridos'}, ${atualizados} ${atualizados === 1 ? 'atualizado' : 'atualizados'}`,
      });

      setTextoIA(""); // Limpar campo

    } catch (error: any) {
      console.error("❌ Erro na importação com IA:", error);
      toast({
        title: "Erro na importação",
        description: error.message || "Erro ao processar dados com IA",
        variant: "destructive",
      });
    } finally {
      setLoadingIA(false);
    }
  };

  const downloadTemplate = async () => {
    const columns = [
      { header: "Nome da empresa", key: "nome_empresa", width: 30 },
      { header: "CNPJ", key: "cnpj", width: 20 },
      { header: "CNPJ Raiz", key: "cnpj_raiz", width: 15 },
      { header: "Domínio", key: "dominio", width: 20 },
      { header: "Nome Fantasia", key: "nome_fantasia", width: 25 },
      { header: "Perfil do LinkedIn", key: "perfil_linkedin", width: 30 },
      { header: "Segmento", key: "segmento", width: 20 },
      { header: "CNAE principal (Código)", key: "cnae_codigo", width: 20 },
      { header: "CNAE principal", key: "cnae_principal", width: 30 },
      { header: "Tipo de Estabelecimento", key: "tipo_estabelecimento", width: 20 },
      { header: "Porte da empresa", key: "porte_empresa", width: 15 },
      { header: "Total de funcionários", key: "total_funcionarios", width: 20 },
      { header: "Faixa de funcionários", key: "faixa_funcionarios", width: 20 },
      { header: "Faixa de faturamento", key: "faixa_faturamento", width: 20 },
      { header: "Total de filiais", key: "total_filiais", width: 15 },
      { header: "Tipo de entidade", key: "tipo_entidade", width: 20 },
      { header: "Natureza jurídica", key: "natureza_juridica", width: 20 },
      { header: "Data de abertura", key: "data_abertura", width: 15 },
      { header: "Nível de atividade", key: "nivel_atividade", width: 15 },
      { header: "Tendência de crescimento", key: "tendencia_crescimento", width: 20 },
      { header: "Telefone principal", key: "telefone", width: 20 },
      { header: "Demais telefones", key: "demais_telefones", width: 25 },
      { header: "Endereço completo", key: "endereco", width: 40 },
      { header: "Tipo de logradouro", key: "tipo_logradouro", width: 15 },
      { header: "Logradouro", key: "logradouro", width: 30 },
      { header: "Número", key: "numero", width: 10 },
      { header: "CEP", key: "cep", width: 12 },
      { header: "Bairro", key: "bairro", width: 20 },
      { header: "Município", key: "municipio", width: 20 },
      { header: "UF", key: "uf", width: 5 },
      { header: "Email principal", key: "email", width: 30 },
      { header: "Demais emails", key: "demais_emails", width: 30 },
      { header: "Perfil do facebook", key: "perfil_facebook", width: 25 },
      { header: "Perfil do instagram", key: "perfil_instagram", width: 25 },
      { header: "Perfil do twitter", key: "perfil_twitter", width: 25 },
      { header: "URL company page", key: "url_company_page", width: 30 },
      { header: "Situação", key: "situacao", width: 15 },
      { header: "Território", key: "territorio", width: 15 },
      { header: "TRM", key: "trm", width: 15 },
      { header: "Faixa Score Propensão", key: "faixa_score_propensao", width: 20 },
      { header: "Score Propensão", key: "score_propensao", width: 15 },
      { header: "Faixa Score Contactability", key: "faixa_score_contactability", width: 25 },
      { header: "Variação Score Propensão", key: "variacao_score_propensao", width: 25 },
    ];

    const sampleData = [{
      nome_empresa: "Empresa Exemplo Ltda",
      cnpj: "11.222.333/0001-81",
      cnpj_raiz: "11222333",
      dominio: "exemplo.com.br",
      nome_fantasia: "Exemplo",
      perfil_linkedin: "linkedin.com/company/exemplo",
      segmento: "Tecnologia",
      cnae_codigo: "6201-5/00",
      cnae_principal: "Desenvolvimento de programas",
      tipo_estabelecimento: "Matriz",
      porte_empresa: "Pequeno",
      total_funcionarios: "50",
      faixa_funcionarios: "11-50",
      faixa_faturamento: "R$ 1M-10M",
      total_filiais: "3",
      tipo_entidade: "Empresa Privada",
      natureza_juridica: "LTDA",
      data_abertura: "01/01/2020",
      nivel_atividade: "Ativo",
      tendencia_crescimento: "Crescimento",
      telefone: "(11) 99999-9999",
      demais_telefones: "(11) 88888-8888",
      endereco: "Rua Exemplo, 123, Sala 10",
      tipo_logradouro: "Rua",
      logradouro: "Exemplo",
      numero: "123",
      cep: "01234-567",
      bairro: "Centro",
      municipio: "São Paulo",
      uf: "SP",
      email: "contato@exemplo.com",
      demais_emails: "vendas@exemplo.com",
      perfil_facebook: "facebook.com/exemplo",
      perfil_instagram: "instagram.com/exemplo",
      perfil_twitter: "twitter.com/exemplo",
      url_company_page: "exemplo.com.br",
      situacao: "Ativa",
      territorio: "Sul",
      trm: "Regional Sul",
      faixa_score_propensao: "Alto",
      score_propensao: "85",
      faixa_score_contactability: "Médio",
      variacao_score_propensao: "5",
    }];

    await createImportTemplate(columns, 'template_importacao_completo', sampleData);
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Apenas administradores podem importar clientes.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Importar Clientes</h2>
          <p className="text-muted-foreground">
            Importe clientes em massa e distribua automaticamente por município
          </p>
        </div>

        <Tabs defaultValue="tradicional" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tradicional">Importação Tradicional</TabsTrigger>
            <TabsTrigger value="ia">
              <Sparkles className="h-4 w-4 mr-2" />
              Importação com IA
            </TabsTrigger>
            <TabsTrigger value="cnpj">
              <Search className="h-4 w-4 mr-2" />
              Buscar por CNPJ
            </TabsTrigger>
            <TabsTrigger value="api">
              Busca Avançada
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tradicional" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
            <CardHeader>
              <CardTitle>Upload de Arquivo</CardTitle>
              <CardDescription>
                Selecione um arquivo CSV ou Excel com os dados dos clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Arquivo selecionado: {file.name}
                  </p>
                )}
              </div>
              <Button
                onClick={handleImport}
                disabled={!file || loading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {loading ? "Importando..." : "Importar"}
              </Button>
              </CardContent>
            </Card>

            <Card>
            <CardHeader>
              <CardTitle>Modelo de Importação</CardTitle>
              <CardDescription>
                Baixe o modelo Excel com os campos necessários
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <p className="font-medium">Campos obrigatórios:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Nome da empresa</li>
                  <li>Município</li>
                </ul>
                <p className="font-medium mt-4">Campos disponíveis (43 campos):</p>
                <p className="text-xs text-muted-foreground">
                  O modelo inclui todos os campos: dados cadastrais, CNPJ, endereço completo, 
                  contatos, redes sociais, dados financeiros, scores de propensão e muito mais.
                </p>
              </div>
              <Button onClick={downloadTemplate} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Baixar Modelo Excel
              </Button>
            </CardContent>
          </Card>
            </div>
          </TabsContent>

          <TabsContent value="ia" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Importação Inteligente com IA
                </CardTitle>
                <CardDescription>
                  Cole os dados da sua planilha ou insira informações não estruturadas. 
                  A IA vai analisar e cadastrar automaticamente os prospects.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendedor-ia">Vendedor Responsável (Opcional)</Label>
                    <Select 
                      value={vendedorSelecionado} 
                      onValueChange={setVendedorSelecionado}
                      disabled={currentUserRole === 'vendedor' || currentUserRole === 'promotor'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Usar distribuição automática" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Usar distribuição automática</SelectItem>
                        {vendedores.map((vendedor) => (
                          <SelectItem key={vendedor.id} value={vendedor.id}>
                            {vendedor.nome} - {vendedor.role === 'vendedor' ? 'Vendedor' : 'Promotor'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Se não selecionar, será usado o vendedor do município
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supervisor-ia">Supervisor (Opcional)</Label>
                    <Select 
                      value={supervisorSelecionado || "none"} 
                      onValueChange={(value) => setSupervisorSelecionado(value === "none" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Usar supervisor do vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Usar supervisor do vendedor</SelectItem>
                        {supervisores.map((supervisor) => (
                          <SelectItem key={supervisor.id} value={supervisor.id}>
                            {supervisor.nome} - {supervisor.role === 'supervisor' ? 'Supervisor' : 'Admin'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="textoIA">Dados para Análise</Label>
                  <Textarea
                    id="textoIA"
                    placeholder="Cole aqui os dados da sua planilha (pode ser do Excel, Google Sheets, ou até mesmo uma lista não estruturada de empresas)...

Exemplo:
- Empresa ABC, São Paulo/SP, contato@empresa.com
- Empresa XYZ Ltda - Rio de Janeiro - (21) 99999-9999
- Nome: Empresa DEF | Cidade: Belo Horizonte | Porte: Pequeno"
                    value={textoIA}
                    onChange={(e) => setTextoIA(e.target.value)}
                    disabled={loadingIA}
                    className="min-h-[300px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Dica: A IA consegue interpretar diferentes formatos. Quanto mais informações, melhor!
                  </p>
                </div>

                <Button
                  onClick={handleImportIA}
                  disabled={!textoIA.trim() || loadingIA}
                  className="w-full"
                  size="lg"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {loadingIA ? "Analisando com IA..." : "Analisar e Importar com IA"}
                </Button>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-1">Como funciona:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>A IA analisa os dados e identifica todas as empresas mencionadas</li>
                      <li>Extrai informações como nome, município, contato, CNPJ, etc.</li>
                      <li>Normaliza e padroniza os dados automaticamente</li>
                      <li>Cadastra os prospects no sistema</li>
                      <li>Se vendedor for selecionado, todos os prospects serão atribuídos a ele</li>
                      <li>Caso contrário, usa a distribuição automática por município</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cnpj" className="space-y-4">
            <CNPJBizCreditos />
            <CNPJBizSearch onImportComplete={() => toast({ title: "Prospect importado com sucesso!" })} />
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <CNPJBizCreditos />
            
            {!showPreview ? (
              <CNPJBizFilters 
                onSearch={(filters, count) => {
                  setApiFilters(filters);
                  setApiCount(count);
                  setShowPreview(true);
                }}
              />
            ) : (
              <CNPJBizPreview
                filters={apiFilters}
                totalCount={apiCount}
                onBack={() => setShowPreview(false)}
                onComplete={() => {
                  setShowPreview(false);
                  setApiFilters(null);
                  setApiCount(0);
                }}
              />
            )}
          </TabsContent>
        </Tabs>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Resultado da Importação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-sm text-muted-foreground">Total Processados</div>
                </div>
                <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{result.inseridos}</div>
                  <div className="text-sm text-muted-foreground">Inseridos</div>
                </div>
                <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{result.atualizados}</div>
                  <div className="text-sm text-muted-foreground">Atualizados</div>
                </div>
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <div className="text-2xl font-bold text-success">{result.distribuidos}</div>
                  <div className="text-sm text-muted-foreground">Distribuídos</div>
                </div>
                <div className="text-center p-4 bg-warning/10 rounded-lg">
                  <div className="text-2xl font-bold text-warning">{result.nao_distribuidos}</div>
                  <div className="text-sm text-muted-foreground">Sem vendedor</div>
                </div>
              </div>

              {result.detalhes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Detalhes:</h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {result.detalhes.map((detalhe, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {detalhe.status === 'sucesso' ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : detalhe.status === 'atualizado' ? (
                            <CheckCircle className="h-4 w-4 text-purple-600" />
                          ) : detalhe.status === 'sem_vendedor' ? (
                            <AlertCircle className="h-4 w-4 text-warning" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm font-medium">{detalhe.empresa}</span>
                        </div>
                        <Badge variant={
                          detalhe.status === 'sucesso' ? 'default' : 
                          detalhe.status === 'atualizado' ? 'secondary' :
                          detalhe.status === 'sem_vendedor' ? 'secondary' : 
                          'destructive'
                        }>
                          {detalhe.mensagem}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.erros.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">Erros encontrados:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {result.erros.map((erro, idx) => (
                        <li key={idx}>{erro}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ImportarClientes;
