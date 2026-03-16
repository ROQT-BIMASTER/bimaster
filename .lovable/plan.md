

## Diagnóstico e Evolução do Fluxo de Aprovação de Artes

### Problema 1: "Sistema não está salvando os fluxos"

**Diagnóstico:** Os configs e etapas ESTÃO sendo salvos no banco (encontrei 2 configs e 3 etapas). O problema real é que **não existe botão para iniciar uma instância de fluxo** no painel principal. O hook `useIniciarFluxo` é importado no `FluxoAprovacaoArtes.tsx` mas nunca é utilizado. O empty state diz "Inicie um novo fluxo a partir do módulo China ou Projetos", mas não há nenhum ponto de entrada nesses módulos também. Resultado: o usuário cria o fluxo, configura etapas, mas nunca consegue iniciar uma instância.

### Problema 2: Gestão documental inexistente

Não existe tabela nem UI para anexar documentos a uma instância de fluxo. Sem isso, o fluxo é apenas um workflow abstrato sem os artefatos que estão sendo aprovados/rejeitados.

### Problema 3: Vinculação com módulos

A instância tem campos `submissao_id`, `projeto_id` e `produto_brasil_id`, mas não há vínculo com checklist, documentos da China, seções ou tarefas específicas.

---

### Plano de Implementação

#### 1. Banco de Dados (Migration)

**Nova tabela `fluxo_aprovacao_anexos`:**

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| instancia_id | uuid FK | Vínculo com instância do fluxo |
| etapa_id | uuid FK nullable | Etapa em que foi anexado |
| nome_arquivo | text | Nome do arquivo |
| arquivo_url | text | URL do storage |
| tipo | text | "documento", "arte", "evidencia" |
| versao | integer default 1 | Versionamento automático |
| substituido_por | uuid nullable self-ref | Aponta para nova versão |
| uploaded_by | uuid | Quem fez upload |
| observacao | text nullable | Nota sobre o upload |
| created_at | timestamptz | |

**Nova tabela `fluxo_aprovacao_vinculos`:**

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| instancia_id | uuid FK | |
| tipo_vinculo | text | "checklist", "documento_china", "tarefa", "secao", "submissao" |
| ref_id | text | ID do item referenciado |
| ref_label | text | Label legível |
| created_by | uuid | |
| created_at | timestamptz | |

**Adição de colunas em `fluxo_aprovacao_instancias`:**
- `titulo text` — Título descritivo da instância
- `descricao text` — Detalhamento

RLS: authenticated pode SELECT e INSERT em ambas. Update em anexos para substituição.

#### 2. Botão "Iniciar Fluxo" no Painel (`FluxoAprovacaoArtes.tsx`)

Adicionar botão "Novo Fluxo" que abre dialog com:
- Seleção do template de fluxo (configs existentes)
- Título da instância (obrigatório)
- Descrição (opcional)
- Opção de vincular a uma submissão China, projeto ou produto Brasil
- Ao confirmar, chama `useIniciarFluxo` e redireciona ao detalhe

#### 3. Gestão de Documentos no Detalhe (`FluxoAprovacaoDetalhe.tsx`)

Nova seção "Documentos do Fluxo" com:
- Upload de arquivos por etapa
- Lista de documentos com versão, quem enviou, data
- Botão "Substituir" que cria nova versão e marca a anterior como `substituido_por`
- Cada substituição registra uma transição no histórico (audit trail)
- Badge "v1", "v2", "v3" para cada versão com tooltip de quem substituiu

#### 4. Painel de Vínculos no Detalhe

Nova seção "Vínculos" abaixo dos documentos:
- Botão "Vincular Item" abre dialog com tipos:
  - **Checklist China**: Lista categorias/itens do checklist da submissão vinculada
  - **Documento China**: Lista documentos da submissão
  - **Tarefa do Projeto**: Seletor de projeto → seção → tarefa
  - **Submissão China**: Busca por código/nome
- Cada vínculo aparece como badge clicável (navega ao item)
- Remoção com confirmação

#### 5. UX: Simulação do Fluxo Departamental

Melhorias baseadas na perspectiva dos funcionários de cada departamento:

- **Indicador visual "Sua vez"**: Badge destacado quando o usuário logado é responsável pela etapa atual
- **Contador de pendências no painel**: Filtro "Minhas Pendências" mostrando apenas fluxos onde o usuário é o próximo aprovador
- **Notificação contextual**: Na timeline, mostrar claramente "Documento substituído por [nome] em [data]" com diff visual
- **Grid responsivo**: Adaptar o layout de 3 colunas da config para funcionar em mobile (o usuário está em viewport 430px)

### Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `fluxo_aprovacao_anexos`, `fluxo_aprovacao_vinculos`, colunas extras |
| `src/pages/FluxoAprovacaoArtes.tsx` | Adicionar botão "Novo Fluxo" com dialog, tab "Minhas Pendências" |
| `src/pages/FluxoAprovacaoDetalhe.tsx` | Seções de Documentos e Vínculos, substituição com audit |
| `src/pages/FluxoAprovacaoConfig.tsx` | Tornar layout responsivo (grid-cols-1 em mobile) |
| `src/hooks/useFluxoAprovacaoArtes.ts` | Hooks para anexos e vínculos |

