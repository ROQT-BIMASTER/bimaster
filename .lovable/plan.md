

# Plano: Proteger chaves de API do ERP contra leitura não autorizada

## Problema

A policy `Authenticated users can read erp_config` permite que **qualquer** usuário autenticado leia todas as colunas da tabela `erp_config`, incluindo `api_key`, `api_key_hash` e `api_key_anterior`. Isso expõe credenciais sensíveis.

## Solução

Criar uma **view segura** que oculta os campos sensíveis e restringir o acesso direto à tabela apenas a admins.

## Alterações (Migration SQL)

1. **Criar view `erp_config_safe`** com `security_invoker=on` — exclui `api_key`, `api_key_hash`, `api_key_anterior`
2. **Remover a policy permissiva** `Authenticated users can read erp_config`
3. **Criar nova policy restritiva** de SELECT na tabela base — apenas admins (`has_role(auth.uid(), 'admin')`)
4. **Atualizar código frontend** que lê `erp_config` para usar a view `erp_config_safe` onde não precisa da chave, e manter acesso direto apenas nas telas admin que gerenciam chaves

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| Migration SQL | View + policies |
| Código frontend que consulta `erp_config` | Trocar para `erp_config_safe` em contextos não-admin |

