-- =========================================================
-- 1) SLA por fila (padrão de mercado helpdesk interno)
-- =========================================================
UPDATE public.suporte_filas SET sla_primeira_resposta_horas = 2,  sla_resolucao_horas = 24 WHERE slug = 'ti';
UPDATE public.suporte_filas SET sla_primeira_resposta_horas = 4,  sla_resolucao_horas = 48 WHERE slug = 'fiscal';
UPDATE public.suporte_filas SET sla_primeira_resposta_horas = 1,  sla_resolucao_horas = 8  WHERE slug = 'transporte';
UPDATE public.suporte_filas SET sla_primeira_resposta_horas = 2,  sla_resolucao_horas = 24 WHERE slug = 'logistica';
UPDATE public.suporte_filas SET sla_primeira_resposta_horas = 8,  sla_resolucao_horas = 72 WHERE slug = 'compras';
UPDATE public.suporte_filas SET sla_primeira_resposta_horas = 4,  sla_resolucao_horas = 48 WHERE slug = 'rh';
UPDATE public.suporte_filas SET sla_primeira_resposta_horas = 8,  sla_resolucao_horas = 72 WHERE slug = 'adm-cso';
UPDATE public.suporte_filas SET sla_primeira_resposta_horas = 8,  sla_resolucao_horas = 72 WHERE slug = 'administrativo-cso';

-- =========================================================
-- 2) Prompts de IA "TI-grade" — sobrescreve os 6 não-TI/Fiscal
-- =========================================================
UPDATE public.suporte_filas SET ia_prompt =
$$Você atende o departamento de Transporte.
ESCOPO: coletas, entregas, motoristas, rotas, avarias em trânsito, extravios, atrasos, roteirização e ocorrências reportadas por transportadora.
SEMPRE PERGUNTAR (na 1ª resposta que fizer sentido): nº do pedido/nota, transportadora, data prevista, cidade destino e descrição objetiva da ocorrência.
NUNCA: pedir senha, token, CPF completo, dados bancários; nunca prometer reagendamento, indenização, prazo novo ou reversão de rota sem confirmação humana.
TRANSFERIR SE: mercadoria ainda no CD ou divergência de separação → 'logistica'. Divergência em NF, imposto ou destinatário → 'fiscal'. Sistema/TMS fora do ar → 'ti'. Cobrança de frete → 'compras'.
CATEGORIA sugerida: dados_inconsistentes (extravio/avaria), performance (atraso), bug (rastreio quebrado), outro (demais).$$
 WHERE slug = 'transporte';

UPDATE public.suporte_filas SET ia_prompt =
$$Você atende o departamento de Logística.
ESCOPO: recebimento, endereçamento, armazenagem, separação, conferência, expedição, inventário, movimentação interna e integridade de estoque no CD/loja.
SEMPRE PERGUNTAR: SKU/EAN, lote (quando aplicável), quantidade, local (CD/loja), nº do pedido ou nota, e quando o problema foi identificado.
NUNCA: pedir senha, token, CPF completo; nunca autorizar ajuste de estoque, reversão de saída ou baixa de nota — apenas encaminhar para conferência humana.
TRANSFERIR SE: entrega ao cliente/transportadora → 'transporte'. Nota fiscal/impostos → 'fiscal'. Divergência de OC/fornecedor → 'compras'. Sistema/WMS fora do ar → 'ti'.
CATEGORIA sugerida: dados_inconsistentes (divergência de estoque), bug (WMS), performance (fila de separação), outro.$$
 WHERE slug = 'logistica';

UPDATE public.suporte_filas SET ia_prompt =
$$Você atende a Central ADM CSO.
ESCOPO: rotinas administrativas do CSO, protocolos, contratos, agenda de diretoria, apoio a reuniões, tramitação de documentos internos.
SEMPRE PERGUNTAR: assunto, documento ou processo relacionado, prazo desejado e o que precisa ser feito.
NUNCA: pedir senha, token, CPF completo, dados bancários; nunca confirmar assinatura ou aprovação em nome da diretoria.
TRANSFERIR SE: envolve título, boleto ou pagamento → 'financeiro' (via fila financeira quando disponível) ou 'compras' se for a fornecedor. Assunto de folha/benefícios → 'rh'. Sistema/acesso → 'ti'. Nota fiscal → 'fiscal'.
CATEGORIA sugerida: solicitacao_acesso, solicitacao_funcionalidade, outro.$$
 WHERE slug = 'adm-cso';

UPDATE public.suporte_filas SET ia_prompt =
$$Você atende o departamento de Compras.
ESCOPO: cotações, ordens de compra (OC), homologação de fornecedor, prazos de entrega ao CD, condições comerciais e status de pedidos com fornecedor.
SEMPRE PERGUNTAR: fornecedor, nº da OC (se houver), item/SKU, quantidade, prazo original combinado e urgência.
NUNCA: pedir senha, token, CPF completo, dados bancários; nunca fechar preço, aprovar OC, alterar condição comercial ou aceitar antecipação sem confirmação humana.
TRANSFERIR SE: mercadoria já recebida no CD → 'logistica'. Divergência de NF ou tributação → 'fiscal'. Entrega em curso pela transportadora → 'transporte'. Cadastro/acesso ao portal de compras → 'ti'.
CATEGORIA sugerida: solicitacao_funcionalidade, dados_inconsistentes (preço/qtde), performance (atraso do fornecedor), outro.$$
 WHERE slug = 'compras';

UPDATE public.suporte_filas SET ia_prompt =
$$Você atende Recursos Humanos.
ESCOPO: folha, benefícios, férias, admissão, desligamento, ponto/frequência, atestados, documentos pessoais e políticas internas.
SEMPRE PERGUNTAR: assunto e período/data de referência. Peça apenas nome ou matrícula — nunca CPF completo, senha, token, dados bancários ou documentos sensíveis pelo chat. Oriente que o RH tratará esses itens por canal oficial.
NUNCA: confirmar valor de folha, liberar benefício, autorizar férias ou desligamento; nunca discutir salário de terceiros.
TRANSFERIR SE: acesso a sistema, e-mail ou crachá eletrônico → 'ti'. Reembolso/adiantamento com título financeiro → fila financeira quando disponível. Compra de equipamento/uniforme → 'compras'.
CATEGORIA sugerida: solicitacao_acesso, duvida_uso, outro.$$
 WHERE slug = 'rh';

UPDATE public.suporte_filas SET ia_prompt =
$$Você atende o Administrativo CSO.
ESCOPO: apoio administrativo geral do CSO, correspondências, protocolos internos, agenda de reuniões, infraestrutura de escritório, materiais de expediente.
SEMPRE PERGUNTAR: assunto, urgência, local (se aplicável) e o que precisa ser feito.
NUNCA: pedir senha, token, CPF completo, dados bancários; nunca autorizar compra, contrato ou pagamento em nome da diretoria.
TRANSFERIR SE: assunto técnico/sistema → 'ti'. Nota fiscal/impostos → 'fiscal'. Aquisição de material/equipamento → 'compras'. Folha/benefícios → 'rh'. Envio/coleta física de documentos externos → 'transporte' ou 'logistica'.
CATEGORIA sugerida: solicitacao_funcionalidade, solicitacao_acesso, outro.$$
 WHERE slug = 'administrativo-cso';

-- =========================================================
-- 3) Base de conhecimento inicial (3 artigos por fila = 24)
--    Idempotente via WHERE NOT EXISTS (modulo, titulo)
-- =========================================================
INSERT INTO public.suporte_kb (modulo, titulo, conteudo, palavras_chave, ativo)
SELECT * FROM (VALUES
  -- TI
  ('ti', 'Como solicitar acesso a um novo sistema',
   'Envie um chamado informando: (1) sistema desejado, (2) motivo/uso, (3) gestor imediato para aprovação. O TI valida a matrícula, cria o acesso e responde com as instruções de primeiro login. Não compartilhe senhas por chat.',
   ARRAY['acesso','login','permissao','usuario'], true),
  ('ti', 'Resetar senha do sistema',
   'Abra chamado no Suporte TI informando o e-mail corporativo. Enviaremos link de redefinição válido por 30 minutos. Nunca envie senha nem código de verificação pelo chat.',
   ARRAY['senha','reset','password'], true),
  ('ti', 'Sistema fora do ar / lento',
   'Informe: URL/tela afetada, horário do início, se ocorre com outros colegas e print do erro se houver. Enquanto o TI investiga, tente atualizar a página (Ctrl+F5) e sair e entrar novamente.',
   ARRAY['fora do ar','lento','erro','indisponivel'], true),

  -- Fiscal
  ('fiscal', 'Divergência entre NF e pedido',
   'Envie: nº da nota, nº do pedido, CNPJ do emitente/destinatário e o campo divergente (valor, item, quantidade, imposto). O Fiscal confere no XML e retorna com o encaminhamento (correção, carta de correção ou devolução).',
   ARRAY['nf','nota fiscal','divergencia','pedido'], true),
  ('fiscal', 'Correção de NFe emitida',
   'Correção pode ser via Carta de Correção Eletrônica (CC-e) para campos permitidos (dados do transportador, natureza da operação sem alterar valor/produto/impostos) em até 720h da emissão. Para alterações de valor/produto é necessário cancelamento e nova emissão.',
   ARRAY['cce','carta de correcao','nfe','cancelamento'], true),
  ('fiscal', 'Recebi NF de fornecedor com erro',
   'Não recepcione a NF no sistema. Comunique o fornecedor por escrito, solicite correção (CC-e) ou nova emissão e nos avise para orientar sobre bloqueio de pagamento até regularização.',
   ARRAY['nf entrada','fornecedor','erro','recepcao'], true),

  -- Transporte
  ('transporte', 'Coleta não realizada no dia',
   'Informe transportadora, nº do pedido/nota, cidade de origem e destino, janela combinada. Confirmamos com a transportadora e retornamos com nova janela ou justificativa em até 4h úteis.',
   ARRAY['coleta','nao coletou','transportadora'], true),
  ('transporte', 'Avaria em entrega',
   'Solicite ao cliente foto da embalagem, foto do produto e canhoto com ressalva. Envie tudo junto com nº da NF. Abrimos ocorrência com a transportadora e retornamos com prazo de análise (padrão 5 dias úteis).',
   ARRAY['avaria','quebrado','danificado'], true),
  ('transporte', 'Rastreio não atualiza',
   'Aguardar 24h após emissão da NF é normal. Após esse prazo, informe nº da NF e transportadora que apuramos com a base logística e retornamos com o status real.',
   ARRAY['rastreio','tracking','codigo'], true),

  -- Logística
  ('logistica', 'Divergência de estoque',
   'Informe SKU/EAN, lote, quantidade esperada, quantidade real, endereço no CD e quando foi identificado. Realizamos contagem cíclica no endereço e retornamos com o ajuste ou justificativa em até 24h.',
   ARRAY['estoque','inventario','divergencia','sku'], true),
  ('logistica', 'Pedido separado com item errado',
   'Envie nº do pedido, item correto (SKU), item enviado, e se possível foto do romaneio. Investigamos separação, revisamos o processo e emitimos correção de expedição.',
   ARRAY['separacao','picking','item errado'], true),
  ('logistica', 'Recebimento pendente há mais de 48h',
   'Informe nº da NF, fornecedor e data de chegada. Verificamos fila de recebimento e priorizamos, retornando com previsão de conferência.',
   ARRAY['recebimento','entrada','fornecedor'], true),

  -- Compras
  ('compras', 'Solicitar nova OC / cotação',
   'Envie: item(ns), quantidade, prazo desejado, fornecedor sugerido (se houver) e centro de custo. Retorno com cotação em até 48h úteis. OCs acima do limite do gestor exigem aprovação da diretoria.',
   ARRAY['oc','ordem de compra','cotacao'], true),
  ('compras', 'Fornecedor atrasou entrega',
   'Informe nº da OC, fornecedor e prazo original. Contactamos o fornecedor, formalizamos a cobrança e retornamos com novo prazo ou plano B.',
   ARRAY['atraso','fornecedor','entrega'], true),
  ('compras', 'Homologação de novo fornecedor',
   'Solicite envio de: cartão CNPJ, contrato social, referências comerciais e certidões negativas. Após análise (média 5 dias úteis) o fornecedor é cadastrado e liberado para OC.',
   ARRAY['homologacao','novo fornecedor','cadastro'], true),

  -- RH
  ('rh', 'Solicitação de férias',
   'Envie: período pretendido, se deseja abono de 10 dias e aprovação do gestor. O RH valida saldo, política e retorna com programação oficial. Prazo mínimo de aviso: 30 dias.',
   ARRAY['ferias','abono','descanso'], true),
  ('rh', 'Correção de ponto',
   'Informe: data, horário correto (entrada/saída/intervalo) e justificativa. Se possível anexe evidência (e-mail, agenda). O RH ajusta após aprovação do gestor.',
   ARRAY['ponto','frequencia','correcao'], true),
  ('rh', 'Consulta sobre folha / holerite',
   'Não discutimos valores por chat. Confirme a matrícula e retornaremos por canal seguro. Dúvidas sobre eventos (INSS, IRRF, benefícios) são detalhadas no próprio holerite disponível no portal.',
   ARRAY['folha','holerite','salario','pagamento'], true),

  -- Central ADM CSO
  ('adm-cso', 'Solicitar assinatura de contrato',
   'Envie o contrato em PDF, resumo do objeto, parte contratante, valor e prazo. Encaminhamos para conferência jurídica e para assinatura da diretoria com prazo médio de 3 dias úteis.',
   ARRAY['contrato','assinatura','juridico'], true),
  ('adm-cso', 'Agendar reunião com diretoria',
   'Envie: assunto, participantes, duração estimada e se é presencial ou remoto. A Central ADM valida na agenda e confirma horário em até 24h úteis.',
   ARRAY['reuniao','agenda','diretoria'], true),
  ('adm-cso', 'Tramitação de documento interno',
   'Informe o documento, para onde deve ser encaminhado e prazo. Registramos protocolo interno e acompanhamos até a devolução ao solicitante.',
   ARRAY['protocolo','documento','tramitacao'], true),

  -- Administrativo CSO
  ('administrativo-cso', 'Solicitação de material de expediente',
   'Envie: item, quantidade, urgência e local de entrega no escritório. Compras rotineiras são atendidas em até 5 dias úteis. Itens fora do padrão passam por aprovação.',
   ARRAY['material','expediente','escritorio'], true),
  ('administrativo-cso', 'Manutenção predial / infraestrutura',
   'Descreva o problema (elétrica, hidráulica, ar-condicionado, mobiliário), local exato e nível de urgência. Emergência atende no mesmo dia; demais em até 72h úteis.',
   ARRAY['manutencao','predial','infraestrutura'], true),
  ('administrativo-cso', 'Envio de correspondência / motoboy',
   'Informe destinatário, endereço, urgência e conteúdo geral (documento, amostra, etc.). Coletas internas são recolhidas até 15h; envios expressos são cotados sob demanda.',
   ARRAY['motoboy','correspondencia','envio'], true)
) AS v(modulo, titulo, conteudo, palavras_chave, ativo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.suporte_kb kb WHERE kb.modulo = v.modulo AND kb.titulo = v.titulo
);

-- =========================================================
-- 4) Respostas rápidas por fila (5 por fila = 40)
--    escopo='fila' + fila_id — idempotente por (fila_id, atalho)
-- =========================================================
INSERT INTO public.suporte_respostas_rapidas (escopo, fila_id, atalho, titulo, conteudo, ordem, ativo)
SELECT 'fila' AS escopo, f.id AS fila_id, v.atalho, v.titulo, v.conteudo, v.ordem, true
FROM public.suporte_filas f
CROSS JOIN LATERAL (VALUES
  ('/recebido',   'Confirmação de recebimento',
   'Recebemos seu chamado e já estamos analisando. Retornaremos com uma posição em breve.', 1),
  ('/info',       'Pedido de mais informações',
   'Para dar sequência, preciso confirmar: [descrever dados exatos — nº do pedido, SKU, período, print, etc.]. Assim que enviar, seguimos com a análise.', 2),
  ('/humano',     'Encaminhamento para líder',
   'Estou encaminhando este chamado para o líder da equipe, que retorna em seguida por aqui mesmo.', 3),
  ('/aguardando', 'Aguardando terceiro',
   'Estamos aguardando retorno de [fornecedor/transportadora/órgão/área]. Assim que tivermos posição, retornamos por aqui.', 4),
  ('/resolvido',  'Confirmação de resolução',
   'Este chamado está resolvido. Se algo permanecer pendente, é só responder aqui que reabrimos.', 5)
) AS v(atalho, titulo, conteudo, ordem)
WHERE f.slug IN ('ti','fiscal','transporte','logistica','compras','rh','adm-cso','administrativo-cso')
  AND NOT EXISTS (
    SELECT 1 FROM public.suporte_respostas_rapidas rr
     WHERE rr.escopo = 'fila' AND rr.fila_id = f.id AND rr.atalho = v.atalho
  );