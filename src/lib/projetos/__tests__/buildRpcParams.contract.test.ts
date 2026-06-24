/**
 * Teste de CONTRATO — `buildRpcParams` é a única fonte de verdade dos
 * parâmetros enviados ao `rpc_china_criar_projeto_espelho`.
 *
 * Invariante: para qualquer `ProjectCreateOpts`, os parâmetros gerados
 * para `create` (sem projetoId) e para `linkExisting` (com projetoId)
 * devem ser IDÊNTICOS exceto pelo campo `p_projeto_id`.
 *
 * Qualquer falha aqui significa que um caller começou a divergir — bloqueie
 * a PR e force o uso de `buildRpcParams`.
 */
import { describe, it, expect } from "vitest";
import {
  buildRpcParams,
  DEFAULT_SECAO_NOME,
  type ProjectCreateOpts,
} from "../projectCreateOpts";

const SCENARIOS: Array<{ name: string; opts: ProjectCreateOpts }> = [
  { name: "vazio (defaults puros)", opts: {} },
  { name: "apenas projetoNome", opts: { projetoNome: "Compact powder" } },
  { name: "apenas templateB2cId", opts: { templateB2cId: "tpl-1" } },
  { name: "secaoNome customizada", opts: { secaoNome: "Outra Seção" } },
  {
    name: "calendário corridos + feriados RJ",
    opts: { regimeCalendario: "corridos", usaFeriados: true, ufFeriados: "RJ" },
  },
  {
    name: "calendário dias_uteis sem feriados",
    opts: { regimeCalendario: "dias_uteis", usaFeriados: false, ufFeriados: null },
  },
  {
    name: "datas + prazos completos",
    opts: {
      dataInicio: "2026-07-01",
      dataFimAlvo: "2026-12-31",
      prazoPadraoTarefa: 5,
      alertaAntecipacaoDias: 2,
    },
  },
  { name: "substituir=true", opts: { substituir: true } },
  {
    name: "todos os campos preenchidos",
    opts: {
      projetoNome: "Liquid eyeliner",
      templateB2cId: "tpl-2",
      secaoNome: "Documentos Personalizados",
      dataInicio: "2026-08-01",
      dataFimAlvo: "2027-01-15",
      prazoPadraoTarefa: 7,
      alertaAntecipacaoDias: 3,
      regimeCalendario: "uteis_com_sabado",
      usaFeriados: true,
      ufFeriados: "SP",
      substituir: true,
    },
  },
  {
    name: "nulls explícitos não vazam undefined",
    opts: {
      projetoNome: null,
      templateB2cId: null,
      dataInicio: null,
      dataFimAlvo: null,
      prazoPadraoTarefa: null,
      alertaAntecipacaoDias: null,
      regimeCalendario: null,
      usaFeriados: null,
      ufFeriados: null,
    },
  },
];

const EXPECTED_KEYS = [
  "p_submissao_id",
  "p_projeto_id",
  "p_template_b2c_id",
  "p_secao_nome",
  "p_projeto_nome",
  "p_data_inicio",
  "p_data_fim_alvo",
  "p_prazo_padrao_tarefa",
  "p_alerta_antecipacao_dias",
  "p_regime_calendario",
  "p_usa_feriados",
  "p_uf_feriados",
  "p_substituir",
].sort();

describe("buildRpcParams — contrato create vs linkExisting", () => {
  it.each(SCENARIOS)(
    "$name: create e linkExisting diferem APENAS em p_projeto_id",
    ({ opts }) => {
      const create = buildRpcParams("s-x", null, opts);
      const link = buildRpcParams("s-x", "p-x", opts);

      // Mesmo conjunto de chaves
      expect(Object.keys(create).sort()).toEqual(EXPECTED_KEYS);
      expect(Object.keys(link).sort()).toEqual(EXPECTED_KEYS);

      // Única diferença permitida
      expect(create.p_projeto_id).toBeNull();
      expect(link.p_projeto_id).toBe("p-x");

      const { p_projeto_id: _c, ...createRest } = create;
      const { p_projeto_id: _l, ...linkRest } = link;
      expect(createRest).toEqual(linkRest);
    },
  );

  it("defaults documentados são aplicados quando o campo é omitido", () => {
    const p = buildRpcParams("s", null, {});
    expect(p.p_secao_nome).toBe(DEFAULT_SECAO_NOME);
    expect(p.p_substituir).toBe(false);
    for (const k of [
      "p_template_b2c_id",
      "p_projeto_nome",
      "p_data_inicio",
      "p_data_fim_alvo",
      "p_prazo_padrao_tarefa",
      "p_alerta_antecipacao_dias",
      "p_regime_calendario",
      "p_usa_feriados",
      "p_uf_feriados",
    ] as const) {
      expect(p[k]).toBeNull();
    }
  });

  it("nunca produz undefined (PostgREST exige null explícito)", () => {
    for (const { opts } of SCENARIOS) {
      const create = buildRpcParams("s", null, opts);
      const link = buildRpcParams("s", "p", opts);
      for (const v of Object.values(create)) expect(v).not.toBeUndefined();
      for (const v of Object.values(link)) expect(v).not.toBeUndefined();
    }
  });

  it("submissaoId é propagado literalmente em ambos os caminhos", () => {
    expect(buildRpcParams("abc", null).p_submissao_id).toBe("abc");
    expect(buildRpcParams("abc", "p").p_submissao_id).toBe("abc");
  });
});
