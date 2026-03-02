

## Plano: Cadastro de Matéria-Prima com IA

### O que será feito

Replicar o mesmo fluxo de cadastro com IA dos Produtos Acabados para o dialog de Matérias-Primas, incluindo termo de responsabilidade, input de texto/imagem e preenchimento automático do formulário.

### Implementação

**1. Nova Edge Function `extrair-materia-prima-ia`**
- Mesma estrutura da `extrair-produto-ia`, mas com prompt e campos específicos para matéria-prima: `codigo`, `nome`, `unidade_medida`, `custo_unitario`, `estoque_atual`, `estoque_minimo`, `status`, `lote`, `data_validade`, `observacoes`
- Registrar no `config.toml` com `verify_jwt = false`

**2. Componente `CadastroIAStepMP` (ou reutilizar `CadastroIAStep` com prop `functionName`)**
- Melhor abordagem: tornar o `CadastroIAStep` genérico adicionando uma prop `edgeFunctionName` (default `"extrair-produto-ia"`) para que matéria-prima passe `"extrair-materia-prima-ia"`
- Mesmo layout: textarea, upload imagem, termo de responsabilidade, botão analisar

**3. Modificar `NovaMateriaPrimaDialog.tsx`**
- Adicionar estados `mode` (`"choose"` | `"ai"` | `"form"`), `aiFilledFields`, `aiMethod`
- Tela de escolha: "Preencher Manualmente" vs "Cadastrar com IA"
- Após IA extrair dados, mapear os campos retornados ao `formData` e exibir badges `🤖 IA` nos campos preenchidos
- Mapeamento de `unidade_medida` (sigla retornada pela IA) para o `unidade_medida_id` correspondente consultando a lista de unidades já carregada

### Arquivos envolvidos
- `supabase/functions/extrair-materia-prima-ia/index.ts` — nova edge function com prompt específico
- `supabase/config.toml` — registrar nova function
- `src/components/fabrica/CadastroIAStep.tsx` — adicionar prop `edgeFunctionName` para reutilização
- `src/components/fabrica/NovaMateriaPrimaDialog.tsx` — adicionar fluxo choose/ai/form com badges IA

