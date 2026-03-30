

# Auditoria Final de Configuracoes — Falhas e Melhorias

## Problemas Encontrados

### 1. DOM nesting error — `<button>` dentro de `<button>` (BUG ATIVO no console)

Em `GerenciamentoPermissoesTelas.tsx` linha 338-349, o `CollapsibleTrigger` renderiza como `<button>`, e dentro dele ha dois `<button>` nativos ("Todas" / "Nenhuma"). Isso causa o warning `validateDOMNesting` visivel no console e pode causar comportamento inconsistente de cliques em alguns browsers.

**Correcao**: Mover os botoes "Todas"/"Nenhuma" para FORA do `CollapsibleTrigger`, ao lado dele no mesmo container flex.

### 2. Permissoes de Modulos — toggle com logica ambigua no modo heranca

Em `GerenciamentoPermissoesModulos.tsx` linha 365-368, quando o usuario esta em modo heranca (sem overrides), o Switch mostra `checked={isActive}` (vindo de role/dept) mas `onCheckedChange` chama `toggleUserPermission(selectedUser, module.id, hasIndividual)`. Como `hasIndividual` e `false`, o toggle sempre INSERE um registro individual. Porem, o usuario ve o toggle como "ligado" (via role) e ao clicar espera "desligar", mas na verdade vai CRIAR um override individual para esse modulo — sem criar overrides para os outros modulos que ele tem via role. Resultado: o usuario perde acesso a TODOS os outros modulos que vinham do role, ficando apenas com esse unico modulo.

**Correcao**: Ao entrar em modo override pela primeira vez, copiar TODAS as permissoes atuais do role+dept como base individual, e entao aplicar o toggle. Adicionar confirmacao visual antes de converter para modo override.

### 3. Mesmo problema em Permissoes de Telas

Em `GerenciamentoPermissoesTelas.tsx`, o checkbox altera `userPermissions` (Set local) mas se o usuario esta em modo heranca e marca/desmarca uma unica tela, ao salvar, APENAS aquela tela ficara como override — perdendo todas as outras que vinham do role. O usuario precisa marcar TODAS as telas que deseja antes de salvar.

**Correcao**: Ao iniciar edicao de um usuario em modo heranca, pre-popular o Set `userPermissions` com as telas efetivas (role+dept) para que o usuario edite a partir do estado real. Adicionar aviso quando passando de heranca para override.

### 4. Configuracoes.tsx — query redundante a `user_roles` (nao corrigido na implementacao anterior)

Linhas 106-112 ainda fazem query manual a `user_roles` em vez de usar `usePermissions().role`. O plano anterior pedia essa correcao mas nao foi aplicado.

**Correcao**: Substituir pela prop `role` do `usePermissions()`.

### 5. GerenciamentoUsuarios — `confirm()` nativo para delete

Linha 375 usa `window.confirm()` que e bloqueante e nao segue o design system. Outros componentes ja usam `AlertDialog`.

**Correcao**: Substituir por `AlertDialog` do Radix.

### 6. GerenciamentoUsuarios — tabela sem paginacao

Com muitos usuarios, a tabela renderiza tudo de uma vez. Sem virtualizacao nem paginacao.

**Correcao**: Adicionar paginacao simples (20 por pagina) com controles prev/next.

### 7. Tooltip badges dentro de TooltipTrigger sem asChild

Em `GerenciamentoPermissoesModulos.tsx` linhas 346-347, o `TooltipTrigger` envolve um `Badge` diretamente. Se o Badge nao aceita `ref`, o tooltip pode nao funcionar. Deveria usar `asChild` ou envolver em `<span>`.

**Correcao**: Adicionar wrapper `<span>` dentro de `TooltipTrigger` ou usar `asChild`.

## Plano de Correcao

### Fase 1 — Bugs criticos (afetam funcionalidade)

1. **GerenciamentoPermissoesTelas**: Mover botoes "Todas/Nenhuma" para fora do `CollapsibleTrigger` (fix DOM nesting)
2. **GerenciamentoPermissoesModulos**: Ao primeiro toggle em modo heranca, copiar permissoes efetivas (role+dept) como base individual antes de aplicar a mudanca
3. **GerenciamentoPermissoesTelas**: Pre-popular `userPermissions` com telas efetivas ao selecionar usuario em modo heranca; mostrar dialog de confirmacao ao converter para override

### Fase 2 — Consistencia

4. **Configuracoes.tsx**: Usar `usePermissions()` para role em vez de query manual
5. **GerenciamentoUsuarios**: Substituir `confirm()` por `AlertDialog`
6. **TooltipTrigger badges**: Adicionar `asChild` ou `<span>` wrapper

### Fase 3 — UX

7. **GerenciamentoUsuarios**: Paginacao de 20 registros por pagina

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/components/configuracoes/GerenciamentoPermissoesTelas.tsx` | Fix DOM nesting; pre-popular permissoes em modo heranca |
| `src/components/configuracoes/GerenciamentoPermissoesModulos.tsx` | Copiar base ao entrar em override; fix tooltip wrappers |
| `src/pages/Configuracoes.tsx` | Usar usePermissions() para role |
| `src/components/configuracoes/GerenciamentoUsuarios.tsx` | AlertDialog para delete; paginacao |

