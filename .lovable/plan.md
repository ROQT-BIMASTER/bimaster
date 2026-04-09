

# Liberar Acesso Completo de Luana ao Módulo Projetos

## Situação

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

Luana (l.bazilio@rubyrose.com.br) já tem o módulo e 5 das 7 telas de Projetos. Faltam **Minha Equipe** e **Minhas Tarefas**.

Quanto à visibilidade de projetos: o sistema já filtra automaticamente via `user_can_access_projeto` — ela verá apenas projetos onde é criadora, membro ou do seu departamento. Nenhuma alteração de código é necessária.

## Plano

### Migration SQL — Inserir 2 permissões de tela faltantes

```sql
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id) VALUES
  ('2f3df7bd-7db9-404a-8093-d80168ceab70', 'eadcbfaa-dd1e-44e5-a95b-b86d9a8d5e7f'), -- Minha Equipe
  ('2f3df7bd-7db9-404a-8093-d80168ceab70', '984261c0-c331-4815-9f6e-16e2d6452ace')  -- Minhas Tarefas
ON CONFLICT DO NOTHING;
```

| Componente | Tipo |
|-----------|------|
| Insert SQL (2 permissões de tela) | Dados |

