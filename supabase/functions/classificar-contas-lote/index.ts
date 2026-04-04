import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

// ========== DICIONÁRIO DE→PARA: Mapeamento profissional das 248 categorias ERP ==========
// Prioridade: 1º DB (revisado_manualmente) → 2º Dicionário → 3º IA
const DICIONARIO_CATEGORIAS: Record<string, { codigo: string; justificativa: string }> = {
  // ── RECEITA (Grupo 1) ──
  "CHEQUE": { codigo: "1.3", justificativa: "Receita via cheque" },
  "CHEQUE DEVOLVIDO (+)": { codigo: "1.3", justificativa: "Cheque devolvido - ajuste de receita" },
  "DEPOSITO CHEQUE DEVOLVIDO": { codigo: "1.3", justificativa: "Depósito cheque devolvido" },
  "CLIENTES": { codigo: "1.1", justificativa: "Recebimento de clientes via boleto" },
  "CONSUMIDOR": { codigo: "1.2", justificativa: "Recebimento de consumidor via depósito" },
  "VENDAS DIRETO": { codigo: "1.2", justificativa: "Vendas diretas - receita" },
  "RECEBIVEIS ": { codigo: "1.1", justificativa: "Recebíveis - receita" },
  "RENDIMENTO APLIC AUTOM": { codigo: "4.3.5", justificativa: "Receita financeira de aplicação automática" },
  "TRANSFERENCIA (+)": { codigo: "4.3.5", justificativa: "Transferência positiva - receita financeira" },
  "TRANSFERENCIA (-)": { codigo: "4.3.1", justificativa: "Transferência negativa - saída financeira" },
  "ESTORNO DE PAGAMENTO": { codigo: "4.1.1", justificativa: "Estorno - receita não operacional" },

  // ── CUSTOS VARIÁVEIS - Fornecedores (Grupo 2.1) ──
  "COMPRA DE MERCADORIA PARA REVENDA": { codigo: "2.1.1", justificativa: "Compra de mercadoria para revenda - custo direto" },
  "RUBY ROSE - MARCA": { codigo: "2.1.1", justificativa: "Compras da marca Ruby Rose" },
  "PRODUTOS": { codigo: "2.1.1", justificativa: "Compra de produtos para revenda" },
  "PRODUTOS/ACESSORIOS": { codigo: "2.1.1", justificativa: "Compra de produtos e acessórios" },
  "PRODUTOS PARA DISPLAY": { codigo: "2.1.1", justificativa: "Produtos para exposição/display" },
  "PRODUTOS P/ UTILIZAÇÃO DOS TECNICOS": { codigo: "2.1.1", justificativa: "Produtos para uso dos técnicos" },
  "FRETE DEVOLUÇÃO DE VENDAS": { codigo: "2.1.2", justificativa: "Frete de devolução de vendas" },
  "FRETE PARA DEVOLUÇÃO": { codigo: "2.1.2", justificativa: "Frete para devolução" },
  "PAGAMENTOS DE DEVOLUÇÃO": { codigo: "2.1.2", justificativa: "Pagamentos de devolução a clientes" },
  "DESCONTOS COMERCIAIS ": { codigo: "2.1.3", justificativa: "Descontos comerciais concedidos" },

  // ── CUSTOS VARIÁVEIS - Embalagens (Grupo 2.2) ──
  "EMBALAGENS": { codigo: "2.2.1", justificativa: "Embalagem primária (caixas, sacos, sacolas)" },
  "CAIXAS TERCIARIA": { codigo: "2.2.3", justificativa: "Embalagem terciária (paletes, stretch)" },
  "ETIQUETAS DIVERSAS": { codigo: "2.2.4", justificativa: "Materiais de postagem (etiquetas, lacres)" },

  // ── CUSTOS VARIÁVEIS - Frete/Logística (Grupo 2.4) ──
  "FRETES AGREGADOS": { codigo: "2.4.2", justificativa: "Fretes com agregados/freelances" },
  "FRETE TRANSF. FORNECEDOR": { codigo: "2.4.1", justificativa: "Frete transferência fornecedor - transportadora" },
  "FRETE TRANSF. TERCEIRISTA": { codigo: "2.4.1", justificativa: "Frete transferência terceirista - transportadora" },
  "FRETE PARA REPRESENTANTES": { codigo: "2.4.1", justificativa: "Frete para representantes - transportadora" },
  "FRETE REENTREGA DE VENDAS": { codigo: "2.4.1", justificativa: "Reentrega de vendas - transportadora" },
  "TRANSPORTADORA/VENDAS ONLINE": { codigo: "2.4.1", justificativa: "Transportadora para vendas online" },
  "CORREIOS/VENDAS ONLINE": { codigo: "2.4.3", justificativa: "Correios para vendas online" },
  "LOGÍSTICA": { codigo: "2.4.1", justificativa: "Logística - transportadoras" },
  "CARGA E DESCARGA": { codigo: "2.4.2", justificativa: "Carga e descarga - agregados" },
  "ARMAZENAGEM MERCADORIA": { codigo: "2.4.1", justificativa: "Armazenagem de mercadoria" },
  "ESCOLTA": { codigo: "2.4.4", justificativa: "Escolta de carga" },
  "SEGURO DE TRANSPORTE / OUTROS": { codigo: "2.4.5", justificativa: "Seguro da mercadoria em transporte" },

  // ── CUSTOS VARIÁVEIS - Impostos sobre Vendas (Grupo 2.5) ──
  "SIMPLES NACIONAL": { codigo: "2.5.1", justificativa: "Simples Nacional - imposto federal" },
  "IMPOSTO FEDERAL": { codigo: "2.5.1", justificativa: "Imposto federal - Simples Nacional" },
  "TRIBUTOS FEDERAIS": { codigo: "2.5.1", justificativa: "Tributos federais" },
  "ICMS": { codigo: "2.5.2", justificativa: "ICMS - imposto estadual" },
  "IMPOSTO ESTADUAL": { codigo: "2.5.2", justificativa: "Imposto estadual - ICMS/GNRE" },
  "TRIBUTOS ESTADUAIS": { codigo: "2.5.2", justificativa: "Tributos estaduais - ICMS/GNRE" },
  "IMPOSTO MUNICIPAL": { codigo: "3.1.6.1", justificativa: "Imposto municipal - IPTU" },
  "TRIBUTOS MUNICIPAIS": { codigo: "3.1.6.2", justificativa: "Tributos municipais" },
  "IMPOSTOS/TAXAS": { codigo: "3.1.6.2", justificativa: "Impostos e taxas diversas" },
  "IMPOSTOS- APLICA FINANCEIRA": { codigo: "3.1.6.2", justificativa: "Impostos sobre aplicação financeira" },
  "TFLF- TX. FISC. LOCALIZ. E FUNCIONAMENTO": { codigo: "3.1.6.2", justificativa: "Taxa de fiscalização" },
  "TFS- TX FISC. SANITARIA": { codigo: "3.1.6.2", justificativa: "Taxa de fiscalização sanitária" },
  "TAXAS EM GERAL / MULTAS": { codigo: "3.1.6.2", justificativa: "Taxas e multas gerais" },
  "SISTEMA FISCAL TRIBUTÁRIO": { codigo: "3.1.22", justificativa: "Sistema fiscal tributário - software" },
  "VIGILANCIA SANITARIA": { codigo: "3.1.6.2", justificativa: "Taxa de vigilância sanitária" },

  // ── CUSTOS VARIÁVEIS - Comissões (Grupo 2.6) ──
  "COMISSAO": { codigo: "2.6.1", justificativa: "Comissões de vendas" },
  "REPRESENTANTE": { codigo: "2.6.1", justificativa: "Comissão de representante" },
  "REPRESENTANTES": { codigo: "2.6.1", justificativa: "Comissões de representantes" },
  "REPRESENTANTES ": { codigo: "2.6.1", justificativa: "Comissões de representantes" },
  "COORDENADORES": { codigo: "2.6.1", justificativa: "Comissões de coordenadores" },
  "GERENTES": { codigo: "2.6.1", justificativa: "Comissões de gerentes" },
  "SUPERVISORES": { codigo: "2.6.1", justificativa: "Comissões de supervisores" },
  "PROMOTOR": { codigo: "2.6.2", justificativa: "Promotor - trade comercial" },
  "PROMOTORAS": { codigo: "2.6.2", justificativa: "Promotoras - trade comercial" },
  "PROMOTORAS/REPOSITORES/FREE E BICOS": { codigo: "2.6.2", justificativa: "Promotoras/repositores - trade comercial" },
  "RECEPCIONISTA/PROMOTORAS/MAQUIADORAS": { codigo: "2.6.2", justificativa: "Recepcionistas/promotoras - trade" },
  "TABLOIDS/NEGOCIAÇÕES ": { codigo: "2.6.2", justificativa: "Tabloids e negociações comerciais" },

  // ── CUSTOS VARIÁVEIS - Taxas Marketplace (Grupo 2.7) ──
  "TAXAS ADMINISTRATIVAS": { codigo: "2.7.1", justificativa: "Taxas administrativas marketplace" },
  "TAXAS REF. SERVIÇOS DE TERCEIROS": { codigo: "2.7.1", justificativa: "Taxas de serviços de terceiros" },

  // ── DESPESAS FIXAS - Aluguel (Grupo 3.1.1) ──
  "ALUGUEL DE DEPÓSITO": { codigo: "3.1.1.1", justificativa: "Aluguel do depósito" },
  "ALUGUEL DE ESCRITÓRIO": { codigo: "3.1.1.2", justificativa: "Aluguel do escritório" },
  "ALUGUEL EQUIPAMENTO DE ESCRITÓRIO": { codigo: "3.1.19", justificativa: "Locação de equipamento de escritório" },

  // ── DESPESAS FIXAS - Utilidades (Grupo 3.1.2-3.1.5) ──
  "ELETRICIDADE DEPOSITO": { codigo: "3.1.2", justificativa: "Energia elétrica do depósito" },
  "ELETRICIDADE ESCRITORIO": { codigo: "3.1.2", justificativa: "Energia elétrica do escritório" },
  "ELETRICIDADE RESIDENCIAL": { codigo: "3.1.2", justificativa: "Energia elétrica residencial (uso empresarial)" },
  "AGUA DEPOSITO": { codigo: "3.1.3", justificativa: "Conta de água do depósito" },
  "AGUA ESCRITORIO": { codigo: "3.1.3", justificativa: "Conta de água do escritório" },
  "INTERNET/MANUTENÇÃO SERVIDOR": { codigo: "3.1.4", justificativa: "Internet e manutenção de servidor" },
  "PROVEDOR": { codigo: "3.1.4", justificativa: "Provedor de internet" },
  "INFORMATICA/REDE": { codigo: "3.1.4", justificativa: "Informática e rede" },
  "TELEFONIA FIXA": { codigo: "3.1.5.1", justificativa: "Telefonia fixa" },
  "TELEFONIA MOVEL": { codigo: "3.1.5.2", justificativa: "Telefonia móvel" },
  "TELEFONIA - ASSISTENCIA E EQUIPAMENTOS": { codigo: "3.1.5.2", justificativa: "Telefonia - assistência e equipamentos" },
  "EQUIPAMENTO TELEFONICO (PABX)": { codigo: "3.1.5.1", justificativa: "PABX - telefonia fixa" },
  "CONSERTO TELEFONE E OUTROS": { codigo: "3.1.5.2", justificativa: "Conserto de telefone" },

  // ── DESPESAS FIXAS - Impostos Prediais (Grupo 3.1.6) ──
  "CUSTO DEPÓSITO": { codigo: "3.1.6.1", justificativa: "Custo predial do depósito" },
  "CUSTO ESCRITÓRIO": { codigo: "3.1.6.1", justificativa: "Custo predial do escritório" },

  // ── DESPESAS FIXAS - Material de Escritório (Grupo 3.1.7) ──
  "MATERIAIS DE ESCRITÓRIO": { codigo: "3.1.7", justificativa: "Material de escritório" },
  "MATERIAIS / FERRAMENTAS": { codigo: "3.1.7", justificativa: "Materiais e ferramentas" },
  "FERRAMENTAS E ACEESSORIOS": { codigo: "3.1.7", justificativa: "Ferramentas e acessórios" },
  "MATERIAL ELETRICO": { codigo: "3.1.7", justificativa: "Material elétrico" },
  "GARRAFAS DE ÁGUA": { codigo: "3.1.14", justificativa: "Garrafas de água - copa" },

  // ── DESPESAS FIXAS - Serviços Terceirizados (Grupo 3.1.8) ──
  "SEGURANÇA": { codigo: "3.1.8.1", justificativa: "Segurança patrimonial" },
  "SEGURANÇA - SERVIÇOS": { codigo: "3.1.8.1", justificativa: "Serviços de segurança" },
  "MONITORAMENTO": { codigo: "3.1.8.1", justificativa: "Monitoramento de segurança" },
  "CUSTO EQUIPAMENTO DE ALARME": { codigo: "3.1.8.1", justificativa: "Equipamento de alarme/segurança" },
  "CAMERAS": { codigo: "3.1.8.1", justificativa: "Câmeras de segurança" },
  "EQUIPAMENTO DE SEGURANÇA / INCENDIO": { codigo: "3.1.8.1", justificativa: "Equipamento de segurança/incêndio" },
  "EQUIPAMENTOS DE INCENDIOS": { codigo: "3.1.8.1", justificativa: "Equipamentos de incêndio" },
  "DEDETIZAÇÃO": { codigo: "3.1.8.5", justificativa: "Dedetização" },
  "CONTABILIDADE EXTERNA": { codigo: "3.1.8.3", justificativa: "Contabilidade terceirizada" },
  "CONTABILIDADE INTERNA": { codigo: "3.1.8.3", justificativa: "Contabilidade interna" },
  "SERVIÇOS DE FREELANCER": { codigo: "3.1.8.4", justificativa: "Serviços de freelancer" },
  "SERVIÇOS DE TERCEIROS": { codigo: "3.1.8.9", justificativa: "Serviços de terceiros diversos" },
  "SERVIÇOS PRESTADOS/TERCEIROS": { codigo: "3.1.8.9", justificativa: "Serviços prestados por terceiros" },
  "PRESTAÇÃO DE SERVIÇOS/TERCEIRIZADO": { codigo: "3.1.8.9", justificativa: "Prestação de serviços terceirizada" },
  "PRESTAÇÃO DE SERVIÇOS/ESTAGIOS / MOTOBOY": { codigo: "3.1.8.9", justificativa: "Serviços: estágios, motoboy" },
  "PRESTADOR PESSOA JURIDICA": { codigo: "3.1.8.4", justificativa: "Prestador PJ - freelancer" },
  "CONTRATADO PJ": { codigo: "3.1.8.4", justificativa: "Contratado PJ" },
  "SERASA": { codigo: "3.1.8.7", justificativa: "Consulta Serasa" },
  "CONSULTA DE CREDITO": { codigo: "3.1.8.7", justificativa: "Consulta de crédito - Serasa" },
  "LEGAL - GERAL/HONORARIOS ADVOCATICIO": { codigo: "3.1.8.8", justificativa: "Honorários advocatícios" },
  "LEGAL - TRADEMARK ETC": { codigo: "3.1.8.8", justificativa: "Custos jurídicos - marcas/patentes" },
  "PROCESSO TRABALHISTAS": { codigo: "3.1.8.8", justificativa: "Processos trabalhistas - jurídico" },
  "RECICLAGEM": { codigo: "3.1.8.9", justificativa: "Serviço de reciclagem" },

  // ── DESPESAS FIXAS - Manutenção (Grupo 3.1.9) ──
  "MANUTENÇÃO EQUIPAMENTO ESCRITÓRIO/DEPÓSITO": { codigo: "3.1.9.2", justificativa: "Manutenção de equipamentos" },
  "MANUTENÇÃO / ACESSORIOS": { codigo: "3.1.9.2", justificativa: "Manutenção e acessórios" },
  "MANUTENÇÃO MAQUINA DE ANALISE": { codigo: "3.1.9.2", justificativa: "Manutenção de máquinas" },
  "REDE ELETRICA": { codigo: "3.1.9.1", justificativa: "Manutenção rede elétrica predial" },
  "MATERIAL PARA REFORMA": { codigo: "3.1.9.1", justificativa: "Material para reforma predial" },
  "REFORMA NOVO BARRACÃO": { codigo: "3.1.9.1", justificativa: "Reforma do barracão" },

  // ── DESPESAS FIXAS - Veículos (Grupo 3.1.10) ──
  "DISPESAS DE COMBUSTIVEL": { codigo: "3.1.10.3", justificativa: "Despesas de combustível" },
  "KM/PEDAGIOS/OUTROS": { codigo: "3.1.10.2", justificativa: "Km/pedágios - veículos" },

  // ── DESPESAS FIXAS - Seguro (Grupo 3.1.11) ──
  "SEGURO BENS": { codigo: "3.1.11.3", justificativa: "Seguro de bens e equipamentos" },
  "SEGURO DE PESSOAL": { codigo: "3.2.12.2", justificativa: "Seguro de pessoal → Plano de Saúde (RH)" },
  "SEGURO DEPOSITO": { codigo: "3.1.11.1", justificativa: "Seguro do galpão/depósito" },
  "SEGUROESCRITORIO": { codigo: "3.1.11.2", justificativa: "Seguro do escritório" },

  // ── DESPESAS FIXAS - Cartório (Grupo 3.1.12) ──
  "CUSTAS CARTORIO": { codigo: "3.1.12", justificativa: "Custas de cartório" },
  "DESPESAS CARTORIO": { codigo: "3.1.12", justificativa: "Despesas de cartório" },

  // ── DESPESAS FIXAS - Correios (Grupo 3.1.13) ──
  "DESPESAS CORREIO (ADM)": { codigo: "3.1.13", justificativa: "Correios administrativo" },

  // ── DESPESAS FIXAS - Material Limpeza/Copa (Grupo 3.1.14) ──
  "MATERIAL DE COPA E COZINHA": { codigo: "3.1.14", justificativa: "Material de copa e cozinha" },
  "MATERIAL PARA SEGURANÇA NO TRABALHO": { codigo: "3.1.14", justificativa: "Material segurança trabalho" },

  // ── DESPESAS FIXAS - Transporte (Grupo 3.1.15) ──
  "ESTACIONAMENTO / OUTROS": { codigo: "3.1.15", justificativa: "Estacionamento - uber/táxi" },
  "PASSAGENS": { codigo: "3.1.15", justificativa: "Passagens - transporte" },
  "PASSAGENS/TAXI": { codigo: "3.1.15", justificativa: "Passagens e táxi" },
  "PASSAGENS/TRANSPORTES": { codigo: "3.1.15", justificativa: "Passagens e transportes" },
  "TRANSPORTE/PASSAGEM": { codigo: "3.1.15", justificativa: "Transporte e passagem" },

  // ── DESPESAS FIXAS - Refeições (Grupo 3.1.16) ──
  "LANCHES E REFEIÇÕES": { codigo: "3.1.16", justificativa: "Lanches e refeições" },
  "ALIMENTAÇÃO": { codigo: "3.1.16", justificativa: "Alimentação - refeições" },
  "ALIMENTAÇÃO/BEBIDAS": { codigo: "3.1.16", justificativa: "Alimentação e bebidas" },

  // ── DESPESAS FIXAS - Reembolso (Grupo 3.1.17) ──
  "REEMBOLSO": { codigo: "3.1.17", justificativa: "Reembolso de despesas" },
  "REEMBOLSOS DIVERSOS": { codigo: "3.1.17", justificativa: "Reembolsos diversos" },
  "DESPESAS PAGAS C/DINHEIRO (COFRE)CHEQUES": { codigo: "3.1.17", justificativa: "Despesas pagas em dinheiro" },

  // ── DESPESAS FIXAS - Viagem (Grupo 3.1.18) ──
  "DESPESAS DE VIAGEM": { codigo: "3.1.18", justificativa: "Despesas de viagem" },
  "DESPESAS DE DESLOCAMENTO / ALIMENTAÇÃO": { codigo: "3.1.18", justificativa: "Despesas de deslocamento" },
  "HOSPEDAGEM/HOTEL": { codigo: "3.1.18", justificativa: "Hospedagem/hotel" },
  "HOTEL": { codigo: "3.1.18", justificativa: "Hotel" },

  // ── DESPESAS FIXAS - Locações (Grupo 3.1.19) ──
  "LOCAÇÃO": { codigo: "3.1.19", justificativa: "Locação de bens" },
  "LOCAÇÃO PALHETEIRA ELETRICA": { codigo: "3.1.19", justificativa: "Locação de paleteira elétrica" },
  "EMPILHADEIRA": { codigo: "3.1.19", justificativa: "Locação de empilhadeira" },

  // ── DESPESAS FIXAS - Cartão de Crédito (Grupo 3.1.20) ──
  "CARTÃO DE CRÉDITO": { codigo: "3.1.20", justificativa: "Despesas com cartão de crédito" },
  "Anuidade cartao credito": { codigo: "3.1.20", justificativa: "Anuidade de cartão de crédito" },

  // ── DESPESAS FIXAS - Hardware (Grupo 3.1.21) ──
  "HARDWARE": { codigo: "3.1.21", justificativa: "Hardware e acessórios" },
  "COMPUTADORES": { codigo: "3.1.21", justificativa: "Computadores" },
  "IMPRESSORAS - COMPRA": { codigo: "3.1.21", justificativa: "Compra de impressoras" },
  "IMPRESSORAS - MANUTENÇÃO": { codigo: "3.1.8.6", justificativa: "Manutenção de impressoras" },
  "EQUIPAMENTO - NÃO COMPUTADOR": { codigo: "3.1.21", justificativa: "Equipamento não computador" },
  "EQUIPAMENTOS DIVERSOS": { codigo: "3.1.21", justificativa: "Equipamentos diversos" },
  "EQUIPAMENTO DE EMPILHAR - PEQUENO": { codigo: "3.1.21", justificativa: "Equipamento pequeno de empilhar" },

  // ── DESPESAS FIXAS - Software (Grupo 3.1.22) ──
  "SOFTWARE": { codigo: "3.1.22", justificativa: "Software" },
  "SISTEMA DE TERCEIROS": { codigo: "3.1.22", justificativa: "Sistema de terceiros - software" },
  "SITES / DOMINIO": { codigo: "3.1.22", justificativa: "Sites e domínio" },
  "REGISTRO DOMINIOS": { codigo: "3.1.22", justificativa: "Registro de domínios" },
  "DESENVOLVIMENTO SITES/REDE SOCIAIS": { codigo: "3.1.22", justificativa: "Desenvolvimento de sites" },

  // ── DESPESAS FIXAS - Outras Admin (Grupo 3.1.23) ──
  "DIVERSOS": { codigo: "3.1.23", justificativa: "Despesas diversas administrativas" },
  "DIVERSOS ": { codigo: "3.1.23", justificativa: "Despesas diversas administrativas" },
  "OUTROS": { codigo: "3.1.23", justificativa: "Outros - despesas administrativas" },
  "ANUIDADE DE ENTIDADES DE CLASSE": { codigo: "3.1.23", justificativa: "Anuidade de entidades de classe" },
  "ASSINATURA REVISTA(PUBLICAÇÕES GERAIS)": { codigo: "3.1.23", justificativa: "Assinatura de revistas" },
  "FARMACIA": { codigo: "3.1.23", justificativa: "Farmácia - despesa administrativa" },
  "TAXA DE CUSTO": { codigo: "3.1.23", justificativa: "Taxa de custo diversa" },
  "event_expense - EV-2026-003": { codigo: "3.3.2", justificativa: "Despesa de evento" },

  // ── DESPESAS FIXAS - Locação Informática (Grupo 3.1.24) ──
  // (usando 3.1.24 quando aplicável)

  // ── DESPESAS PESSOAL - Salários (Grupo 3.2) ──
  "SALARIOS": { codigo: "3.2.1.1.2", justificativa: "Salários - ajuda de custo pessoal" },
  "ADIANTAMENTO DE SALARIOS": { codigo: "3.2.1.1.2", justificativa: "Adiantamento de salários" },
  "AJUDA DE CUSTO": { codigo: "3.2.1.1.2", justificativa: "Ajuda de custo para colaboradores" },
  "Horas Extras": { codigo: "3.2.1.1.2", justificativa: "Horas extras" },
  "MÃO DE OBRA": { codigo: "3.2.2.1", justificativa: "Mão de obra terceirizada" },
  "13º SALARIO": { codigo: "3.2.7", justificativa: "13º salário" },
  "Pagamento 13º": { codigo: "3.2.7", justificativa: "Pagamento de 13º salário" },
  "FÉRIAS": { codigo: "3.2.8", justificativa: "Férias" },
  "GRATIFICAÇÃO 2024 PR": { codigo: "3.2.13.2", justificativa: "Gratificação - premiação" },
  "BONIFICAÇÃO FUNCIONARIO ": { codigo: "3.2.13.2", justificativa: "Bonificação para funcionário" },
  "RESCISÃO": { codigo: "3.2.9", justificativa: "Rescisão trabalhista" },
  "CUSTO DE DEMISOES": { codigo: "3.2.9", justificativa: "Custo de demissões" },
  "GUIA RESCISORIO ": { codigo: "3.2.9", justificativa: "Guia rescisório" },
  "PENSÃO ALIMENTICIA": { codigo: "3.2.14", justificativa: "Pensão alimentícia" },
  "SINDICATO": { codigo: "3.2.14", justificativa: "Sindicato - despesa pessoal" },
  "PREVIDENCIA PRIVADA ": { codigo: "3.2.14", justificativa: "Previdência privada" },

  // ── DESPESAS PESSOAL - Terceirizados (Grupo 3.2.2) ──
  "AGENDAMENTO/TDE": { codigo: "3.2.2.1", justificativa: "Agendamento/TDE terceirizado" },

  // ── DESPESAS PESSOAL - Transporte Colaboradores (Grupo 3.2.3) ──
  "VALE TRANSPORTE": { codigo: "3.2.3.1", justificativa: "Vale transporte" },

  // ── DESPESAS PESSOAL - Empréstimos (Grupo 3.2.4) ──
  "DESPESA COM FUNCIONARIO": { codigo: "3.2.4.1", justificativa: "Despesa com funcionário - empréstimo" },

  // ── DESPESAS PESSOAL - Medicina (Grupo 3.2.5) ──
  "MEDICINA E SEGURANÇA OCUPACIONAL": { codigo: "3.2.5", justificativa: "Medicina e segurança do trabalho" },

  // ── DESPESAS PESSOAL - Ponto (Grupo 3.2.6) ──
  "REGISTRO DE PONTO": { codigo: "3.2.6", justificativa: "Sistema de registro de ponto" },

  // ── DESPESAS PESSOAL - Café (Grupo 3.2.10) ──
  "Coffe Break ": { codigo: "3.2.10", justificativa: "Coffee break funcionários" },

  // ── DESPESAS PESSOAL - Treinamento (Grupo 3.2.11) ──
  "RECRUTAMENTO SELEÇÃO/TREINAMENTO": { codigo: "3.2.11", justificativa: "Recrutamento e treinamento" },
  "ANUNCIOS PARA CONTRATAÇÃO DE FUNCIONARIOS": { codigo: "3.2.11", justificativa: "Anúncios para contratação" },
  "TREINADORES/CONSULTORIA": { codigo: "3.2.11", justificativa: "Treinadores e consultoria" },
  "PALESTRAS/TERCEIROS": { codigo: "3.2.11", justificativa: "Palestras - treinamento" },
  "TECNICO DE QUIMICA/FARMACIA": { codigo: "3.2.11", justificativa: "Técnico químico - treinamento" },

  // ── DESPESAS PESSOAL - Benefícios (Grupo 3.2.12) ──
  "BENEFICIOS/CESTAS": { codigo: "3.2.12.1", justificativa: "Cestas básicas para funcionários" },
  "PLANO DE SAUDE": { codigo: "3.2.12.2", justificativa: "Plano de saúde" },
  "VALE REFEIÇÃO/ALIMENTAÇÃO": { codigo: "3.2.12.3", justificativa: "Vale refeição/alimentação" },

  // ── DESPESAS PESSOAL - Ações Colaboradores (Grupo 3.2.13) ──
  "AÇÕES PARA FUNCIONÁRIOS": { codigo: "3.2.13.1", justificativa: "Ações para funcionários" },
  "Ação comemorativa": { codigo: "3.2.13.1", justificativa: "Ação comemorativa para colaboradores" },
  "CONFRATERNIZAÇÃO": { codigo: "3.2.13.1", justificativa: "Confraternização" },
  "PREMIOS/ GUELTAS": { codigo: "3.2.13.2", justificativa: "Prêmios e gueltas" },

  // ── DESPESAS PESSOAL - Uniformes (Grupo 3.2.14) ──
  "UNIFORMES": { codigo: "3.2.14", justificativa: "Uniformes para funcionários" },
  "UNIFORMES ": { codigo: "3.2.14", justificativa: "Uniformes para funcionários" },
  "UNIFORMES PARA FUNCIONARIOS": { codigo: "3.2.14", justificativa: "Uniformes para funcionários" },

  // ── DESPESAS PESSOAL - Consultoria RH (Grupo 3.2.14) ──
  "CONSULTORIA RH": { codigo: "3.2.14", justificativa: "Consultoria de RH" },
  "CONSULTORIA": { codigo: "3.1.8.9", justificativa: "Consultoria geral" },
  "CONSULTORIA COMERCIAL": { codigo: "3.1.8.9", justificativa: "Consultoria comercial" },
  "CONSULTORIA LOGISTICA": { codigo: "3.1.8.9", justificativa: "Consultoria logística" },

  // ── MARKETING (Grupo 3.3) ──
  "AGENCIAS": { codigo: "3.3.1", justificativa: "Agências de publicidade" },
  "AGÊNCIAS DE PUBLICIDADE E MKT": { codigo: "3.3.1", justificativa: "Agências de publicidade e marketing" },
  "CONSULTORIA MARKETING": { codigo: "3.3.6", justificativa: "Consultoria de marketing" },
  "VEICULAÇÃO DE MÍDIA OFFLINE": { codigo: "3.3.1", justificativa: "Veiculação de mídia offline" },
  "PRODUÇÃO DE EVENTOS": { codigo: "3.3.2", justificativa: "Produção de eventos" },
  "BUFFE ": { codigo: "3.3.2", justificativa: "Buffet para eventos" },
  "CENOGRAFIA": { codigo: "3.3.2", justificativa: "Cenografia para eventos" },
  "CONVITES": { codigo: "3.3.2", justificativa: "Convites para eventos" },
  "CONTRUÇÃO DE STAND": { codigo: "3.3.7", justificativa: "Construção de stand" },
  "BRINDES/PRODUTOS": { codigo: "3.3.3", justificativa: "Brindes e produtos" },
  "DISPLAY": { codigo: "3.3.5", justificativa: "Display - expositor" },
  "MATERIAIS DE VITRINE": { codigo: "3.3.5", justificativa: "Materiais de vitrine - expositor" },
  "MATERIAIS GRAFICOS/PASTAS": { codigo: "3.3.5", justificativa: "Materiais gráficos" },
  "MATERIAL GRAFICO/EQUIPAMENTOS": { codigo: "3.3.5", justificativa: "Material gráfico e equipamentos" },
  "FOTOS/IMAGENS/TRATAMENTOS": { codigo: "3.3.1", justificativa: "Fotos/imagens - publicidade" },
  "PRODUTORA AUDIOVISUAL": { codigo: "3.3.1", justificativa: "Produtora audiovisual" },
  "LAY-OUT/CRIAÇÃO": { codigo: "3.3.1", justificativa: "Layout e criação" },
  "COMUNICAÇÃO VISUAL": { codigo: "3.3.12", justificativa: "Comunicação visual" },
  "MIDIA SOCIAL": { codigo: "3.3.11", justificativa: "Mídia social" },
  "MODELOS/MANEQUINS/INFLUENCER": { codigo: "3.3.10", justificativa: "Modelos e influencers" },
  "ROYALTIES": { codigo: "3.3.8", justificativa: "Royalties" },
  "PALETERA": { codigo: "3.3.5", justificativa: "Paleteira para exposição" },

  // ── MARKETING - Regiões (Despesa comercial/trade) ──
  "SÃO PAULO: CAPITAL": { codigo: "2.6.2", justificativa: "Despesa trade SP Capital" },
  "SÃO PAULO: INTERIOR": { codigo: "2.6.2", justificativa: "Despesa trade SP Interior" },
  "CENTROESTE: MT/MS/GO/DF": { codigo: "2.6.2", justificativa: "Despesa trade Centro-Oeste" },
  "SUDESTE: RJ/MG/ES": { codigo: "2.6.2", justificativa: "Despesa trade Sudeste" },
  "SUL: RS/SC/PR": { codigo: "2.6.2", justificativa: "Despesa trade Sul" },

  // ── DESPESAS BANCÁRIAS (Grupo 3.4) ──
  "TARIFAS BANCARIAS": { codigo: "3.4.1", justificativa: "Tarifas bancárias" },
  "ENCARGOS FINANCEIROS": { codigo: "3.4.1", justificativa: "Encargos financeiros bancários" },
  "JUROS/MULTAS/CORREÇÕES": { codigo: "3.4.1", justificativa: "Juros, multas e correções" },

  // ── PRÓ-LABORE (Grupo 3.5) ──
  "PRO LABORE": { codigo: "3.5.1", justificativa: "Pró-labore dos sócios" },

  // ── ATIVIDADES NÃO OPERACIONAIS (Grupo 4.1) ──
  "PALETES": { codigo: "4.2.3", justificativa: "Paletes - equipamentos" },
  "PORTA PALETES": { codigo: "4.2.3", justificativa: "Porta-paletes - equipamentos" },
  "PRATELEIRA PARA DEPÓSITO / EQUIPAMENTO / DIVERSOS": { codigo: "4.2.3", justificativa: "Prateleiras - equipamentos" },
  "MOVEIS": { codigo: "4.2.5", justificativa: "Móveis - investimento" },

  // ── ATIVIDADES FINANCEIRAS (Grupo 4.3) ──
  "EMPRESTIMOS": { codigo: "4.3.1", justificativa: "Empréstimos bancários - amortização" },
  "Parcelamento": { codigo: "4.3.9", justificativa: "Parcelamento de impostos" },
  "DISTRIBUIÇÃO DE LUCRO": { codigo: "4.4.2", justificativa: "Distribuição de lucros aos sócios" },
  "Pagamento de Dividendos": { codigo: "4.4.2", justificativa: "Pagamento de dividendos" },
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, categorias } = await req.json();

    // Action: load-categories
    if (action === "load-categories") {
      let allRows: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: chunk, error: chunkErr } = await supabase
          .from("contas_pagar")
          .select("categoria_nome, fornecedor_nome, valor_original")
          .not("categoria_nome", "is", null)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (chunkErr) throw chunkErr;
        if (!chunk || chunk.length === 0) break;
        allRows = allRows.concat(chunk);
        if (chunk.length < pageSize) break;
        page++;
      }

      const catMap = new Map<string, { qtd: number; valores: number[]; fornecedores: Map<string, number> }>();
      for (const r of allRows) {
        const cat = r.categoria_nome;
        if (!cat) continue;
        if (!catMap.has(cat)) catMap.set(cat, { qtd: 0, valores: [], fornecedores: new Map() });
        const entry = catMap.get(cat)!;
        entry.qtd++;
        if (r.valor_original) entry.valores.push(Number(r.valor_original));
        if (r.fornecedor_nome) {
          entry.fornecedores.set(r.fornecedor_nome, (entry.fornecedores.get(r.fornecedor_nome) || 0) + 1);
        }
      }

      const result = Array.from(catMap.entries()).map(([nome, info]) => ({
        categoria_nome: nome,
        qtd_titulos: info.qtd,
        valor_medio: info.valores.length > 0 ? info.valores.reduce((a, b) => a + b, 0) / info.valores.length : 0,
        top_fornecedores: Array.from(info.fornecedores.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([f]) => f),
      }));
      result.sort((a, b) => b.qtd_titulos - a.qtd_titulos);

      return new Response(JSON.stringify({ success: true, categorias: result }), { headers });
    }

    // Action: classify — dictionary-first, AI fallback
    if (action === "classify") {
      if (!categorias || !Array.isArray(categorias) || categorias.length === 0) {
        return new Response(JSON.stringify({ error: "categorias array required" }), { status: 400, headers });
      }

      // Get chart of accounts
      const { data: contas } = await supabase
        .from("trade_chart_of_accounts")
        .select("id, code, name, account_type, categoria_dre")
        .eq("permite_lancamento", true)
        .order("code");

      if (!contas || contas.length === 0) {
        return new Response(JSON.stringify({ error: "No chart of accounts found" }), { status: 400, headers });
      }

      // Check for manual overrides in DB first
      const catNames = categorias.map((c: any) => c.categoria_nome);
      const { data: dbOverrides } = await supabase
        .from("plano_contas_mapeamento_categorias")
        .select("*")
        .in("categoria_nome", catNames)
        .eq("revisado_manualmente", true);

      const overrideMap = new Map<string, any>();
      if (dbOverrides) {
        for (const o of dbOverrides) overrideMap.set(o.categoria_nome, o);
      }

      const resolved: any[] = [];
      const needsAI: any[] = [];

      for (const cat of categorias) {
        const nome = cat.categoria_nome;

        // Priority 1: Manual override from DB
        const override = overrideMap.get(nome);
        if (override && override.plano_contas_id) {
          resolved.push({
            categoria_nome: nome,
            plano_contas_id: override.plano_contas_id,
            plano_contas_codigo: override.plano_contas_codigo,
            plano_contas_nome: override.plano_contas_nome,
            confianca: 1.0,
            justificativa: "Correção manual do usuário",
            fonte: "manual",
            qtd_titulos: cat.qtd_titulos,
            valor_medio: cat.valor_medio,
            top_fornecedores: cat.top_fornecedores,
          });
          continue;
        }

        // Priority 2: Hardcoded dictionary
        const dictEntry = DICIONARIO_CATEGORIAS[nome];
        if (dictEntry) {
          const conta = contas.find(c => c.code === dictEntry.codigo);
          if (conta) {
            resolved.push({
              categoria_nome: nome,
              plano_contas_id: conta.id,
              plano_contas_codigo: conta.code,
              plano_contas_nome: conta.name,
              confianca: 1.0,
              justificativa: dictEntry.justificativa,
              fonte: "dicionario",
              qtd_titulos: cat.qtd_titulos,
              valor_medio: cat.valor_medio,
              top_fornecedores: cat.top_fornecedores,
            });
            continue;
          } else {
            // Dictionary points to a group or non-existent account — fall through to AI
            console.warn(`DICT WARNING: "${nome}" mapped to code "${dictEntry.codigo}" but no analytic account found. Sending to AI.`);
          }
        }

        // Priority 3: Send to AI
        needsAI.push(cat);
      }

      // If there are categories that need AI classification
      let aiMapeamentos: any[] = [];
      if (needsAI.length > 0) {
        const planoText = contas.map(c => `${c.code} - ${c.name} (${c.categoria_dre || c.account_type})`).join("\n");

        // Process in batches of 10 for better AI precision
        const AI_BATCH_SIZE = 10;
        for (let batchStart = 0; batchStart < needsAI.length; batchStart += AI_BATCH_SIZE) {
          const batch = needsAI.slice(batchStart, batchStart + AI_BATCH_SIZE);
          const categoriasText = batch.map((c: any) =>
            `- "${c.categoria_nome}" (${c.qtd_titulos} títulos, valor médio R$${c.valor_medio?.toFixed(2) || '0'}, fornecedores: ${(c.top_fornecedores || []).join(', ') || 'N/A'})`
          ).join("\n");

          const systemPrompt = `Você é um contador profissional especializado em classificação contábil (plano de contas DRE).
Seu trabalho é mapear categorias vindas de um ERP para o plano de contas correto.

PLANO DE CONTAS DISPONÍVEL (SOMENTE contas analíticas que permitem lançamento):
${planoText}

REGRAS:
1. Cada categoria deve ser mapeada para EXATAMENTE uma conta analítica listada acima
2. Considere o nome da categoria, os fornecedores típicos e os valores médios
3. Se a categoria é de RECEITA, use contas do grupo 1.x
4. Se é CUSTO de mercadoria/frete/imposto sobre venda, use grupo 2.x
5. Se é DESPESA fixa (admin/pessoal/marketing), use grupo 3.x
6. Se é atividade financeira/investimento/sócios, use grupo 4.x
7. Retorne um score de confiança de 0 a 1
8. IMPORTANTE: Use os códigos EXATAMENTE como listados no plano. NÃO invente códigos.
9. Se não conseguir classificar com confiança, use confiança 0.3 ou menor`;

          const userPrompt = `Classifique estas ${batch.length} categorias do ERP para o plano de contas:\n\n${categoriasText}\n\nResponda usando a ferramenta fornecida.`;

          try {
            const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-pro",
                max_tokens: 8192,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
                tools: [{
                  type: "function",
                  function: {
                    name: "classificar_categorias",
                    description: "Mapeia categorias do ERP para o plano de contas",
                    parameters: {
                      type: "object",
                      properties: {
                        mapeamentos: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              categoria_nome: { type: "string" },
                              plano_contas_codigo: { type: "string" },
                              plano_contas_nome: { type: "string" },
                              confianca: { type: "number" },
                              justificativa: { type: "string" },
                            },
                            required: ["categoria_nome", "plano_contas_codigo", "plano_contas_nome", "confianca", "justificativa"],
                          },
                        },
                      },
                      required: ["mapeamentos"],
                    },
                  },
                }],
                tool_choice: { type: "function", function: { name: "classificar_categorias" } },
              }),
            });

            if (!response.ok) {
              const errText = await response.text();
              console.error("AI gateway error:", response.status, errText);
              if (response.status === 429) {
                return new Response(JSON.stringify({ error: "Rate limit exceeded. Aguarde e tente novamente." }), { status: 429, headers });
              }
              if (response.status === 402) {
                return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), { status: 402, headers });
              }
              // Mark batch as failed
              for (const cat of batch) {
                resolved.push({
                  ...cat,
                  plano_contas_id: null,
                  plano_contas_codigo: "",
                  plano_contas_nome: "Erro na classificação IA",
                  confianca: 0,
                  justificativa: `Erro ao chamar IA: ${response.status}`,
                  fonte: "erro",
                });
              }
              continue;
            }

            const aiData = await response.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) {
              const parsed = JSON.parse(toolCall.function.arguments);
              for (const m of (parsed.mapeamentos || [])) {
                const conta = contas.find(c => c.code === m.plano_contas_codigo);
                const cat = batch.find(c => c.categoria_nome === m.categoria_nome);
                
                if (!conta) {
                  // AI returned invalid code — mark as error instead of accepting silently
                  console.warn(`AI VALIDATION: Code "${m.plano_contas_codigo}" for "${m.categoria_nome}" not found in analytic accounts`);
                  resolved.push({
                    categoria_nome: m.categoria_nome,
                    plano_contas_id: null,
                    plano_contas_codigo: m.plano_contas_codigo,
                    plano_contas_nome: `⚠ Código inválido: ${m.plano_contas_codigo}`,
                    confianca: 0,
                    justificativa: `IA retornou código inexistente: ${m.plano_contas_codigo}`,
                    fonte: "erro",
                    qtd_titulos: cat?.qtd_titulos || 0,
                    valor_medio: cat?.valor_medio || 0,
                    top_fornecedores: cat?.top_fornecedores || [],
                  });
                } else {
                  resolved.push({
                    ...m,
                    plano_contas_id: conta.id,
                    plano_contas_nome: conta.name,
                    fonte: "ia",
                    qtd_titulos: cat?.qtd_titulos || 0,
                    valor_medio: cat?.valor_medio || 0,
                    top_fornecedores: cat?.top_fornecedores || [],
                  });
                }
              }
              // Check for categories that AI didn't return
              for (const cat of batch) {
                const found = (parsed.mapeamentos || []).some((m: any) => m.categoria_nome === cat.categoria_nome);
                if (!found) {
                  resolved.push({
                    categoria_nome: cat.categoria_nome,
                    plano_contas_id: null,
                    plano_contas_codigo: "",
                    plano_contas_nome: "IA não retornou classificação",
                    confianca: 0,
                    justificativa: "Categoria não classificada pela IA",
                    fonte: "erro",
                    qtd_titulos: cat.qtd_titulos,
                    valor_medio: cat.valor_medio,
                    top_fornecedores: cat.top_fornecedores,
                  });
                }
              }
            } else {
              // No tool call in response
              for (const cat of batch) {
                resolved.push({
                  ...cat,
                  plano_contas_id: null,
                  plano_contas_codigo: "",
                  plano_contas_nome: "Resposta IA inválida",
                  confianca: 0,
                  justificativa: "IA não retornou tool_call",
                  fonte: "erro",
                });
              }
            }
          } catch (batchErr) {
            console.error("AI batch error:", batchErr);
            for (const cat of batch) {
              resolved.push({
                ...cat,
                plano_contas_id: null,
                plano_contas_codigo: "",
                plano_contas_nome: "Erro interno IA",
                confianca: 0,
                justificativa: `Erro: ${batchErr instanceof Error ? batchErr.message : 'unknown'}`,
                fonte: "erro",
              });
            }
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        mapeamentos: resolved,
        stats: {
          total: categorias.length,
          dicionario: resolved.filter(r => r.fonte === "dicionario").length,
          manual: resolved.filter(r => r.fonte === "manual").length,
          ia: resolved.filter(r => r.fonte === "ia").length,
          erro: resolved.filter(r => r.fonte === "erro").length,
        },
      }), { headers });
    }

    // Action: save
    if (action === "save") {
      if (!categorias || !Array.isArray(categorias)) {
        return new Response(JSON.stringify({ error: "categorias array required" }), { status: 400, headers });
      }

      for (const m of categorias) {
        if (!m.plano_contas_id) continue;
        const { error } = await supabase
          .from("plano_contas_mapeamento_categorias")
          .upsert({
            categoria_nome: m.categoria_nome,
            plano_contas_id: m.plano_contas_id,
            plano_contas_codigo: m.plano_contas_codigo,
            plano_contas_nome: m.plano_contas_nome,
            confianca: m.confianca,
            justificativa: m.justificativa,
            revisado_manualmente: m.revisado_manualmente || false,
            qtd_titulos: m.qtd_titulos || 0,
            valor_medio: m.valor_medio || 0,
            top_fornecedores: m.top_fornecedores || [],
          }, { onConflict: "categoria_nome" });

        if (error) console.error("Upsert error:", error);
      }

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Action: apply
    if (action === "apply") {
      const { data, error } = await supabase.rpc("aplicar_mapeamento_plano_contas");
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers });
  }
});
