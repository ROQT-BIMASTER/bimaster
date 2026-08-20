# Atualizar ERP_SQL_PASSWORD e revalidar o sync de estoque

## O que será feito

1. **Formulário seguro de secret**
   Abrir o formulário de atualização de secret para `ERP_SQL_PASSWORD`. O valor é digitado direto no formulário e salvo cifrado — nunca passa pelo chat nem pelo código.

2. **Redeploy do `erp-sync-engine`**
   Reimplantar a função para que ela recarregue o novo valor do secret no ambiente de execução.

3. **Disparar a carga de estoque**
   `POST /erp-sync-engine` com body `{"path":"sync-estoque-live"}`.
   Esperado: `success: true`, ~2.700–3.000 linhas, `empresas: [6,9,10,11]`.

4. **Validar no banco**
   ```sql
   SELECT MAX(sincronizado_em) FROM public.erp_estoque_live;
   SELECT empresa, count(*) AS produtos, sum(estoque_disponivel) AS saldo
   FROM public.erp_estoque_live GROUP BY empresa ORDER BY empresa;
   ```
   O timestamp deve ser do momento da execução e devem aparecer as 4 filiais.

5. **Relatório**
   Retorno completo do passo 3 e os resultados das consultas do passo 4. Se a chamada falhar com erro de autenticação no ERP, aviso imediato de que a senha salva não foi aceita (sem expor o valor).

## Observações técnicas

- Nenhum arquivo de código é alterado; apenas redeploy da função existente e execução de rotina já implantada.
- Nenhuma migration é aplicada. As consultas de validação são somente leitura.
- Os crons `sync-estoque-live-horario` e `ipaper-push-horario` seguem inalterados e voltam a rodar normalmente com o novo secret.
