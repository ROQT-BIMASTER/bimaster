# Camada Fiscal do Huugs — NF-e de entrada, Reforma Tributária (IBS/CBS) e compartilhamento com o contador

> **O que é este documento.** O desenho do **"lado documento/fiscal" do título** do Contas a Pagar do Huugs. Não é um projeto paralelo à fábrica nem uma reengenharia do A Pagar: é a peça que faltava para o **nascimento do título** (§10/§11 do planejamento) receber, guardar e carregar o **XML da NF-e de entrada** e as **especificações tributárias da Reforma (IBS/CBS)** desde o nascimento, num caminho seguro, sem retrabalho, e preparado para o **round-trip com o Result** e para o **compartilhamento com o contador** (obrigações acessórias).
>
> Escopo herdado: Huggs espelha o Result (read-only) e está virando **sistema de origem** de despesas (título nasce no Huggs → futuramente enviado ao Result via API). Este documento fica **dentro** do escopo Orçamento Corporativo + Torre de Despesas + P2P.
>
> Data: 2026-07-05. Referências legais/mercado com fonte ao final.

---

## 1. Visão

O Huggs está deixando de ser um espelho passivo do Result para virar **sistema de origem** de despesas: o título de Contas a Pagar **nasce aqui** e, no futuro, é empurrado ao Result via API. No momento em que o título passa a nascer no Huggs, ele deixa de ser "só um valor a pagar" e passa a ser a **contrapartida financeira de um documento fiscal** — a NF-e de entrada. E é exatamente nesse documento, não no financeiro, que vivem as informações que a **Reforma Tributária** (EC 132/2023 + LC 214/2025) torna críticas: o breakdown de **IBS/CBS** por item, o **CST/cClassTrib**, a base de cálculo, e o **crédito recuperável** na entrada. Um título sem o XML vinculado é um título **sem lastro fiscal** e, na lógica da não-cumulatividade nova, **sem direito a crédito** (LC 214/2025, arts. 47/108/109). A camada fiscal precisa nascer junto com o título — não ser "colada depois".

Há três forças convergindo agora e por isso o momento: (a) **Huggs virando origem** — se o título nasce aqui, o XML tem que entrar aqui, senão o dado fiscal nunca existirá no Huggs (hoje ele consome só `ContasPagar` do Result, que é puro financeiro); (b) **Reforma Tributária em rampa** — 2026 é ano-teste (destaque de IBS 0,1% / CBS 0,9% sem recolher), mas o **preenchimento dos campos IBS/CBS na NF-e vira obrigatório em 03/08/2026 para CRT-3** e em 04/01/2027 para o Simples, ou seja, o XML que chega ao Huggs **já vai trazer** esses campos dentro de semanas; (c) **o contador** precisa receber XML íntegro + memória de apuração para transmitir as obrigações acessórias (Ato Conjunto RFB/CGIBS nº 1/2025). O desenho abaixo faz o XML e os impostos **andarem com o título desde o nascimento**, reaproveitando 100% do parser de NF-e que já existe no repo (hoje aterrissando só na fábrica) e **espelhando o schema fiscal maduro do Result** — que já tem os campos de IBS/CBS prontos — para não retrabalhar quando a reforma virar arrecadação.

---

## 2. O que o Result já tem × o que o Huggs NÃO tem

### 2.1 Result (achado ao vivo, via conector read-only) — camada fiscal MADURA, Reforma JÁ no schema

- **`dbo.NotasEntrada`** (~140k linhas, nível **item/linha** — as linhas "LEnt" da NF-e de entrada) é onde mora o fiscal. Tem o breakdown **completo de IBS/CBS já modelado**: `AliqIBSUF_LEnt`, `AliqIBSMun_LEnt`, `BaseIBSUF/Mun`, `ValorIBSUF/Mun`, `RedIBSUF/Mun`, `AliqCBS/BaseCBS/ValorCBS/RedCBS`. **Os campos existem; hoje com 0 dados** (reforma em teste 2026). Tabelas `mov*` também têm `ValorIBS_Mov`/`ValorCBS_Mov`.
- **XML** guardado em `ControleNfe` / `ControleNfeEntrada`.
- **ICMS por UF** em `impostoMg/PR/RJ/REDSp`; **`ClassTributaria`**, **`CabCreditoFiscal`**, **`InventarioSpedH20`** (SPED).
- **PK do título no Result:** `Empresa`(int) + `Tipo`(nvarchar 1 char, 1–9) + `Numero`(bigint = nº do documento fiscal) + `Seq`(int = parcela) + `Fornecedor`(bigint FK `dbo.Fornecedor`, com `CNPJ_For` nvarchar(18)).
- **Ponto-chave:** no Result o fiscal/tributário vive na **NF-e de entrada** (nível item), **NÃO** na `ContasPagar` (financeiro). O `Numero` do título **é** o nº do documento fiscal — é a ponte natural documento↔título.

### 2.2 Huggs — só o financeiro, zero fiscal de documento

- O Huggs consome **apenas** `ContasPagar` do Result. No P2P **não há NF-e, XML, nem imposto por item.**
- `contas_pagar` **já tem** os ganchos fiscais mínimos (migration `20260321192514_...d356c4b2...sql`, linhas 14-17): `chave_nfe VARCHAR(44)` (com índice parcial `idx_contas_pagar_chave_nfe`, linha 62), `numero_documento_fiscal VARCHAR(20)`, `codigo_tipo_documento VARCHAR(5)`, `numero_pedido VARCHAR(15)`. Espelho idêntico em `contas_receber` (`20260321193411_...sql`).
- `contas_pagar` tem também **impostos retidos** (linhas 24-35): `valor_pis/cofins/csll/ir/iss/inss` + `retem_*`. **Atenção conceitual:** isso é a visão de **retenção/withholding** (financeira, "quanto sai do pagamento pro Fisco"), **NÃO** é o breakdown fiscal do documento (base/alíquota/valor por item). Não confundir os dois — o crédito de IBS/CBS não é retenção.
- **NÃO existe no Huggs, fora da fábrica:** nível item/imposto (NCM, CFOP, CST, ICMS/ICMS-ST/IPI/PIS/COFINS por linha), **IBS/CBS**, vínculo XML↔título, guarda do XML ligada ao CP, manifestação do destinatário, export para contador, SPED.

### 2.3 O paradoxo do repo (já existe, mas no lugar errado)

Existe no Huggs uma **stack fiscal completa e madura — inclusive IBS/CBS da Reforma — mas presa ao módulo `fabrica_*`** (RLS amarrado ao módulo `fabrica`, serve só matéria-prima/produção) e **desconectada do `contas_pagar`**:

- `supabase/functions/process-nfe-xml/index.ts` — **parser de XML de NF-e**, breakdown completo por item de ICMS/ICMS-ST/IPI/PIS/COFINS (linhas 202-273), regras de crédito inline, custo de entrada, dedup por `chave_acesso`. **É a peça reaproveitável.** Hoje grava em `fabrica_notas_fiscais` (com `xml_raw`) e `fabrica_itens_nf`. **Limitações:** só aceita `{ xml }` (não `{ chave_acesso }`, não baixa da SEFAZ); **não extrai IBS/CBS do XML** (na fábrica o IBS/CBS vem de trigger de cálculo, não do parse).
- Modelagem IBS/CBS da Reforma já resolvida na fábrica: `fabrica_tax_rates_iva`, colunas `base_cbs/base_ibs/aliquota_cbs/aliquota_ibs/valor_cbs/valor_ibs/elegivel_credito_iva` em `fabrica_itens_nf`, trigger `calcular_iva_item_nf()`, feature flag `fabrica_empresa_config.iva_dual_habilitado`, e a `fiscal-iva-api` (apuração IVA dual). **Padrão de Reforma pronto para espelhar no P2P.**
- Infra de anexos genérica **pronta para guardar o XML** vinculado a qualquer registro: `anexos-api` (padrão Omie `/incluir` com base64+MD5) + tabela `documento_anexos` + bucket privado `documento-anexos`, RLS por empresa. Bastaria `cTabela='contas_pagar'`, `nId=<id do título>`, `cTipoArquivo='text/xml'`.
- No P2P já há UI de captura: `ChaveAcessoInput.tsx` faz parse client-side via `src/lib/fabrica/nfe-xml-parser.ts` e pré-preenche o formulário de `CadastroTituloAP.tsx`.

**Dois defeitos de wiring confirmados no `CadastroTituloAP.tsx` (o "de carona" quase-pronto que está quebrado):**
1. **A chave nunca grava.** `nfeChave` é digitada e validada (`/^\d{44}$/`, linha 166), mas o `body` do save (linhas 183-199) **nunca seta `body.chave_nfe = nfeChave`**. A chave se perde no submit.
2. **O parse pós-save chama a função errada.** No `onSuccess` (linha 226) chama `callApi("process-nfe-xml", { chave_acesso: nfeChave })` — mas `process-nfe-xml` **só aceita `{ xml }`**, não `{ chave_acesso }`. Falha silenciosa (`.catch(() => {})`). Não há backend que baixe XML pela chave.

---

## 3. O que a lei / o mercado exige (resumo com fonte)

**Reforma (EC 132/2023 + LC 214/2025) — IVA dual.** CBS (federal) substitui PIS+COFINS+IPI; IBS (estadual+municipal, gerido pelo CG-IBS) substitui ICMS+ISS; IS ("imposto do pecado"). **Cronograma:** 2026 = ano-teste (IBS 0,1% + CBS 0,9%, **sem recolhimento**, art. 348 LC 214 — só destaque no documento); 2027 = CBS cheia + IS; 2029–2032 = transição do IBS (ICMS/ISS decrescem); 2033 = modelo pleno, ICMS/ISS extintos. [Planalto LC 214; Jettax; TOTVS]

**Crédito na entrada (o ponto que toca o A Pagar).** LC 214/2025 arts. 47/108/109: crédito de IBS/CBS na entrada exige, **cumulativamente**, (a) **documento fiscal eletrônico idôneo** — sem o XML, sem crédito; (b) **extinção do débito** da etapa anterior (fornecedor recolheu — daí o split payment); (c) **segregação por tributo** (IBS e CBS creditados em separado, **vedada compensação cruzada**). Consequência: o título carrega **crédito recuperável** de IBS/CBS, cuja existência depende de guardar o XML e da liquidação. [Conjur 18/05/2026; Maran Gehlen]

**Split payment (a partir de 2027).** Na liquidação, IBS/CBS destacado é **segregado automaticamente** e recolhido ao Fisco; fornecedor recebe só o líquido. Prioridade inicial Pix/boleto. **Impacto no P2P:** o pagamento passa a conversar com o fiscal — o Huggs precisa do **XML vinculado ao título** para reconciliar líquido × bruto. [Ato Conjunto RFB/CGIBS nº 02 de 27/05/2026; Fazenda/MF jun 2026]

**NF-e novo layout — NT 2025.002-RTC** (RFB + CG-IBS + ENCAT). Grupos novos **por item** que o parser precisa ler: **Grupo UB** (IBS/CBS/IS por item) com subgrupos **IS** (`CST`, `cClassTrib`, `vBC`, `pIS`, `vIS`), **IBSUF** (`pIBSUF`, `vIBSUF`, +red/dif/dev), **IBSMun** (`pIBSMun`, `vIBSMun`), **CBS** (`pCBS`, `vCBS`); **Grupo W03** (totais IBS/CBS/IS — **"por fora"**, somam ao total da NF-e, atenção ao reconciliar). Dois códigos governam tudo: **`CST`** (situação tributária) e **`cClassTrib`** (código novo, cada `CST`+`cClassTrib` amarra a um artigo da LC 214 → diz se é regime novo, isento, diferido, monofásico, crédito presumido…). **Timeline técnica:** CRT-3 (regime normal) obrigatório em produção **03/08/2026**; CRT-1/2/4 (Simples/MEI) em **04/01/2027**. **DANFE ainda não mostra IBS/CBS → o dado vive só no XML** (reforça guardar o XML, não o PDF). [Tecnospeed NT 2025.002; FENACON; CG-IBS 03/08]

**Guarda do XML.** Mínimo **5 anos + ano corrente** (art. 173/150 CTN). **É o XML** (documento com valor legal), **não o DANFE/PDF**, e com integridade (assinatura verificável). [GestãoClick; Qive]

**Manifestação do Destinatário (MD-e) — NT 2020.001.** 4 eventos: Ciência da Operação (não conclusivo) + 3 conclusivos (Confirmação, Operação não Realizada, Desconhecimento). Serve para (a) habilitar download do XML completo, (b) declarar oficialmente que a operação existiu, (c) barrar uso indevido do CNPJ. Prazos ~20 dias (interna) / ~35 (interestadual). **Na Reforma, a confirmação/idoneidade é base do crédito** → a manifestação vira parte do nascimento válido do título. [Focus NFe; NT 2020.001]

**Obrigações acessórias / o que o contador recebe.** Ato Conjunto RFB/CGIBS nº 1/2025 define as obrigações de IBS/CBS para 2026 (com dispensa de penalidade por erro até o 1º dia do 4º mês pós-regulamentação). EFD-ICMS/IPI e EFD-Contribuições convivem na transição, ganhando registros de IBS/CBS (ex.: C100/C190). Em 2026 apura-se e **reporta-se IBS/CBS como se fossem devidos** (ano informativo); a declaração tende a ser **pré-preenchida pelo Fisco a partir do próprio XML**. **O contador precisa receber:** (1) XML das NF-e de entrada íntegros; (2) eventos de manifestação; (3) memórias de apuração IBS/CBS por período (base/alíquota/valor/crédito por CST/cClassTrib); (4) reconciliação NF-e × A Pagar × contábil. **Canal padrão de mercado:** tag **`autXML`** com o **CNPJ do escritório contábil** (autoriza o contador a baixar o XML com o próprio certificado) + procuração e-CAC + export/API por período — **nunca PDF/planilha solta**. [SEFAZ-ES; Receita Federal Orientações 2026; Contmatic SPED 2026; Contabilizei; Jettax]

**Fluxo canônico dos ERPs (SAP/TOTVS Protheus/Oracle).** NF-e ENTRADA → manifestação (MD-e) → importação do XML com **validação da chave** → escrituração fiscal (SIGAFIS) → **geração do título no A Pagar a partir do documento** (o financeiro é **derivado** do fiscal) → apuração → SPED. **Duas lições:** (a) **entidade fiscal separada da financeira**, ligadas N:1 (NF-e cabeçalho + itens IBS/CBS ↔ título(s)); nunca colar imposto por item direto na tabela de A Pagar; (b) **idoneidade** (chave/SEFAZ/assinatura) como pré-condição do crédito e do SPED. [TOTVS importador XML/validação chave; 1ª NF-e CBS/IBS Protheus]

---

## 4. Modelo de dados proposto (em escopo, espelhando o Result)

**Princípio 1 — Fiscal é entidade separada, ligada ao título (padrão ERP + espelho do Result).** Não engordar `contas_pagar` com campos por item. Na `contas_pagar`, **só o elo**: a `chave_nfe` (já existe) + o nº do documento fiscal. O detalhe fiscal (cabeçalho + itens + impostos) vai para tabelas dedicadas `ap_nfe_*`, na **mesma granularidade item/linha da `NotasEntrada`/LEnt do Result e do Grupo UB do XML**.

**Princípio 2 — Espelhar o Result para não retrabalhar.** Os campos IBS/CBS nascem já com os nomes/semântica do Result (`AliqIBSUF/Mun`, `BaseIBS…`, `ValorIBS…`, `AliqCBS/BaseCBS/ValorCBS/Red…`) — que por sua vez são o espelho do Grupo UB do XML. Assim, quando a reforma virar dado real e/ou o round-trip Result ligar, o de-para é 1:1. **Criar as colunas IBS/CBS agora é inócuo enquanto não há dado** (2026 ano-teste) e evita migration dolorosa depois.

**Princípio 3 — O XML íntegro é a fonte da verdade.** Guardar o XML cru (5 anos+) em storage, e a chave de acesso como identidade. As tabelas relacionais são o índice/consulta; o XML é o documento legal.

### 4.1 Onde cada coisa mora

| Dado | Onde | Observação |
|---|---|---|
| **Elo chave↔título** | `contas_pagar.chave_nfe` (44) **já existe** | Índice `idx_contas_pagar_chave_nfe` já existe. Basta **passar a gravar** (fix do §3.2.1). |
| **nº doc. fiscal / tipo** | `contas_pagar.numero_documento_fiscal`, `codigo_tipo_documento` **já existem** | `numero_documento_fiscal` = `Numero` do Result (ponte). |
| **Retenções (withholding)** | `contas_pagar.valor_pis/cofins/csll/ir/iss/inss` **já existem** | Visão financeira do pagamento — **não** é o breakdown do documento. |
| **XML cru** | Storage: bucket `documento-anexos` via `anexos-api` (`cTabela='contas_pagar'`) **+** coluna `ap_nfe.xml_storage_path` | Reaproveita infra de anexos. Guarda legal 5 anos. |
| **Cabeçalho da NF-e** | **`ap_nfe`** (nova) | 1 linha por chave. |
| **Itens + impostos (inclui IBS/CBS)** | **`ap_nfe_itens`** (nova) | N linhas por NF-e = granularidade LEnt/Grupo UB. |
| **Duplicatas do XML** | **`ap_nfe_duplicatas`** (nova) ou direto nas parcelas do título | Alimenta as parcelas do título. |

### 4.2 Esboço das tabelas (nomes finais a definir na migration)

**`ap_nfe`** — cabeçalho, 1:1 com a chave, N:1 com título:
- `id`, `empresa_id`, `chave_acesso VARCHAR(44) UNIQUE` (elo com `contas_pagar.chave_nfe`)
- `numero`, `serie`, `modelo`, `data_emissao`, `data_entrada`
- `cnpj_emitente VARCHAR(18)`, `razao_social_emitente`, `fornecedor_id` (FK fornecedores do Huggs; casa com `CNPJ_For` do Result)
- `valor_produtos`, `valor_total_nfe`, `valor_total_ibs`, `valor_total_cbs`, `valor_total_is` (Grupo W03 — "por fora")
- `cfop_predominante`, `natureza_operacao`
- `xml_storage_path`, `xml_md5` (integridade), `pdf_url` (opcional)
- `status_idoneidade` (pendente/idôneo/rejeitado), `evento_manifestacao` (ciencia/confirmacao/nao_realizada/desconhecimento), `data_manifestacao`
- `contas_pagar_id` (FK — 1 NF-e pode gerar 1..N títulos por parcela; ou o elo é via `chave_nfe`)
- `origem` (upload_xml / distribuicao_dfe / result), `criado_por`, timestamps

**`ap_nfe_itens`** — item/linha, espelho de `NotasEntrada`/LEnt + Grupo UB:
- `id`, `ap_nfe_id` (FK), `numero_item`, `codigo_produto`, `descricao`, `ncm`, `cfop`, `cest`, `unidade`, `quantidade`, `valor_unitario`, `valor_total`
- **Impostos legados (regime atual, do parser já existente):** `cst_icms`, `base_icms`, `aliquota_icms`, `valor_icms`; `base_icms_st`, `aliquota_icms_st`, `valor_icms_st`; `cst_ipi`, `aliquota_ipi`, `valor_ipi`; `cst_pis`, `base_pis`, `aliquota_pis`, `valor_pis`; `cst_cofins`, `base_cofins`, `aliquota_cofins`, `valor_cofins`
- **Reforma (Grupo UB / espelho Result), criados agora, inócuos sem dado:** `cst_reforma`, `cclasstrib`; `base_ibs_uf`, `aliquota_ibs_uf`, `valor_ibs_uf`, `red_ibs_uf`; `base_ibs_mun`, `aliquota_ibs_mun`, `valor_ibs_mun`, `red_ibs_mun`; `base_cbs`, `aliquota_cbs`, `valor_cbs`, `red_cbs`; `base_is`, `aliquota_is`, `valor_is`; `elegivel_credito_iva BOOLEAN`
- **Crédito recuperável (segregado por tributo — LC 214 art.109):** `credito_ibs`, `credito_cbs` (nunca somados/cruzados)

**Vínculo nfe ↔ título ↔ fornecedor.** Elo primário = `chave_acesso` (`ap_nfe.chave_acesso` = `contas_pagar.chave_nfe`). Fornecedor = `cnpj_emitente` do XML batendo com o cadastro de fornecedores do Huggs (e com `CNPJ_For` do Result). `numero_documento_fiscal` do título = `numero` da NF-e = `Numero` da PK do Result → é a ponte para o round-trip.

**Regra de ouro:** o que entra em `contas_pagar` é só `chave_nfe` + `numero_documento_fiscal` + `codigo_tipo_documento` (identificação). Todo o resto (item/imposto/IBS/CBS) fica nas tabelas fiscais dedicadas. Isso mantém o A Pagar limpo e replica a separação NotasEntrada×ContasPagar do Result.

---

## 5. Fluxo do nascimento do título integrando o fiscal (fiscal → financeiro)

```
Colaborador lança despesa A PARTIR DA NF-e
        │  upload do XML (ou, futuro, chave → distribuição DF-e)
        ▼
[parse]  process-nfe-xml estendido (reusa parser atual + ADD extração Grupo UB IBS/CBS)
        │  → cabeçalho, itens, impostos, duplicatas, chave
        ▼
[pré-preenche o formulário do título com dados do XML]
        │  fornecedor (CNPJ emitente) · nº documento · valor · parcelas (duplicatas) · chave
        ▼
[TÍTULO NASCE] contas_pagar  ← chave_nfe + numero_documento_fiscal + fornecedor + parcelas
        │  ap_nfe + ap_nfe_itens (impostos, IBS/CBS)  ← gravados juntos
        │  XML cru → anexos-api (documento-anexos, cTabela='contas_pagar')
        ▼
[manifestação MD-e] (fase posterior) → status_idoneidade
        ▼
[aprovação P2P]  (fluxo §10/§11 existente)
        ▼
[futuro] envio ao Result via API (round-trip)  +  export ao contador
```

**Como o XML resolve gaps do §11 DE CARONA.** O §11 hoje quebra em três coisas que **o XML já traz prontas**:

| Gap do §11 (nascimento quebrado) | Como a NF-e resolve de carona |
|---|---|
| **Fornecedor** não persiste / precisa ser escolhido à mão | O XML traz **CNPJ + razão social do emitente** → fornecedor identificado/criado automaticamente (o `process-nfe-xml` já faz isso na fábrica via `buscarOuCriarFornecedor`). |
| **Parcelas** não persistem | O XML traz as **duplicatas** (`<dup>`: nº, vencimento, valor) → geram as parcelas do título direto, sem digitação. |
| **Plano/categoria** difícil de inferir | **NCM + CFOP + descrição por item** dão base objetiva para sugerir categoria/plano de contas (e já há IA de sugestão de categoria no `CadastroTituloAP`). |
| **Chave NF-e** digitada mas perdida (defeito §3.2.1) | Passa a **gravar** `body.chave_nfe` e a vir do parse — o elo fiscal nasce junto. |
| **Nº do documento / valor** redigitados | Vêm do `nNF` / `vNF` do XML. |

Ou seja: **o mesmo movimento que traz o fiscal conserta o nascimento financeiro.** Não é custo extra — é o caminho que já resolve os pendentes do §11.

**Correções de wiring necessárias (pré-requisito barato, alto retorno):** (1) setar `body.chave_nfe = nfeChave` no save de `CadastroTituloAP.tsx`; (2) trocar a chamada `process-nfe-xml { chave_acesso }` por um fluxo que passe o **XML** (upload) — ou criar um endpoint que aceite chave e, enquanto não houver integração DF-e, apenas persista a chave. Enquanto não há backend de download por chave, o **upload do XML é o caminho seguro**.

---

## 6. Compartilhamento com o contador

**O que exportar** (checklist de obrigações acessórias): (1) **XML das NF-e de entrada** do período (íntegros, com assinatura); (2) **eventos de manifestação** vinculados; (3) **memória de apuração IBS/CBS** por período — base/alíquota/valor/crédito por `CST`+`cClassTrib`, segregando IBS e CBS; (4) **reconciliação NF-e × A Pagar × contábil**.

**Como (padrão de mercado, não planilha):**
- **Curto prazo (captura):** uma **view/edge de export** por empresa+período que empacota os XMLs do storage + um relatório de impostos/crédito (CSV/JSON estruturado) — o contador importa na escrita fiscal. Reaproveita o padrão da `fiscal-iva-api` (que já apura IVA dual na fábrica) para gerar a **memória de cálculo** — a diferença é a fonte (itens `ap_nfe_itens` em vez de `fabrica_itens_nf`).
- **Robusto (mercado):** incluir a tag **`autXML` com o CNPJ do contador** quando/se o Huggs emitir documento próprio, e habilitar o contador a **baixar direto do autorizador** com o próprio certificado (procuração e-CAC). Isso tira o Huggs do caminho crítico de guarda/transmissão.
- **Não** exportar DANFE/PDF como documento fiscal — o valor legal (e o IBS/CBS) está no XML.

**Limite de escopo:** o Huggs **entrega o pacote**; **quem transmite a obrigação acessória é o contador** (ver §8, decisão 1).

---

## 7. Fases (caminho seguro, encaixado no roadmap F0–F4)

**Estrutural AGORA (inócuo, sem depender da reforma virar arrecadação nem da API Result):**
- **F0/F1 — Fundação fiscal.** (a) Fix dos 2 defeitos de wiring → a `chave_nfe` passa a gravar no título; (b) tabelas `ap_nfe` + `ap_nfe_itens` + `ap_nfe_duplicatas` **com os campos IBS/CBS já espelhando o Result** (inócuos sem dado); (c) guardar o **XML cru** via `anexos-api` (`cTabela='contas_pagar'`); (d) estender `process-nfe-xml` (ou fork `ap-nfe-xml`) para aterrissar no contexto do título e **adicionar extração do Grupo UB (IBS/CBS/IS)** ao parser — hoje ele lê ICMS/IPI/PIS/COFINS mas ignora IBS/CBS. Resultado: **o título nasce com lastro fiscal** e os gaps do §11 caem de carona.

**Espera a Reforma virar obrigatória (campos já existem, só passam a ter dado):**
- **F2 — Reforma ativa.** Quando o XML de entrada começar a trazer IBS/CBS preenchido (**CRT-3 a partir de 03/08/2026**; Simples 04/01/2027), o parser já populado passa a gravar valores reais; ligar a **memória de apuração** (reuso da `fiscal-iva-api`) e o **crédito recuperável** por título. **Manifestação do destinatário (MD-e)** entra aqui (status de idoneidade como pré-condição de crédito). Reconciliação líquido×bruto quando o **split payment** ligar (2027).

**Espera a API Result (round-trip):**
- **F3/F4 — Round-trip + contador.** Empurrar o título nascido no Huggs (com chave + fiscal) ao Result via API, casando pela PK `Empresa+Tipo+Numero+Seq+Fornecedor`. **Export/portal ao contador** (XMLs + memória) e, se aplicável, `autXML`.

**Regra de segurança:** nada aqui redesenha o A Pagar nem duplica o motor fiscal da fábrica; tudo é **aditivo** (colunas/tabelas novas, endpoint estendido) e **espelha** estruturas já existentes (Result + fábrica). Criar as colunas IBS/CBS antes de haver dado é o movimento **anti-retrabalho** central.

---

## 8. Riscos e decisões abertas (com recomendação)

1. **Huggs APURA fiscal ou só CAPTURA?** — **Recomendação: CAPTURA + compartilha; a apuração fica no Result/contador.** O Huggs guarda XML, breakdown por item e crédito recuperável, e **entrega** memória/pacote. Não reinventar motor de apuração/SPED (o Result já tem `CabCreditoFiscal`/`InventarioSpedH20`; o contador transmite). A `fiscal-iva-api` da fábrica pode gerar **memória de cálculo** como conferência, não como apuração oficial.

2. **Guarda legal do XML.** — **Recomendação: XML cru no `documento-anexos` (5 anos+) com `xml_md5` e a chave como identidade.** O XML é o documento legal; PDF/DANFE é decorativo (e ainda não mostra IBS/CBS). Definir política de retenção/backup do bucket.

3. **Como o XML entra (upload vs. distribuição DF-e vs. SEFAZ).** — **Recomendação F0/F1: upload do XML** (reaproveita `ChaveAcessoInput` + `process-nfe-xml`). Integração de **distribuição DF-e por CNPJ/certificado** é robusta mas cara → fase posterior. **Não** prometer "puxar pela chave" sem esse backend (é justamente o defeito atual).

4. **Manifestação do destinatário (MD-e).** — **Recomendação: modelar o `status_idoneidade`/`evento_manifestacao` desde já (F0/F1), mas só operacionalizar a emissão de eventos em F2**, quando o crédito de IBS/CBS depender formalmente da confirmação. Sem certificado/integração SEFAZ, F0/F1 registra o status manualmente.

5. **Vínculo 1 NF-e ↔ N títulos (parcelas) e chaves ausentes (despesa sem NF-e).** — **Recomendação:** modelar `ap_nfe` N:1 com título via `chave_acesso`, permitindo 1 NF-e gerar várias parcelas/títulos; e **manter o fluxo sem-XML** (despesas que não têm NF-e: aluguel, folha, taxas) — a camada fiscal é **opcional por título**, não obrigatória, para não travar o P2P atual.

---

## Fontes

- **LC 214/2025** — Planalto: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm
- **Cronograma 2026–2033** — Jettax: https://www.jettax.com.br/blog/cronograma-e-fases-da-reforma-tributaria-de-2026-a-2033/ · TOTVS Espaço Legislação: https://espacolegislacao.totvs.com/reforma-tributaria/ · Trad & Cavalcanti: https://www.tradecavalcanti.com.br/publicacoes/cronograma-reforma-tributaria-lei-complementar-214-2025
- **NT 2025.002-RTC (XML IBS/CBS)** — Tecnospeed: https://blog.tecnospeed.com.br/nota-tecnica-reforma-tributaria-nfe-nfce/ · FENACON: https://fenacon.org.br/reforma-tributaria/receita-publica-nota-tecnica-com-adequacoes-da-nf-e-e-nfc-e-para-a-reforma-tributaria/ · CG-IBS (03/08): https://www.cgibs.gov.br/novo-marco-da-reforma-tributaria-inicia-em-03-de-agosto-com-preenchimento-obrigatorio-dos-campos-relativos-ao-ibs-e-a-cbs
- **Crédito / não-cumulatividade** — Conjur 18/05/2026: https://www.conjur.com.br/2026-mai-18/direito-ao-credito-de-ibs-e-cbs-no-contexto-da-reforma-tributaria/ · Maran Gehlen: https://marangehlen.adv.br/reforma-tributaria-novas-regras-para-a-nao-cumulatividade-do-ibs-e-da-cbs/
- **Split payment** — Fazenda/MF jun 2026: https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/junho/receita-federal-e-comite-gestor-do-ibs-publicam-documentacao-tecnica-da-plataforma-publica-do-split-payment · Thomson Reuters: https://www.thomsonreuters.com.br/pt/tax-accounting/onesource-mastersaf/blog/split-payment-reforma-tributaria.html
- **Obrigações acessórias 2026 (Ato Conjunto RFB/CGIBS nº 1/2025)** — SEFAZ-ES: https://sefaz.es.gov.br/Not%C3%ADcia/ato-conjunto-da-receita-federal-e-comite-gestor-do-ibs-define-obrigacoes-acessorias-para-ibs-e-cbs-em-2026 · Receita Federal Orientações 2026: https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-consumo/orientacoes-2026 · SPED EFD 2026 (Contmatic): https://simplifique.contmatic.com.br/blogs/sped-efd-2026
- **Fluxo ERP (Protheus/SIGAFIS)** — TOTVS importador XML: https://centraldeatendimento.totvs.com/hc/pt-br/articles/360025780771 · validação chave: https://centraldeatendimento.totvs.com/hc/pt-br/articles/360044565354 · 1ª NF-e CBS/IBS Protheus: https://userfunction.com.br/sigafis/emitindo-a-1a-nf-e-no-protheus-com-cbs-e-ibs/
- **Guarda XML (5 anos) + MD-e** — GestãoClick: https://gestaoclick.com.br/blog/armazenamento-documentos-fiscais-digitais/ · Focus NFe (MD-e): https://focusnfe.com.br/blog/manifestacao-do-destinatario/ · NT 2020.001: https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=x/N7MoSHLxE%3D
- **Compartilhamento com contador (autXML)** — Contabilizei: https://www.contabilizei.com.br/contabilidade-online/xml-nota-fiscal/ · Jettax: https://www.jettax.com.br/blog/baixar-xml-de-nf-e-automaticamente-guia-completo-para-escritorios-contabeis-2/

---

### Arquivos-âncora do repo (absolutos)

- `C:\Users\LeandoMoraes\OneDrive - Ruby Rose\Documents\Claude\Projects\Sistema de Gestão do Huugs\supabase\functions\process-nfe-xml\index.ts` (parser — reaproveitável; falta extração IBS/CBS Grupo UB)
- `...\supabase\functions\fiscal-iva-api\index.ts` (apuração IVA dual — padrão de memória de cálculo)
- `...\supabase\functions\anexos-api\index.ts` + bucket `documento-anexos` (guarda do XML)
- `...\supabase\migrations\20260321192514_d356c4b2-8147-4798-bb72-51e68bd454a9.sql` (linhas 14-17 `chave_nfe`/`numero_documento_fiscal`/`codigo_tipo_documento`; 24-35 retenções; 62 índice `chave_nfe`)
- `...\supabase\migrations\20251119201042_...sql` (fábrica NF-e base), `...\20260302164928_...sql` (IBS/CBS entrada), `...\20260302170137_...sql` (NF saída + IVA)
- `...\src\pages\financeiro\CadastroTituloAP.tsx` (linhas 183-199 = gap `body.chave_nfe`; 225-227 = chamada errada a `process-nfe-xml`)
- `...\src\components\financeiro\ChaveAcessoInput.tsx` + `...\src\lib\fabrica\nfe-xml-parser.ts` (captura/parse client-side)
- `...\src\pages\FabricaRecebimentos.tsx` (único disparo real de `process-nfe-xml` hoje)
