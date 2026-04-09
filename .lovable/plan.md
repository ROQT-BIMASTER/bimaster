

# Liberar Acesso a Contas a Receber e Fluxo de Caixa

## Situação

| Usuário | Módulo Financeiro | Contas a Receber | Fluxo de Caixa |
|---------|:-:|:-:|:-:|
| Ahmad | ✅ | ❌ | ❌ |
| Viviane Rocha | ✅ | ❌ | ❌ |
| F. Cazarotti | ✅ | ❌ | ❌ |

Todos já têm permissão ao módulo Financeiro. Faltam apenas as permissões às **telas**.

## Plano

### Migration SQL — Inserir permissões de tela

Inserir 6 registros na tabela `usuario_permissoes_telas`:

```sql
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id) VALUES
  -- Ahmad: Contas a Receber + Fluxo de Caixa
  ('c534168c-db4f-493c-b42c-77c8b0b4c1db', '31e16630-4219-4fec-a714-49defe3cecda'),
  ('c534168c-db4f-493c-b42c-77c8b0b4c1db', '976dd998-33e7-4b3f-a3f2-b09c6811fcf2'),
  -- Viviane Rocha
  ('2dab08c5-d528-4b6f-abb3-4b5b97e88479', '31e16630-4219-4fec-a714-49defe3cecda'),
  ('2dab08c5-d528-4b6f-abb3-4b5b97e88479', '976dd998-33e7-4b3f-a3f2-b09c6811fcf2'),
  -- F. Cazarotti
  ('a908ebc1-ebf6-484e-94b6-ab1df1d288c5', '31e16630-4219-4fec-a714-49defe3cecda'),
  ('a908ebc1-ebf6-484e-94b6-ab1df1d288c5', '976dd998-33e7-4b3f-a3f2-b09c6811fcf2')
ON CONFLICT DO NOTHING;
```

Nenhuma alteração de código necessária.

| Componente | Tipo |
|-----------|------|
| Migration SQL (insert permissões) | Novo |

