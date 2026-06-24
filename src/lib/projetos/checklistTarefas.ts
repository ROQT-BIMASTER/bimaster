/**
 * Checklist hardcoded de tarefas por seção, usado pelo fluxo legado de criação
 * de projeto a partir de submissão China (item #3 do mapa de duplicidades).
 *
 * Extraído de `src/hooks/useChinaProjeto.ts` na Fase 10 da unificação
 * Submissão↔Projeto, para que:
 *   - O mesmo bloco não fique duplicado em hooks e páginas.
 *   - A consolidação com o template B2C (Fase 11+) tenha um único ponto de
 *     mudança.
 *
 * Mudar este arquivo afeta APENAS projetos criados pelo fluxo legado da Ficha;
 * o fluxo unificado via `ProjectService.createFromSubmission` usa o template
 * B2C do banco.
 */
export const TAREFAS_POR_SECAO: Record<
  string,
  { pt: string; cn: string }[]
> = {
  "Criação / Identidade": [
    { pt: "Definir identidade visual do produto", cn: "定义产品视觉标识" },
    { pt: "Criar conceito de marca para o produto", cn: "创建产品品牌概念" },
  ],
  "Desenvolvimento de Produtos": [
    { pt: "Analisar ficha técnica da China", cn: "分析中国技术表" },
    { pt: "Validar fórmula e composição", cn: "验证配方和成分" },
  ],
  "Desenvolvimento de Embalagem": [
    { pt: "Aprovar desenhos técnicos (facas)", cn: "批准技术图纸（刀版）" },
    { pt: "Validar embalagem primária", cn: "验证一级包装" },
    { pt: "Definir caixa display e master", cn: "定义展示盒和主箱" },
  ],
  "Informações dos Produtos (Briefing)": [
    { pt: "Preencher briefing do produto", cn: "填写产品简报" },
    { pt: "Definir público-alvo e posicionamento", cn: "定义目标受众和定位" },
  ],
  "Assuntos Regulatórios": [
    { pt: "Validar documentação regulatória", cn: "验证监管文件" },
    { pt: "Conferir fórmula com ANVISA", cn: "与ANVISA核实配方" },
    { pt: "Solicitar registro/notificação", cn: "申请注册/通知" },
  ],
  "Criação / Artes": [
    { pt: "Criar arte final do rótulo", cn: "创建标签终稿" },
    { pt: "Criar arte da caixa display", cn: "创建展示盒设计" },
    { pt: "Criar materiais de comunicação", cn: "创建宣传材料" },
  ],
};
