## Objetivo

Conceder à equipe da Luana (18 subordinados diretos) acesso ao módulo **Projetos** e às 4 telas exibidas na imagem:

| Tela na sidebar | Código no sistema |
|---|---|
| Caixa de Entrada | `projetos_inbox` |
| Central de Aprovações | `projetos_aprovacoes` |
| Central de Trabalho | `projetos_home` |
| Meus Projetos | `projetos_dashboard` |

## Equipe identificada (supervisor_id = Luana)

18 usuários: Ahmad, Claudia Nakano, Daniele Silva, Debora Novaes, Gabriela Rocha, Giovanna Silva, Giulia Honda, Ingrid Lima, Isabella Moraes, Janaine Freitas, Julia Dario, Leticia Leite, Natasha Lima, Nathalia Piovani, Sabrina Martins, Saynara Freitas, Thais Moraes, Victoria Guarita.

Estado atual: apenas 5 já possuem o módulo Projetos liberado. Os outros 13 não possuem nem o módulo, nem as 4 telas.

## Implementação

Migration única e idempotente (`INSERT ... ON CONFLICT DO NOTHING`):

1. **Liberar módulo Projetos** para todos os 18 usuários em `usuario_permissoes_modulos`.
2. **Liberar as 4 telas** (`projetos_inbox`, `projetos_aprovacoes`, `projetos_home`, `projetos_dashboard`) para todos os 18 em `usuario_permissoes_telas`.

A seleção dos usuários será feita por `supervisor_id = '<Luana>'` para que a migration seja resiliente (se entrar/sair alguém da equipe antes do deploy, a lista se ajusta sozinha).

## Detalhes técnicos

```sql
-- Módulo
INSERT INTO usuario_permissoes_modulos (usuario_id, modulo_id)
SELECT p.id, (SELECT id FROM modulos_sistema WHERE codigo='projetos')
FROM profiles p
WHERE p.supervisor_id = '2f3df7bd-7db9-404a-8093-d80168ceab70'
ON CONFLICT DO NOTHING;

-- Telas (cross join 18 × 4)
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
SELECT p.id, t.id
FROM profiles p
CROSS JOIN telas_sistema t
WHERE p.supervisor_id = '2f3df7bd-7db9-404a-8093-d80168ceab70'
  AND t.codigo IN ('projetos_inbox','projetos_aprovacoes','projetos_home','projetos_dashboard')
ON CONFLICT DO NOTHING;
```

Sem alterações de RLS, código ou UI. Após o deploy, a equipe verá imediatamente o módulo "Projetos" na sidebar com as 4 telas listadas.

## Observação

A imagem mostra apenas essas 4 telas. Telas extras (Vincular China, Produtos Brasil, Minha Equipe, Minhas Tarefas, Modelos, Relatórios) **não** serão liberadas — se quiser incluir alguma, é só pedir.
