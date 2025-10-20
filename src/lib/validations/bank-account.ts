import { z } from "zod";

export const bankAccountSchema = z.object({
  store_id: z.string()
    .uuid({ message: "ID da loja inválido" }),
  
  account_number: z.string()
    .trim()
    .min(3, { message: "Número da conta deve ter no mínimo 3 caracteres" })
    .max(50, { message: "Número da conta deve ter no máximo 50 caracteres" }),
  
  bank_name: z.string()
    .trim()
    .min(3, { message: "Nome do banco deve ter no mínimo 3 caracteres" })
    .max(100, { message: "Nome do banco deve ter no máximo 100 caracteres" }),
  
  agency: z.string()
    .trim()
    .max(20, { message: "Agência deve ter no máximo 20 caracteres" })
    .optional(),
  
  account_type: z.enum(["checking", "savings", "investment"], {
    errorMap: () => ({ message: "Tipo de conta inválido" })
  }).default("checking"),
  
  initial_balance: z.number({
    required_error: "Saldo inicial é obrigatório",
  })
    .min(0, { message: "Saldo inicial não pode ser negativo" })
    .max(100000000, { message: "Saldo inicial não pode exceder R$ 100.000.000" })
    .multipleOf(0.01, { message: "Saldo deve ter no máximo 2 casas decimais" }),
  
  notes: z.string()
    .trim()
    .max(1000, { message: "Observações devem ter no máximo 1000 caracteres" })
    .optional(),
});

export const bankTransactionSchema = z.object({
  bank_account_id: z.string()
    .uuid({ message: "ID da conta inválido" }),
  
  transaction_date: z.date({
    required_error: "Data da transação é obrigatória",
  }),
  
  transaction_type: z.enum(["credit", "debit"], {
    errorMap: () => ({ message: "Tipo de transação inválido" })
  }),
  
  amount: z.number({
    required_error: "Valor é obrigatório",
  })
    .positive({ message: "Valor deve ser maior que zero" })
    .max(10000000, { message: "Valor não pode exceder R$ 10.000.000" })
    .multipleOf(0.01, { message: "Valor deve ter no máximo 2 casas decimais" }),
  
  description: z.string()
    .trim()
    .min(3, { message: "Descrição deve ter no mínimo 3 caracteres" })
    .max(500, { message: "Descrição deve ter no máximo 500 caracteres" }),
  
  reference_number: z.string()
    .trim()
    .max(50, { message: "Número de referência deve ter no máximo 50 caracteres" })
    .optional(),
  
  financial_entry_id: z.string()
    .uuid({ message: "ID do lançamento inválido" })
    .optional()
    .nullable(),
  
  investment_id: z.string()
    .uuid({ message: "ID do investimento inválido" })
    .optional()
    .nullable(),
});

export type BankAccountFormData = z.infer<typeof bankAccountSchema>;
export type BankTransactionFormData = z.infer<typeof bankTransactionSchema>;
