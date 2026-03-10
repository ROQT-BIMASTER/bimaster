

# Integração China → Projetos com Rastreabilidade ao Produto

## Contexto

Hoje os módulos China e Projetos são independentes. O usuário quer que quando um produto chega da China, o Brasil possa criar um projeto de desenvolvimento vinculado a essa submissão, distribuindo tarefas por departamento (Regulatório, Embalagem, Criação, etc.), com tudo amarrado ao produto e rastreável no histórico.

## O que será feito

### 1. Tabela de vínculo: `china_submissao_projetos`

Nova tabela que conecta uma submissão China a um projeto:

```sql
china_submissao_projetos (
  id uuid PK,
  submissao_id uuid FK → china_produto_submissoes,
  projeto_id uuid FK → projetos,
  created_by uuid,
  created_at timestamptz
)
```

Isso permite rastrear qual projeto nasceu de qual submissão China e vice-versa.

### 2. Botão "Criar Projeto de Desenvolvimento" na Ficha do Produto (`ChinaFichaProduto.tsx`)

Na ficha unificada, adicionar uma seção **Projetos Vinculados** com:
- Se não há projeto vinculado: botão "Criar Projeto de Desenvolvimento 创建开发项目"
- Se já existe: card com link direto para o projeto, mostrando progresso (tarefas concluídas / total)

Ao clicar em "Criar Projeto":
1. Cria automaticamente um projeto usando template `desenvolvimento_produto` (já existente)
2. Nome automático: `"[código] - [nome produto]"` (ex: "HB-001 - Batom Matte")
3. Insere registro na tabela `china_submissao_projetos`
4. Cria tarefas pré-definidas nas seções do template, com títulos bilíngues referenciando o produto
5. Navega para o projeto criado

### 3. Vínculo reverso: Projeto → Submissão China

No `ProjetoDetalhe.tsx`, se o projeto está vinculado a uma submissão China, mostrar um badge/link "Produto China: [código]" no header, permitindo navegar de volta à ficha.

### 4. Histórico do Produto

Registrar no histórico (`fabrica_produtos_historico` ou nos logs da submissão) quando um projeto é criado a partir da submissão, garantindo rastreabilidade completa.

### 5. Tarefas automáticas por seção

Ao criar o projeto, gerar tarefas iniciais baseadas no tipo de produto China:
- **Criação/Identidade**: "Definir identidade visual do produto"
- **Desenvolvimento de Embalagem**: "Aprovar desenhos técnicos (facas)", "Validar embalagem primária"
- **Assuntos Regulatórios**: "Validar documentação regulatória", "Conferir fórmula"
- **Criação/Artes**: "Criar arte final do rótulo", "Criar arte da caixa display"
- **Informações dos Produtos**: "Preencher briefing do produto"

Cada tarefa criada é vinculada à submissão via `projeto_tarefa_produtos` (já existente, usando `produto_id`).

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | **Criar**: tabela `china_submissao_projetos` com RLS |
| `src/pages/ChinaFichaProduto.tsx` | **Editar**: adicionar seção "Projetos Vinculados" com botão de criação automática |
| `src/pages/ProjetoDetalhe.tsx` | **Editar**: mostrar badge de origem China no header se vinculado |
| `src/hooks/useChinaProjeto.ts` | **Criar**: hook para criar projeto a partir de submissão China (cria projeto + seções + tarefas + vínculo) |

