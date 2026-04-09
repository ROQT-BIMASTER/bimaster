

# Liberar Acesso Completo de Claudia ao Módulo Projetos

## Situação

**Claudia Tiemi Nakano** (c.nakano@rubyrose.com.br)

| Recurso | Status |
|---------|--------|
| Módulo Projetos | ✅ Já possui |
| Dashboard Projetos | ✅ |
| Inbox | ✅ |
| Aprovações de Cadastro | ✅ |
| Vincular China | ✅ |
| Produtos Brasil | ✅ |
| **Minha Equipe** | ❌ Falta |
| **Minhas Tarefas** | ❌ Falta |

A visibilidade de projetos já é filtrada automaticamente via `user_can_access_projeto` — ela verá apenas projetos onde é membro, criadora ou do seu departamento.

## Plano

### Insert SQL — 2 permissões de tela faltantes

```sql
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id) VALUES
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', 'eadcbfaa-dd1e-44e5-a95b-b86d9a8d5e7f'), -- Minha Equipe
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', '984261c0-c331-4815-9f6e-16e2d6452ace')  -- Minhas Tarefas
ON CONFLICT DO NOTHING;
```

Nenhuma alteração de código necessária.

| Componente | Tipo |
|-----------|------|
| Insert SQL (2 permissões de tela) | Dados |

