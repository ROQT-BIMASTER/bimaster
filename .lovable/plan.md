
# Corrigir Validacao do Tipo de Usuario "Gerente"

## Problema

O formulario de criacao de usuario permite selecionar "Gerente" no dropdown, mas a validacao Zod em `src/lib/validations/user.ts` nao inclui "gerente" como valor valido. Isso causa o erro de validacao ao clicar em "Criar Usuario".

## Causa Raiz

O enum no schema Zod so aceita: `admin`, `supervisor`, `vendedor`, `promotor`, `cliente`. O valor `gerente` foi adicionado ao formulario e a hierarquia do sistema, mas nao foi atualizado no schema de validacao.

## Solucao

Adicionar "gerente" ao enum `tipo_usuario` no schema Zod.

## Detalhes Tecnicos

### Arquivo modificado
- `src/lib/validations/user.ts`

### Alteracao
Linha 22 - adicionar "gerente" ao enum:

```typescript
// De:
tipo_usuario: z.enum(["admin", "supervisor", "vendedor", "promotor", "cliente"], {

// Para:
tipo_usuario: z.enum(["admin", "gerente", "supervisor", "vendedor", "promotor", "cliente"], {
```

### Impacto em Seguranca
- Nenhum impacto negativo. O valor "gerente" ja existe no banco de dados (enum `app_role`) e ja e utilizado em todo o sistema (hierarquia, RLS, hooks).
- A validacao Zod estava apenas desatualizada em relacao ao restante do sistema.
