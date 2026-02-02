

# Restringir Contas a Pagar para Fabio e Carlos

## Situacao Atual

### Usuarios que PODEM acessar a tela hoje

| Fonte de Permissao | Usuarios Afetados |
|-------------------|-------------------|
| Role vendedor | TODOS os vendedores (configuraçao global) |
| Departamento Financeiro | Leandro Ramos, C. Guimarães, F. Cazarotti |
| Permissao Individual | Erika, Leandro Ramos, F. Cazarotti, Lucas Machado, Juliana Germinhasi, Administrador Sistema, C. Guimarães |
| Admin (automatico) | Leandro Moraes Ramos |

### Usuarios DESEJADOS

| Usuario | Email | ID |
|---------|-------|-----|
| F. Cazarotti (Fabio) | f.cazarotti@rubyrosemaquiagem.com.br | a908ebc1-ebf6-484e-94b6-ab1df1d288c5 |
| C. Guimarães (Carlos) | c.guimaraes@distribuidoraunion.com.br | 44d455eb-244a-44b5-bc7b-c8e4c929374a |
| Leandro Moraes Ramos (Admin) | leandro.moraesramos@gmail.com | Acesso automatico |

## Acoes Necessarias

### 1. Remover permissao do Role Vendedor

Remover a tela `financeiro_contas_pagar` das permissoes do role vendedor.

```text
DELETE FROM role_permissoes_telas
WHERE role = 'vendedor'
AND tela_id = '595c320f-bb86-4ee5-b42a-848d8770b191';
```

### 2. Remover permissao do Departamento Financeiro

Mesmo que Fabio e Carlos estejam no Financeiro, remover a permissao do departamento para ter controle granular.

```text
DELETE FROM departamento_permissoes_telas
WHERE departamento_id = 'ed8fe145-0639-4d00-ac52-02c83f4f9652'
AND tela_id = '595c320f-bb86-4ee5-b42a-848d8770b191';
```

### 3. Remover TODAS as permissoes individuais dessa tela

Limpar todas as permissoes individuais existentes.

```text
DELETE FROM usuario_permissoes_telas
WHERE tela_id = '595c320f-bb86-4ee5-b42a-848d8770b191';
```

### 4. Adicionar permissao APENAS para Fabio e Carlos

```text
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
VALUES 
  ('a908ebc1-ebf6-484e-94b6-ab1df1d288c5', '595c320f-bb86-4ee5-b42a-848d8770b191'),
  ('44d455eb-244a-44b5-bc7b-c8e4c929374a', '595c320f-bb86-4ee5-b42a-848d8770b191');
```

## Resultado Final

| Usuario | Acesso a Contas a Pagar |
|---------|------------------------|
| F. Cazarotti (Fabio) | SIM (permissao individual) |
| C. Guimarães (Carlos) | SIM (permissao individual) |
| Leandro Moraes Ramos | SIM (admin automatico) |
| Todos os outros | NAO |

## Impacto

### Usuarios que PERDERAO acesso

| Usuario | Tinha Acesso Via |
|---------|------------------|
| Leandro Ramos | Departamento Financeiro |
| Erika | Permissao Individual |
| Lucas Machado | Permissao Individual |
| Juliana Germinhasi | Permissao Individual |
| Administrador Sistema | Permissao Individual |
| Todos os vendedores | Role vendedor |

## Seguranca

A restricao sera aplicada em duas camadas:

| Camada | Componente | Verificacao |
|--------|------------|-------------|
| Frontend | ScreenProtectedRoute | Bloqueia navegacao, exibe "Acesso Negado" |
| Backend | Funcao get_all_user_permissions | Nao retorna a tela na lista de permissoes |

## Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| Nova migration SQL | Executa as 4 queries acima em uma transacao |

## Observacao Importante

O admin (Leandro Moraes Ramos) continuara tendo acesso automatico a todas as telas, incluindo Contas a Pagar. Isso e comportamento esperado do sistema.

