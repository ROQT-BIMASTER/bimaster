
## Correcao de Mensagens e Modulo de Requisitos Obrigatorios na Revisao

### Problema 1: Mensagens nao aparecem na tela de aprovacao

**Causa raiz identificada:** Quando o usuario resubmete a ficha apos revisao, o sistema cria uma NOVA revisao (v2 com ID diferente). As mensagens enviadas estavam vinculadas a revisao anterior (v1). Como o chat filtra por `revisao_id`, as mensagens "desaparecem".

**Solucao:** Alterar o `RevisaoChatPanel` para buscar mensagens de TODAS as revisoes do mesmo `config_id`, nao apenas da revisao atual. Assim, todo o historico de comunicacao e preservado entre versoes.

- Adicionar prop `configId` ao `RevisaoChatPanel`
- Buscar mensagens com query: todas as revisoes que pertencem ao mesmo `config_id`, ordenadas por data
- Exibir um separador visual entre versoes (ex: "--- Revisao v1 ---")
- Novas mensagens continuam sendo inseridas com o `revisao_id` atual
- Atualizar os dois pontos de integracao (editor do usuario e tela da diretoria)

### Problema 2: Opcoes de requisitos obrigatorios na revisao

Permitir que a Diretoria, ao solicitar revisao, defina requisitos obrigatorios que o usuario precisa cumprir antes de resubmeter.

#### 2a. Nova tabela no banco

**Tabela:** `fabrica_revisao_requisitos`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | PK |
| revisao_id | uuid | FK para fabrica_ficha_custo_revisoes |
| descricao | text | Ex: "Subir 3 orcamentos para o insumo X" |
| tipo | text | "orcamentos", "evidencia", "justificativa", "outro" |
| quantidade_minima | integer | Ex: 3 (para orcamentos) |
| insumo_id | uuid (nullable) | Insumo especifico, se aplicavel |
| cumprido | boolean | Default false |
| cumprido_em | timestamptz | |
| created_at | timestamptz | |

- RLS: usuarios autenticados podem SELECT; INSERT/UPDATE para autenticados

#### 2b. UI na tela da Diretoria

Na secao de "Solicitar Revisao" do `FichaRevisaoDiretoria.tsx`:

- Adicionar secao "Requisitos Obrigatorios" abaixo dos apontamentos
- Opcoes pre-definidas via checkboxes/cards:
  - "Subir orcamentos" (com campo de quantidade minima, ex: 3)
  - "Anexar evidencia/NF" (com campo de quantidade)
  - "Justificar manutencao de valores"
  - "Outro" (campo de texto livre)
- Opcao de vincular a um insumo especifico via dropdown
- Ao clicar "Enviar Revisao", salvar os requisitos na tabela junto com os apontamentos

#### 2c. UI na tela do usuario (FichaCustoProdutoEditor)

- Exibir os requisitos pendentes em um card de alerta abaixo do banner de revisao
- Cada requisito mostra:
  - Descricao e tipo
  - Status (cumprido/pendente) com icone
  - Progresso (ex: "1/3 orcamentos subidos")
- Verificacao automatica de cumprimento:
  - Para tipo "orcamentos": contar cotacoes em `fabrica_mp_cotacoes` para o insumo
  - Para tipo "evidencia": contar arquivos em evidencias
- Bloquear a resubmissao ate todos os requisitos estarem cumpridos

---

### Detalhes tecnicos

**Arquivos a criar:**
- Nenhum componente novo (tudo integrado nos existentes)

**Arquivos a modificar:**
- `src/components/fabrica/RevisaoChatPanel.tsx` — buscar mensagens por config_id em vez de apenas revisao_id
- `src/components/fabrica/FichaCustoProdutoEditor.tsx` — passar configId ao chat; exibir card de requisitos pendentes; bloquear resubmissao
- `src/pages/FichaRevisaoDiretoria.tsx` — adicionar secao de requisitos obrigatorios no modo revisao
- `src/hooks/useFichaRevisao.ts` — salvar requisitos junto com a revisao; buscar requisitos ativos

**Migration SQL:**
- Tabela `fabrica_revisao_requisitos` com RLS e indice em `revisao_id`
