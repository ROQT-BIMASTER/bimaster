# Liberar o Suporte TI como administrador

## O que está acontecendo

A conta **Suporte TI** (suporte_t.i@distribuidoraunion.com.br) já está marcada como administrador no cadastro — mas ela também tem o papel de gerente, e o sistema, ao montar as permissões da tela, escolhe **um** papel sem critério de prioridade. Hoje ele está escolhendo "gerente", então o acesso total de administrador nunca é aplicado.

Verificado no banco: a conta tem os papéis "gerente" e "admin"; o cálculo de permissões devolve "gerente". Ela também não está na lista de administradores com escopo limitado, ou seja, deveria ter acesso completo.

Consequência prática: hoje ela enxerga 11 dos 39 módulos e 72 das 217 telas (faltam, entre outros, Financeiro, Compras, Estoque, Comercial, Cadastros, Marketing, Relatórios, Processos, Integração ERP).

## O que será feito

1. Corrigir a regra de cálculo de permissões para sempre priorizar o papel mais alto quando a pessoa tem mais de um (administrador acima de gerente, e assim por diante). Isso conserta o Suporte TI e qualquer outra conta na mesma situação.
2. Remover o papel duplicado de gerente da conta Suporte TI, deixando apenas administrador, para não manter ambiguidade no cadastro.
3. Conferir depois da mudança que a conta passa a receber os 39 módulos e as 217 telas ativas.

Nada muda para os demais usuários que têm um único papel.

## Detalhes técnicos

- `public.get_all_user_permissions(p_user_id)`: o `SELECT ur.role ... LIMIT 1` é não determinístico. Substituir por ordenação explícita de precedência (`ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'gerente' THEN 2 WHEN 'supervisor' THEN 3 ... END`), mantendo o resto do corpo idêntico (escopo limitado, negações, permissões de departamento/role/usuário).
- Auditar as demais funções que derivam papel único com `LIMIT 1` sem `ORDER BY` (ex.: fallbacks de permissão) e aplicar a mesma precedência onde couber.
- `DELETE FROM public.user_roles WHERE user_id = '58802863-...' AND role = 'gerente'` na mesma migração.
- O front (`PermissionsContext`) não muda; apenas é preciso lembrar que existe cache local de permissões — a conta precisa recarregar a aplicação (ou aguardar a revalidação) para ver o novo acesso.
