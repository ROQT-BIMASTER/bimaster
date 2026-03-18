

# Plano: Restringir Acesso ao Módulo Tabelas de Preço

## Problema Identificado

O módulo `precos` está sendo concedido por **permissão de role** para os papéis `supervisor` e `gerente` na tabela `role_permissoes_modulos`. Isso significa que **todos os 4 supervisores e 6 gerentes** recebem acesso automaticamente ao módulo de Tabelas de Preço, mesmo que não devam ter.

A regra correta do sistema é: **módulo sem configuração individual deve ficar bloqueado**.

### Dados atuais de acesso ao módulo `precos`:
- **Por role**: admin (2), supervisor (4), gerente (6) — todos recebem acesso
- **Por departamento**: Comercial (0 usuários atualmente)
- **Individual**: F. Cazarotti, Lucas Machado, Ricardo Flausino, Erika, Ahmad (5 usuários)

## Solução

### Passo 1 — Remover permissão de role para `precos`
Remover as entradas em `role_permissoes_modulos` que concedem `precos` para `supervisor` e `gerente`. Admins continuam com acesso total (via lógica `isAdmin`).

### Passo 2 — Remover permissão de departamento para `precos`
Remover a entrada em `departamento_permissoes_modulos` que concede `precos` ao departamento Comercial (atualmente sem usuários, mas previne acessos futuros indevidos).

### Passo 3 — Manter permissões individuais
Os 5 usuários com permissão individual (`usuario_permissoes_modulos`) continuam com acesso — esses foram configurados intencionalmente.

### Resultado esperado
Após a mudança, apenas terão acesso ao módulo `precos`:
- **Admins** (via lógica isAdmin no código)
- **5 usuários individuais** já configurados (F. Cazarotti, Lucas Machado, Ricardo Flausino, Erika, Ahmad)

### Impacto
- **Zero** alterações de código — a lógica de `hasModulePermission`, `showModule`, `ModuleRoute` e `ScreenRoute` já funciona corretamente
- Apenas remoção de registros no banco que estão concedendo acesso amplo indevido
- As rotas `/dashboard/precos/*` já estão protegidas por `ModuleRoute` e `ScreenRoute`
- A sidebar já filtra via `showModule` → `hasModulePermission`

### Migração SQL
```sql
-- Remover permissão de role para precos (supervisor e gerente)
DELETE FROM role_permissoes_modulos 
WHERE modulo_id = (SELECT id FROM modulos_sistema WHERE codigo = 'precos')
  AND role IN ('supervisor', 'gerente');

-- Remover permissão de departamento para precos
DELETE FROM departamento_permissoes_modulos
WHERE modulo_id = (SELECT id FROM modulos_sistema WHERE codigo = 'precos');
```

