

# Auditoria de Configuracoes de Perfil de Usuarios — Falhas e Melhorias

## Falhas Encontradas

### 1. Bug no GerenciamentoPermissoesTelas — variavel `selectedUser` usada antes da declaracao

Linha 212: `selectedUser?.nome` e usado dentro de `handleSave()` (linha 171), mas `selectedUser` e declarado na linha 234. Em JavaScript isso funciona por hoisting de `const` (retorna `undefined` antes da atribuicao), mas na pratica o audit log registra "Usuario" em vez do nome real. **Bug funcional silencioso.**

### 2. Pagina Configuracoes monolitica — 570 linhas, 20+ abas

A pagina `Configuracoes.tsx` importa 35 componentes e renderiza 20 abas em um unico componente. Problemas:
- **Performance**: todos os componentes sao importados eagerly, mesmo que o usuario so acesse 1-2 abas
- **UX**: a TabsList com 20 triggers transborda e e dificil de navegar
- **Manutencao**: qualquer erro em um import quebra toda a pagina

### 3. GerenciamentoUsuarios — dialog compartilhado para criar e editar com estado misturado

O mesmo `Dialog` e usado para criar e editar. Ao clicar "Novo Usuario" sem fechar uma edicao anterior, o `editingUser` pode permanecer setado, causando edicao em vez de criacao. O `onClick={() => setEditingUser(null)}` no `DialogTrigger` tenta resolver, mas o timing do evento pode falhar.

### 4. GerenciamentoUsuarios — validacao de senha inconsistente

Na criacao, `userSchema` exige senha obrigatoria com regex. Na edicao (`handleSaveEdit`), a validacao e manual (linhas 318-329) e nao usa o schema — verifica apenas `length >= 8` mas ignora a regex de maiusculas/minusculas/numeros. Um admin pode definir uma senha fraca na edicao.

### 5. GerenciamentoUsuarios — delete de perfil nao deleta auth.user

`handleDeleteUser` (linha 360) deleta apenas o registro em `profiles`, mas nao remove o usuario de `auth.users`. O usuario "fantasma" continua existindo na autenticacao e pode fazer login sem perfil, causando erros.

### 6. PermissoesDeAcesso — falta role "gerente"

A grid de permissoes por role so mostra Supervisor/Vendedor/Promotor. O role "gerente" existe no sistema (usado em HierarquiaUsuarios e GerenciamentoUsuarios) mas nao tem coluna para configuracao de permissoes de tela.

### 7. GerenciamentoPermissoesModulos — falta role "gerente"

Mesmo problema: so lista `["supervisor", "vendedor", "promotor"]` na aba "Por Funcao". Gerentes ficam sem permissoes de modulo configuradas por role.

### 8. EditarPerfil — campo departamento e texto livre mas deveria ser vinculado

O campo `departamento` no `EditarPerfil` mostra o valor de `profiles.departamento` (string livre), mas o sistema real usa `departamento_id` (UUID referenciando `departamentos`). Sao dois campos desconectados — o usuario ve um dado desatualizado.

### 9. Tabs com muitas abas — sem scroll horizontal visivel

A TabsList com 20 triggers usa `flex-wrap`, criando multiplas linhas que empurram o conteudo para baixo. Em viewports menores, as abas ficam comprimidas e ilegíveis.

### 10. GerenciamentoPermissoesTelas — sem agrupamento por modulo

A lista de telas e linear sem separacao por modulo, dificultando encontrar telas especificas quando ha 50+ registradas.

## Plano de Correcao

### Fase 1 — Correcoes de bugs criticos

**1. Fix `selectedUser` em GerenciamentoPermissoesTelas:**
- Mover a declaracao `const selectedUser = usuarios.find(...)` para ANTES de `handleSave`
- Ou capturar o nome dentro do callback

**2. Fix validacao de senha na edicao em GerenciamentoUsuarios:**
- Criar schema parcial para edicao que usa a mesma regex do `userSchema` mas com senha opcional
- Aplicar `userSchema.shape.senha.parse()` quando senha preenchida

**3. Fix delete de usuario:**
- Chamar edge function `create-admin-users` (ou criar `delete-admin-user`) para remover de `auth.users` junto com `profiles`
- Adicionar dialog de confirmacao mais claro com nome do usuario

### Fase 2 — Adicionar role "gerente"

- Em `PermissoesDeAcesso`: adicionar coluna "Gerente" na grid
- Em `GerenciamentoPermissoesModulos`: adicionar "gerente" ao array de roles
- Garantir que gerentes existentes tenham permissoes configuradas

### Fase 3 — UX da pagina Configuracoes

**Reorganizar abas em categorias** com sub-navegacao:
- Substituir 20 abas por sidebar vertical com grupos: "Perfil", "Usuarios", "Permissoes", "Empresa", "Avancado"
- Usar lazy loading (`React.lazy`) para componentes pesados

**Fix campo departamento em EditarPerfil:**
- Mostrar o nome do departamento vinculado via `departamento_id` em vez do campo texto livre
- Manter como somente leitura (definido pelo admin)

### Fase 4 — GerenciamentoPermissoesTelas com agrupamento

- Agrupar telas por `modulo_codigo` com secoes colapsaveis
- Adicionar contador de permissoes ativas por modulo
- Botoes "Marcar todas do modulo" / "Desmarcar todas"

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/components/configuracoes/GerenciamentoPermissoesTelas.tsx` | Fix hoisting bug + agrupamento por modulo |
| `src/components/configuracoes/GerenciamentoUsuarios.tsx` | Fix validacao senha + delete auth.user |
| `src/components/configuracoes/PermissoesDeAcesso.tsx` | Adicionar coluna "Gerente" |
| `src/components/configuracoes/GerenciamentoPermissoesModulos.tsx` | Adicionar role "gerente" |
| `src/components/configuracoes/EditarPerfil.tsx` | Fix campo departamento |
| `src/pages/Configuracoes.tsx` | Reorganizar layout com sidebar vertical + lazy loading |

