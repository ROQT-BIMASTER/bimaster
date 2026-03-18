

## Plano: Vincular Ficha do Produto China a Projetos + Controle de Visibilidade e Despacho

### Contexto
A tela "Ficha do Produto" (`ChinaFichaProduto.tsx`) é preenchida pela China e contém dados relevantes ao processo. Atualmente, a seção "Projetos Vinculados" só permite criar novos projetos de desenvolvimento. O usuário quer:
1. Vincular a ficha a projetos existentes (usando o padrão `VincularProjetoDialog`)
2. Controlar quais usuários podem visualizar a ficha
3. Despachar a ficha para usuários com permissão nos submódulos

### Alterações

#### 1. Adicionar "Vincular a Projeto" na seção de Projetos Vinculados
- Na `ChinaProjetosVinculadosSection`, adicionar um botão "Vincular a Projeto Existente" que abre o `VincularProjetoDialog` reutilizável
- Usar `modulo: "ficha_china"` como novo tipo de módulo
- Atualizar `ModuloType` em `useModuloVinculos.ts` para incluir `"ficha_china"`
- Exibir badges dos vínculos existentes com `VinculoProjetoBadges`

#### 2. Controle de Visibilidade — Usuários Autorizados
- Criar tabela `china_ficha_visibilidade` com colunas: `id`, `submissao_id`, `user_id`, `concedido_por`, `created_at`
- Na ficha, adicionar seção "Acesso e Visibilidade" com:
  - Lista de usuários com acesso (seletor de perfis do sistema)
  - Botão para adicionar/remover usuários autorizados
  - Badge mostrando quantidade de usuários com acesso

#### 3. Despachar Ficha para Usuários/Módulos
- Adicionar botão "Despachar Ficha" no header da página
- Ao clicar, abrir dialog que permite:
  - Selecionar módulo(s) de destino (usando `DESPACHO_MODULOS_PROCESSO`)
  - Selecionar usuário(s) responsável(is) com permissão na tela
  - Adicionar observação/instrução
- O despacho gera um evento na timeline do processo (`process_events`) com tipo `ficha_despachada`
- O despacho também cria registro na tabela de visibilidade automaticamente

#### 4. Migração de Banco de Dados
- Criar tabela `china_ficha_visibilidade` com RLS
- Adicionar `"ficha_china"` como valor válido no enum/check do campo `modulo` da tabela `modulo_projeto_vinculos` (se necessário)

### Arquivos a Modificar
- `src/pages/ChinaFichaProduto.tsx` — Adicionar botões de vincular e despachar, seção de visibilidade
- `src/hooks/useModuloVinculos.ts` — Adicionar `"ficha_china"` ao `ModuloType`
- **Novo**: `src/hooks/useChinaFichaVisibilidade.ts` — Hook para gerenciar visibilidade
- **Novo**: `src/components/china/DespachoFichaDialog.tsx` — Dialog de despacho da ficha
- **Nova migração**: Tabela `china_ficha_visibilidade`

