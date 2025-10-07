import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from 'xlsx';

interface ImportResult {
  total: number;
  distribuidos: number;
  nao_distribuidos: number;
  erros: string[];
  detalhes: Array<{
    linha: number;
    empresa: string;
    status: 'sucesso' | 'erro' | 'sem_vendedor';
    mensagem: string;
  }>;
}

const ImportarClientes = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
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

  const handleImport = async () => {
    if (!file) return;

    console.log("🚀 Iniciando importação do arquivo:", file.name);
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
      console.log("📖 Arquivo lido com sucesso, processando...");
      try {
        const data = e.target?.result;
        let rows: any[] = [];
        let headers: string[] = [];

        // Processar Excel
        if (extension === 'xlsx' || extension === 'xls') {
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
          
          if (jsonData.length < 2) {
            throw new Error("Arquivo vazio ou sem dados");
          }
          
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

          // Verificar duplicata por CNPJ
          if (cnpjValidado) {
            const { data: existente } = await supabase
              .from("prospects")
              .select("id")
              .eq("cnpj", cnpjValidado)
              .maybeSingle();

            if (existente) {
              erros.push(`Linha ${i + 1}: CNPJ ${cnpjValidado} já cadastrado`);
              detalhes.push({
                linha: i + 1,
                empresa: nome_empresa,
                status: 'erro',
                mensagem: 'CNPJ duplicado'
              });
              continue;
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
                })
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
                console.log(`Município criado: ${municipioFinal}/${ufFinal}`);
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

          // Mapear porte da empresa para valores válidos (MEI, ME, EPP, Grande)
          const mapearPorteEmpresa = (porte: string): string | null => {
            if (!porte || porte.trim() === '') return null;
            const porteNormalizado = porte.toLowerCase().trim();
            
            // Mapeamento de variações comuns
            const mapeamento: Record<string, string> = {
              'mei': 'MEI',
              'microempreendedor': 'MEI',
              'microempreendedor individual': 'MEI',
              'me': 'ME',
              'micro': 'ME',
              'microempresa': 'ME',
              'micro empresa': 'ME',
              'epp': 'EPP',
              'pequena': 'EPP',
              'pequeno': 'EPP',
              'pequeno porte': 'EPP',
              'empresa de pequeno porte': 'EPP',
              'grande': 'Grande',
              'medio': 'Grande',
              'média': 'Grande',
              'grande porte': 'Grande'
            };

            // Tentar encontrar um mapeamento
            for (const [key, value] of Object.entries(mapeamento)) {
              if (porteNormalizado.includes(key)) {
                return value;
              }
            }

            // Se não encontrar, retornar null
            console.warn(`⚠️ Porte empresa não reconhecido: "${porte}" - usando null`);
            return null;
          };

          const porteEmpresaRaw = (values[porteIdx] || '').trim().replace(/^["']|["']$/g, '');
          const porteEmpresaMapeado = mapearPorteEmpresa(porteEmpresaRaw);

          prospects.push({
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
            porte_empresa: porteEmpresaMapeado,
            total_funcionarios: parseNumber(values[totalFuncionariosIdx] || ''),
            faixa_funcionarios: (values[faixaFuncionariosIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
            faixa_faturamento: (values[faixaFaturamentoIdx] || '').trim().replace(/^["']|["']$/g, '') || null,
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
            status: 'novo'
          });

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

        if (prospects.length === 0) {
          throw new Error("Nenhum registro válido encontrado para importar.");
        }

        const { data: inserted, error: insertError } = await supabase
          .from("prospects")
          .insert(prospects)
          .select();

        if (insertError) {
          throw insertError;
        }

        const distribuidos = prospects.filter(p => p.vendedor_id).length;
        const nao_distribuidos = prospects.length - distribuidos;

        setResult({
          total: prospects.length,
          distribuidos,
          nao_distribuidos,
          erros,
          detalhes
        });

        console.log("✅ Importação concluída:", {
          total: prospects.length,
          distribuidos,
          nao_distribuidos
        });
        
        toast({
          title: "Importação concluída",
          description: `${distribuidos} clientes distribuídos, ${nao_distribuidos} pendentes`,
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

    console.log("📂 Iniciando leitura do arquivo...");
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws_data = [
      [
        "Nome da empresa", "CNPJ", "CNPJ Raiz", "Domínio", "Nome Fantasia", "Perfil do LinkedIn", 
        "Segmento", "CNAE principal (Código)", "CNAE principal", "Tipo de Estabelecimento", 
        "Porte da empresa", "Total de funcionários", "Faixa de funcionários", "Faixa de faturamento", 
        "Total de filiais", "Tipo de entidade", "Natureza jurídica", "Data de abertura", 
        "Nível de atividade", "Tendência de crescimento", "Telefone principal", "Demais telefones", 
        "Endereço completo", "Tipo de logradouro", "Logradouro", "Número", "CEP", "Bairro", 
        "Município", "UF", "Email principal", "Demais emails", "Perfil do facebook", 
        "Perfil do instagram", "Perfil do twitter", "URL company page", "Situação", "Território", 
        "TRM", "Faixa Score Propensão", "Score Propensão", "Faixa Score Contactability", 
        "Variação Score Propensão"
      ],
      [
        "Empresa Exemplo Ltda", "11.222.333/0001-81", "11222333", "exemplo.com.br", "Exemplo", 
        "linkedin.com/company/exemplo", "Tecnologia", "6201-5/00", "Desenvolvimento de programas", 
        "Matriz", "Pequeno", "50", "11-50", "R$ 1M-10M", "3", "Empresa Privada", "LTDA", 
        "01/01/2020", "Ativo", "Crescimento", "(11) 99999-9999", "(11) 88888-8888", 
        "Rua Exemplo, 123, Sala 10", "Rua", "Exemplo", "123", "01234-567", "Centro", 
        "São Paulo", "SP", "contato@exemplo.com", "vendas@exemplo.com", 
        "facebook.com/exemplo", "instagram.com/exemplo", "twitter.com/exemplo", 
        "exemplo.com.br", "Ativa", "Sul", "Regional Sul", "Alto", "85", "Médio", "5"
      ]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, 'template_importacao_completo.xlsx');
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

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Resultado da Importação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
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
                          ) : detalhe.status === 'sem_vendedor' ? (
                            <AlertCircle className="h-4 w-4 text-warning" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm font-medium">{detalhe.empresa}</span>
                        </div>
                        <Badge variant={
                          detalhe.status === 'sucesso' ? 'default' : 
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
