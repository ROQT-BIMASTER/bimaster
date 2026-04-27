# Catálogo de Módulos + Vínculo Bidirecional Perfil ↔ Módulos do Sistema

## Diagnóstico

Hoje, ao configurar uma etapa do Perfil de Processo, a aba **Módulos** exige que o usuário **digite manualmente** `modulo_codigo`, `label` e `rota`. Isso quebra três coisas:

1. **Sem padrão**: cada admin escreve um código diferente (`etiqueta_bula`, `etiqueta-bula`, `bula`).
2. **Sem catálogo**: não existe lista oficial dos módulos disponíveis (Composição, Amostras, Embalagem, Etiqueta/Bula, Aprovação de Artes, Fábrica China, etc.).
3. **Sem retorno**: quando o produto entra no módulo Etiqueta/Bula, o módulo não sabe que faz parte de uma etapa ativa de um processo — não há vínculo de mão dupla.

## Solução proposta

### 1. Catálogo oficial de módulos (`processo_modulo_catalogo`)

Nova tabela com os módulos disponíveis para vínculo, gerenciada por Admin:

| Coluna | Uso |
|---|---|
| `codigo` (PK textual) | `composicao`, `amostras`, `embalagem`, `etiqueta_bula`, `aprovacao_artes`, `fabrica_china`, `ficha_china`, `fluxo_artes`, `regulatorio`, `cofre_documentos`, etc. |
| `label`, `descricao`, `icone`, `cor` | Apresentação |
| `rota` | Caminho no app (ex: `/dashboard/etiqueta-bula`) |
| `entidade_alvo` | `produto` / `produto_china` / `projeto` / `tarefa` — define qual ID o módulo recebe |
| `param_template` | Padrão de querystring (ex: `?produto={entidade_id}`) |
| `cria_registro_automatico` | bool — se true, ao entrar na etapa o sistema cria/garante um registro do módulo vinculado à entidade |
| `ativo` | bool |

Seed inicial com **todos os módulos atuais do sistema** (composição, amostras, embalagem, etiqueta/bula, aprovação de artes, ficha China, fluxo de artes, ficha de custos, cofre de documentos, regulatório/ANVISA, etc.). Novos módulos podem ser adicionados via tela administrativa.

### 2. Refatorar `processo_etapa_modulos`

Trocar o campo livre `modulo_codigo` por **FK para o catálogo** (`modulo_codigo REFERENCES processo_modulo_catalogo(codigo)`). Adicionar:
- `auto_criar_registro` (bool) — sobrescreve o default do catálogo
- `bloqueia_avanco` (bool) — se true, etapa só avança quando o registro do módulo estiver "concluído"
- `config` (JSONB) — parâmetros específicos (ex: tipo de art, template de checklist)

### 3. Vínculo bidirecional via `modulo_processo_link`

Nova tabela que conecta **registro do módulo ↔ instância de processo ↔ etapa**:

| Coluna | Uso |
|---|---|
| `modulo_codigo` | qual módulo (ex: `etiqueta_bula`) |
| `registro_id` | id do registro daquele módulo (ex: id da etiqueta) |
| `instancia_id` | FK `processo_instancias` |
| `etapa_id` | FK `processo_perfil_etapas` |
| `status` | `pendente` / `em_andamento` / `concluido` |
| `concluido_em`, `concluido_por` | auditoria |

RPC `vincular_modulo_a_etapa(modulo, registro_id, instancia_id, etapa_id)` chamada pelas próprias telas dos módulos quando um registro é criado/atualizado.

### 4. Atualizar `pode_avancar_etapa`

Estender a função SQL existente para também verificar pendências de **módulos com `bloqueia_avanco=true`**: se a etapa exige Etiqueta/Bula concluída e não há `modulo_processo_link` com `status='concluido'`, vira pendência listada no diálogo de avanço.

### 5. UI — Refatorar aba "Módulos" da etapa

Em `PerfisProcesso.tsx`, substituir os 3 inputs livres por:
- **Combobox** carregando do catálogo (com ícone + label)
- Switch "Bloqueia avanço da etapa"
- Switch "Criar registro automático ao entrar na etapa"
- Botão "Gerenciar catálogo" (admin) → abre modal de CRUD do catálogo

### 6. UI — Banner "Faz parte de processo" nos módulos

Em cada módulo alvo (Etiqueta/Bula, Composição, Amostras, Embalagem, Aprovação de Artes, Fábrica China), adicionar componente reutilizável `<ProcessoVinculoBanner moduloCodigo registroId />` que:
- Consulta `modulo_processo_link` daquele registro
- Mostra: "Este registro faz parte da etapa **X** do processo **Y** (produto/projeto Z)"
- Botão "Marcar como concluído" → atualiza status do link e libera a etapa
- Link "Voltar ao processo" → leva à página da entidade dona

### 7. Aplicação automática ao avançar/aplicar perfil

Estender `aplicar_perfil_processo` e `avancar_etapa_processo` para:
- Ao entrar numa etapa cujos módulos têm `auto_criar_registro=true`, criar o registro stub no módulo e gerar o `modulo_processo_link`.
- Ex: entrou em "Aprovação de Etiqueta" → cria automaticamente uma entrada em `etiqueta_bula` para aquele produto, já vinculada à etapa.

### 8. Tela administrativa de catálogo (`/dashboard/processos/modulos-catalogo`)

CRUD para Admin gerenciar os módulos disponíveis (futura extensibilidade), restrito por `useUserRole().isAdmin`.

## Migração

- Migration cria as 2 tabelas novas + colunas em `processo_etapa_modulos` + seed do catálogo com ~12 módulos atuais + adapta `pode_avancar_etapa` + cria função `vincular_modulo_a_etapa`.
- Vínculos manuais existentes em `processo_etapa_modulos` permanecem (códigos textuais) — backfill mapeia para o catálogo quando o código bate.
- RLS: leitura para autenticados; escrita apenas Admin no catálogo; escrita em `modulo_processo_link` para membros do projeto/produto.

## Entregáveis

**Backend (1 migration)**
- Tabelas `processo_modulo_catalogo`, `modulo_processo_link`
- Colunas novas em `processo_etapa_modulos`
- Seed do catálogo (12 módulos)
- Funções `vincular_modulo_a_etapa`, `concluir_modulo_link`, atualização de `pode_avancar_etapa` e `avancar_etapa_processo`
- RLS

**Frontend**
- `src/hooks/useModuloCatalogo.ts` — listar/CRUD catálogo
- `src/hooks/useModuloProcessoLink.ts` — consultar/atualizar links
- `src/components/processos/ModuloCatalogoCombobox.tsx` — selecionar módulo
- `src/components/processos/ProcessoVinculoBanner.tsx` — banner reutilizável nos módulos
- `src/pages/processos/CatalogoModulos.tsx` — admin CRUD
- Editar `src/pages/processos/PerfisProcesso.tsx` — aba Módulos com combobox + flags
- Editar `src/hooks/useProcessoPerfis.ts` — tipos e mutations dos novos campos
- Embed do banner em: `EtiquetaBula.tsx`, `Composicao*.tsx`, `Amostras*.tsx`, `Embalagem*.tsx`, `AprovacaoArtes*.tsx`, `FichaChina*.tsx`
- Registrar rota e item de sidebar para "Catálogo de Módulos"

## Resultado esperado

Admin cria perfil "Lançamento Brasil" → adiciona etapa "Aprovação de Etiqueta" → no combobox seleciona o módulo **Etiqueta/Bula** com `bloqueia_avanco=true`. Ao aplicar esse perfil ao Produto X, o sistema cria automaticamente o registro de etiqueta para o Produto X. Quando a equipe abre o módulo Etiqueta/Bula, vê o banner "Etapa do processo de Lançamento — Produto X". Ao concluir a etiqueta, o link vira `concluido` e o botão **Avançar etapa** no card do produto libera. Ciclo fechado, dos dois lados.