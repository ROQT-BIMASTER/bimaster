

# Fornecedores — Botão Voltar, Menu Lateral, Atalho em AP e Persistência de Estado

## Problemas Identificados

1. **Sem botão "Voltar"** na tela `/dashboard/financeiro/fornecedores`
2. **Sem acesso pelo menu lateral** — a rota existe mas não está no sidebar dinâmico (baseado em banco)
3. **Sem atalho em Contas a Pagar** — a tela `ContasPagarGestao` não tem link para fornecedores
4. **Perda de estado ao navegar** — ao sair da tela e voltar, o formulário/dialog fecha e perde dados preenchidos

## Plano

### 1. Adicionar botão "Voltar" na página Fornecedores

No header da página `Fornecedores.tsx`, adicionar um `Link` com `ArrowLeft` apontando para `/dashboard/financeiro` (módulo financeiro), usando o padrão `ModuleBreadcrumb` já existente no projeto.

### 2. Registrar tela no menu lateral (banco)

O sidebar é dinâmico via tabelas `sidebar_categories` e `sidebar_category_modules`. Para incluir "Fornecedores" no menu, precisa inserir na tabela `sidebar_category_modules` um registro vinculando o screenCode `financeiro_fornecedores` à categoria do módulo Financeiro. Isso será feito via migração SQL — inserindo o módulo na categoria "Cadastros" do financeiro (ou criando a categoria se não existir).

### 3. Adicionar atalho na tela de Contas a Pagar

No header do `ContasPagarGestao.tsx`, adicionar um botão/link "Fornecedores" ao lado das ações existentes, navegando para `/dashboard/financeiro/fornecedores`.

### 4. Persistir estado do formulário ao navegar para fora

O problema ocorre porque o `Dialog` é controlado por `dialogOpen` state, que reseta quando o componente desmonta (navegação). Solução:

- Salvar o estado do formulário (`form`, `editingId`, `dialogOpen`, `dialogTab`) no `sessionStorage` ao navegar para fora
- Restaurar ao montar o componente
- Usar `useEffect` com `beforeunload` e um wrapper para detectar navegação
- Limpar o sessionStorage ao fechar o dialog normalmente (salvar/cancelar)

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/Fornecedores.tsx` | Adicionar botão Voltar + persistência de formulário via sessionStorage |
| `src/pages/ContasPagarGestao.tsx` | Adicionar botão/atalho para Fornecedores no header |
| Migração SQL | Inserir `financeiro_fornecedores` no sidebar_category_modules |

