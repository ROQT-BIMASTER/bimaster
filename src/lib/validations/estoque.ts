import { z } from 'zod';

export const distribuidoraSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  cnpj: z.string().regex(/^\d{14}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido'),
  endereco: z.string().max(500).optional(),
  cidade: z.string().max(100).optional(),
  uf: z.string().length(2).optional(),
  telefone: z.string().max(20).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  ativo: z.boolean().default(true),
});

export const produtoMasterSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(255),
  sku_master: z.string().min(1, 'SKU é obrigatório').max(50),
  unidade_medida: z.string().default('UN'),
  categoria: z.string().max(100).optional(),
  subcategoria: z.string().max(100).optional(),
  descricao: z.string().max(1000).optional(),
  peso_liquido: z.number().min(0).optional(),
  peso_bruto: z.number().min(0).optional(),
  ativo: z.boolean().default(true),
});

export const vinculacaoSchema = z.object({
  produto_master_id: z.string().uuid('ID do produto master inválido'),
  distribuidora_id: z.string().uuid('ID da distribuidora inválido'),
  codigo_produto_distribuidora: z.string().min(1, 'Código é obrigatório').max(50),
  nome_exibicao: z.string().max(255).optional(),
  fator_conversao: z.number().min(0.0001).max(9999).default(1),
  ativo: z.boolean().default(true),
});

export const saldoInicialSchema = z.object({
  distribuidora_id: z.string().uuid('ID da distribuidora inválido'),
  produto_distribuidora_id: z.string().uuid('ID do produto inválido'),
  quantidade_disponivel: z.number().min(0, 'Quantidade não pode ser negativa'),
  localizacao: z.string().max(100).optional(),
  lote: z.string().max(50).optional(),
  data_validade: z.string().optional(),
  custo_medio: z.number().min(0).optional(),
});

export const movimentacaoSchema = z.object({
  estoque_id: z.string().uuid('ID do estoque inválido'),
  tipo_movimento: z.enum(['entrada', 'saida', 'transferencia', 'ajuste', 'inventario'], {
    errorMap: () => ({ message: 'Tipo de movimento inválido' })
  }),
  quantidade: z.number().min(0.0001, 'Quantidade deve ser maior que zero'),
  origem: z.string().max(255).optional(),
  destino: z.string().max(255).optional(),
  custo_unitario: z.number().min(0).optional(),
  documento_referencia: z.string().max(100).optional(),
  observacao: z.string().max(500).optional(),
});

export type DistribuidoraInput = z.infer<typeof distribuidoraSchema>;
export type ProdutoMasterInput = z.infer<typeof produtoMasterSchema>;
export type VinculacaoInput = z.infer<typeof vinculacaoSchema>;
export type SaldoInicialInput = z.infer<typeof saldoInicialSchema>;
export type MovimentacaoInput = z.infer<typeof movimentacaoSchema>;

// Helpers
export const formatCNPJ = (cnpj: string): string => {
  const numbers = cnpj.replace(/\D/g, '');
  return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const cleanCNPJ = (cnpj: string): string => {
  return cnpj.replace(/\D/g, '');
};

export const UNIDADES_MEDIDA = [
  { value: 'UN', label: 'Unidade' },
  { value: 'KG', label: 'Quilograma' },
  { value: 'G', label: 'Grama' },
  { value: 'L', label: 'Litro' },
  { value: 'ML', label: 'Mililitro' },
  { value: 'CX', label: 'Caixa' },
  { value: 'PCT', label: 'Pacote' },
  { value: 'FD', label: 'Fardo' },
  { value: 'DZ', label: 'Dúzia' },
  { value: 'M', label: 'Metro' },
  { value: 'M2', label: 'Metro Quadrado' },
  { value: 'M3', label: 'Metro Cúbico' },
];

export const TIPOS_MOVIMENTO = [
  { value: 'entrada', label: 'Entrada', color: 'bg-green-500' },
  { value: 'saida', label: 'Saída', color: 'bg-red-500' },
  { value: 'transferencia', label: 'Transferência', color: 'bg-blue-500' },
  { value: 'ajuste', label: 'Ajuste', color: 'bg-yellow-500' },
  { value: 'inventario', label: 'Inventário', color: 'bg-purple-500' },
];
