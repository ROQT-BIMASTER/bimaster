

## Diagnóstico: Fábrica China aparecendo para departamentos não autorizados

### Causa Raiz

A tabela `departamento_permissoes_modulos` concede o módulo `china` a **3 departamentos**:

| Departamento | Deveria ter? |
|---|---|
| Fábrica China | Depende da decisão |
| Projetos | Depende da decisão |
| **Compras e Faturamento** | **NÃO** |

Além disso, `departamento_permissoes_telas` concede todas as telas China (dashboard, submissões, recebimentos, ordens, fichas) ao departamento "Compras e Faturamento".

A função `get_all_user_permissions` agrega permissões por **role + departamento + individual**, então o usuário "Compras" herda acesso ao módulo China via departamento.

### Solução

Executar migration SQL para:

1. **Remover** o módulo `china` de `departamento_permissoes_modulos` para **todos** os departamentos (já que admins têm acesso automático a tudo)
2. **Remover** todas as telas `china_*` de `departamento_permissoes_telas` para os departamentos que não devem ter acesso
3. Também remover as telas china do `role_permissoes_telas` para roles que não deveriam ver (se houver)

### Impacto

- **Admins**: Continuam vendo tudo (o código já retorna todos os módulos para admin)
- **Departamento Fábrica China**: Perderá acesso via departamento. Se for necessário manter, precisará de permissões individuais por usuário
- **Compras e Faturamento**: Perderá acesso ao módulo China (correto)
- **Projetos**: Perderá acesso ao módulo China via departamento

### Arquivos

| Arquivo | Ação |
|---|---|
| 1 migration SQL | DELETE de `departamento_permissoes_modulos` e `departamento_permissoes_telas` para china |

