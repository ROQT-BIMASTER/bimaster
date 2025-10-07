import { z } from "zod";

export const prospectSchema = z.object({
  nome_empresa: z
    .string()
    .trim()
    .min(2, { message: "Nome da empresa deve ter no mínimo 2 caracteres" })
    .max(200, { message: "Nome da empresa deve ter no máximo 200 caracteres" }),
  cnpj: z
    .string()
    .trim()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, { 
      message: "CNPJ inválido. Use 00.000.000/0000-00" 
    })
    .optional()
    .or(z.literal("")),
  cnpj_raiz: z.string().optional().or(z.literal("")),
  dominio: z.string().optional().or(z.literal("")),
  nome_fantasia: z.string().optional().or(z.literal("")),
  perfil_linkedin: z.string().optional().or(z.literal("")),
  segmento: z.string().optional().or(z.literal("")),
  cnae_codigo: z.string().optional().or(z.literal("")),
  cnae_principal: z.string().optional().or(z.literal("")),
  tipo_estabelecimento: z.string().optional().or(z.literal("")),
  total_funcionarios: z.number().optional(),
  faixa_funcionarios: z.string().optional().or(z.literal("")),
  faixa_faturamento: z.string().optional().or(z.literal("")),
  total_filiais: z.number().optional(),
  tipo_entidade: z.string().optional().or(z.literal("")),
  natureza_juridica: z.string().optional().or(z.literal("")),
  data_abertura: z.string().optional().or(z.literal("")),
  nivel_atividade: z.string().optional().or(z.literal("")),
  tendencia_crescimento: z.string().optional().or(z.literal("")),
  contato_principal: z
    .string()
    .trim()
    .min(3, { message: "Nome do contato deve ter no mínimo 3 caracteres" })
    .max(100, { message: "Nome do contato deve ter no máximo 100 caracteres" })
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, { message: "Nome do contato deve conter apenas letras" })
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "Email deve ter no máximo 255 caracteres" })
    .toLowerCase()
    .optional()
    .or(z.literal("")),
  demais_emails: z.string().optional().or(z.literal("")),
  telefone: z
    .string()
    .trim()
    .regex(/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/, { 
      message: "Telefone inválido. Use (00) 00000-0000" 
    })
    .optional()
    .or(z.literal("")),
  demais_telefones: z.string().optional().or(z.literal("")),
  tipo_logradouro: z.string().optional().or(z.literal("")),
  logradouro: z.string().optional().or(z.literal("")),
  numero: z.string().optional().or(z.literal("")),
  cep: z.string().optional().or(z.literal("")),
  bairro: z.string().optional().or(z.literal("")),
  perfil_facebook: z.string().optional().or(z.literal("")),
  perfil_instagram: z.string().optional().or(z.literal("")),
  perfil_twitter: z.string().optional().or(z.literal("")),
  url_company_page: z.string().optional().or(z.literal("")),
  situacao: z.string().optional().or(z.literal("")),
  territorio: z.string().optional().or(z.literal("")),
  trm: z.string().optional().or(z.literal("")),
  faixa_score_propensao: z.string().optional().or(z.literal("")),
  score_propensao: z.number().optional(),
  faixa_score_contactability: z.string().optional().or(z.literal("")),
  variacao_score_propensao: z.number().optional(),
  status: z.enum(["novo", "em_contato", "proposta_enviada", "negociacao", "ganho", "perdido"], {
    errorMap: () => ({ message: "Status inválido" })
  }),
  categoria: z.enum(["A", "B", "C", "D"], {
    errorMap: () => ({ message: "Categoria inválida" })
  }).optional().or(z.literal("")),
  observacoes: z
    .string()
    .trim()
    .max(1000, { message: "Observações devem ter no máximo 1000 caracteres" })
    .optional()
    .or(z.literal("")),
});

export type ProspectFormData = z.infer<typeof prospectSchema>;
