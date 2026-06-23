# ORPHAN ROUTES — snapshot gerado

> Gerado por `scripts/audit/orphan-routes-triage.mjs`. Não editar à mão.
> Manualmente reclassifique via `scripts/audit/orphan-routes-exclusions.json`.

## Totais

- Rotas únicas em `src/App.tsx`: **359**
- Rotas ativas em `sidebar_menu_items`:  **167**
- **Órfãs (no roteador, ausentes do menu): 194**

| Bucket | Quantidade |
| --- | ---: |
| **A** — Public / auth (intencional fora do menu) | 27 |
| **B** — Child / wizard / detail (intencional fora do menu) | 92 |
| **C** — CRM nested (intencional fora do menu) | 6 |
| **D** — Admin / diagnóstico (cadastrar com require_admin) | 31 |
| **E** — Feature órfã real (cadastrar no módulo correto) | 38 |

## Bucket D — Admin / diagnóstico (cadastrar com require_admin)

| Rota | Linha | Guard | module_code | screen_code | Motivo |
| --- | ---: | --- | --- | --- | --- |
| `/admin/briefings-fluxos` | 790 | screen | — | admin | admin/diagnostic |
| `/admin/cofre-templates` | 792 | screen | — | admin | admin/diagnostic |
| `/admin/documentacao-tecnica` | 942 | screen | — | admin | admin/diagnostic |
| `/admin/integracoes-saude` | 943 | screen | — | admin | admin/diagnostic |
| `/admin/integracoes/google-drive` | 793 | screen | — | admin | admin/diagnostic |
| `/admin/suporte` | 794 | screen | — | admin | admin/diagnostic |
| `/admin/templates-alcadas` | 789 | screen | — | admin | admin/diagnostic |
| `/admin/versoes-clientes` | 791 | screen | — | admin | admin/diagnostic |
| `/dashboard/admin-api-support` | 941 | screen | — | admin | admin/diagnostic |
| `/dashboard/admin/alertas-backfill-tarefas` | 884 | module-screen | projetos | admin | admin/diagnostic |
| `/dashboard/admin/asana-importacao` | 949 | module-screen | financeiro | admin | admin/diagnostic |
| `/dashboard/admin/asana-sync` | 948 | module-screen | financeiro | admin | admin/diagnostic |
| `/dashboard/admin/checagem-semanal-tarefas` | 885 | module-screen | projetos | admin | admin/diagnostic |
| `/dashboard/admin/dedupe-perfis` | 950 | module-screen | financeiro | admin | admin/diagnostic |
| `/dashboard/admin/diagnostico-tarefas-data-conclusao` | 882 | screen | — | admin | admin/diagnostic |
| `/dashboard/admin/historico-backfill-tarefas` | 883 | module-screen | projetos | admin | admin/diagnostic |
| `/dashboard/admin/projetos-custos-tecnologia` | 905 | module-screen | oms | admin | admin/diagnostic |
| `/dashboard/admin/projetos-saude` | 894 | screen | — | admin | admin/diagnostic |
| `/dashboard/admin/relatorios-v2` | 585 | protected | — | — | admin/diagnostic |
| `/dashboard/admin/security/hardening` | 896 | screen | — | admin | admin/diagnostic |
| `/dashboard/admin/security/hardening-v2` | 897 | screen | — | admin | admin/diagnostic |
| `/dashboard/admin/security/security-definer` | 895 | screen | — | admin | admin/diagnostic |
| `/dashboard/admin/visibilidade-detalhe-tarefa` | 900 | module-screen | projetos | admin | admin/diagnostic |
| `/dashboard/configuracoes/api-health` | 927 | screen | — | admin | admin/diagnostic |
| `/dashboard/configuracoes/fornecedores-visibilidade` | 953 | module-screen | financeiro | admin | admin/diagnostic |
| `/dashboard/configuracoes/permissoes-modulo` | 929 | screen | — | admin | admin/diagnostic |
| `/dashboard/preferencias-ui` | 570 | crm-admin | crm | — | admin/diagnostic |
| `/dashboard/security-explorer` | 935 | screen | — | admin | admin/diagnostic |
| `/dashboard/security/mfa` | 898 | screen | — | admin | admin/diagnostic |
| `/dashboard/seguranca-dashboard` | 934 | screen | — | admin | admin/diagnostic |
| `/dashboard/trilha-auditoria-acessos` | 936 | screen | — | admin | admin/diagnostic |

## Bucket E — Feature órfã real (cadastrar no módulo correto)

| Rota | Linha | Guard | module_code | screen_code | Motivo |
| --- | ---: | --- | --- | --- | --- |
| `/configuracoes/integracoes/notion` | 945 | screen | — | admin | feature órfã real |
| `/dashboard/ajuda/projetos-visibilidade` | 901 | module-screen | projetos | projetos_dashboard | feature órfã real |
| `/dashboard/bancos` | 958 | module-screen | financeiro | financeiro_contas_bancarias | feature órfã real |
| `/dashboard/briefings` | 590 | protected | — | — | feature órfã real |
| `/dashboard/central/amostras` | 877 | module-screen | projetos | projetos_minhas_tarefas | feature órfã real |
| `/dashboard/central/aprovacoes` | 872 | module-screen | projetos | projetos_aprovacoes_central | feature órfã real |
| `/dashboard/central/composicao` | 875 | module | projetos | — | feature órfã real |
| `/dashboard/central/embalagens` | 876 | module-screen | projetos | projetos_minhas_tarefas | feature órfã real |
| `/dashboard/central/motor-artes` | 874 | public | — | — | feature órfã real |
| `/dashboard/chat` | 618 | module-screen | comercial | admin | feature órfã real |
| `/dashboard/chat/aprovacoes` | 619 | module-screen | comercial | admin | feature órfã real |
| `/dashboard/compras-internacionais` | 738 | module-screen | china | compras_inbox_comprador | feature órfã real |
| `/dashboard/compras-internacionais/inbox` | 739 | module-screen | china | compras_inbox_comprador | feature órfã real |
| `/dashboard/compras-nacionais` | 740 | module-screen | fabrica | ci_executivo | feature órfã real |
| `/dashboard/configuracoes` | 620 | module-screen | comercial | admin | feature órfã real |
| `/dashboard/contas-a-pagar` | 917 | screen | — | financeiro_contas_pagar | feature órfã real |
| `/dashboard/contas-pagar` | 957 | module-screen | financeiro | financeiro_contas_pagar_gestao | feature órfã real |
| `/dashboard/controladoria` | 592 | protected | — | — | feature órfã real |
| `/dashboard/crm` | 572 | crm-admin | crm | — | feature órfã real |
| `/dashboard/departamentos` | 683 | module-screen | departamentos | departamentos_hub | feature órfã real |
| `/dashboard/departamentos/aprovacoes` | 687 | module-screen | departamentos | departamentos_aprovacoes | feature órfã real |
| `/dashboard/design-studio` | 601 | module | marketing | — | feature órfã real |
| `/dashboard/fornecedor` | 746 | module-screen | fornecedor | fornecedor_vendas | feature órfã real |
| `/dashboard/importar-clientes` | 621 | module-screen | comercial | comercial_importar | feature órfã real |
| `/dashboard/integracoes/asana` | 944 | screen | — | admin | feature órfã real |
| `/dashboard/integracoes/notion` | 946 | screen | — | admin | feature órfã real |
| `/dashboard/integracoes/shipsgo` | 947 | screen | — | admin | feature órfã real |
| `/dashboard/oms` | 908 | module-screen | oms | oms_painel | feature órfã real |
| `/dashboard/oms/condicoes-pagamento` | 910 | module-screen | oms | oms_condicoes | feature órfã real |
| `/dashboard/pagamentos` | 954 | module-screen | financeiro | financeiro_pagamentos | feature órfã real |
| `/dashboard/plano-contas` | 922 | screen | — | financeiro_plano_contas | feature órfã real |
| `/dashboard/processos/etapas-gerenciamento` | 971 | module | processos | — | feature órfã real |
| `/dashboard/processos/modulos-catalogo` | 972 | module | processos | — | feature órfã real |
| `/dashboard/processos/perfis` | 969 | module | processos | — | feature órfã real |
| `/dashboard/relatorios` | 584 | screen | — | relatorios | feature órfã real |
| `/dashboard/rr-tasks` | 593 | module | marketing | — | feature órfã real |
| `/dashboard/simulacao` | 810 | module-screen | financeiro | admin | feature órfã real |
| `/dashboard/vendas/analise` | 744 | module-screen | fornecedor | fornecedor_vendas | feature órfã real |

## Bucket A — Public / auth (intencional fora do menu)

| Rota | Linha | Guard | module_code | screen_code | Motivo |
| --- | ---: | --- | --- | --- | --- |
| `*` | 995 | public | — | — | public/auth |
| `/` | 554 | public | — | — | public/auth |
| `/aguardando-aprovacao` | 559 | public | — | — | public/auth |
| `/auth/forgot-password` | 557 | public | — | — | public prefix |
| `/auth/login` | 555 | public | — | — | public prefix |
| `/auth/signup` | 556 | public | — | — | public prefix |
| `/cofre-share` | 984 | public | — | — | public/auth |
| `/contato` | 565 | protected | — | — | public/auth |
| `/formulario-dashboard` | 978 | module-screen | trade | trade_admin | public/auth |
| `/formulario-dinamico` | 977 | public | — | — | public/auth |
| `/formulario-equipe` | 976 | public | — | — | public/auth |
| `/home` | 993 | public | — | — | public/auth |
| `/index` | 991 | public | — | — | public/auth |
| `/index.html` | 992 | public | — | — | public/auth |
| `/meu-perfil` | 569 | crm-admin | crm | — | public/auth |
| `/not-found` | 989 | public | — | — | public/auth |
| `/painel/marketing/redes-sociais` | 862 | module | marketing | — | public prefix |
| `/politica-privacidade` | 985 | public | — | — | public/auth |
| `/portal` | 961 | cliente | — | — | public/auth |
| `/portal/perfil` | 963 | module-screen | processos | processos_consulta | public prefix |
| `/portal/precos` | 962 | cliente | — | — | public prefix |
| `/privacidade` | 563 | public | — | — | public/auth |
| `/reset-password` | 558 | public | — | — | public/auth |
| `/termos` | 564 | public | — | — | public/auth |
| `/termos-de-uso` | 986 | public | — | — | public/auth |
| `/unsubscribe` | 561 | public | — | — | public/auth |
| `/usuario-bloqueado` | 560 | public | — | — | public/auth |

## Bucket B — Child / wizard / detail (intencional fora do menu)

| Rota | Linha | Guard | module_code | screen_code | Motivo |
| --- | ---: | --- | --- | --- | --- |
| `/dashboard/admin/relatorios-v2/:reportId` | 587 | protected | — | — | wizard/detail |
| `/dashboard/admin/relatorios-v2/novo` | 586 | protected | — | — | wizard/detail |
| `/dashboard/briefings/:id` | 591 | protected | — | — | wizard/detail |
| `/dashboard/composicao/sync` | 846 | module-screen | financeiro | admin | wizard/detail |
| `/dashboard/configuracoes/permissoes-modulo/:moduleCode` | 930 | screen | — | admin | wizard/detail |
| `/dashboard/departamentos/:id` | 684 | module-screen | departamentos | departamentos_detail | wizard/detail |
| `/dashboard/departamentos/:id/aprovacoes` | 686 | module-screen | departamentos | departamentos_aprovacoes | wizard/detail |
| `/dashboard/departamentos/:id/dashboard` | 685 | module-screen | departamentos | departamentos_dashboard | wizard/detail |
| `/dashboard/estoque/fornecedor` | 750 | module-screen | central_inteligencia | ci_clientes | child of /dashboard/estoque |
| `/dashboard/estoque/fornecedor-depara` | 751 | module-screen | central_inteligencia | ci_clientes | child of /dashboard/estoque |
| `/dashboard/eventos/:id` | 679 | module-screen | eventos | eventos_lista | wizard/detail |
| `/dashboard/eventos/aprovacoes` | 678 | module-screen | eventos | eventos_aprovacoes | child of /dashboard/eventos |
| `/dashboard/fabrica-china/auditoria-normalizacao` | 721 | module-screen | china | china_dashboard | child of /dashboard/fabrica-china |
| `/dashboard/fabrica-china/caixa-entrada` | 720 | module-screen | china | china_dashboard | child of /dashboard/fabrica-china |
| `/dashboard/fabrica-china/nova/:submissaoId` | 723 | module-screen | china | china_submissoes | wizard/detail |
| `/dashboard/fabrica-china/ordens-producao` | 728 | module-screen | china | china_ordens | child of /dashboard/fabrica-china |
| `/dashboard/fabrica-china/ordens/:id` | 729 | module-screen | china | china_ordens | wizard/detail |
| `/dashboard/fabrica-china/patio-embarque` | 735 | module | china | — | child of /dashboard/fabrica-china |
| `/dashboard/fabrica-china/produto/:id` | 731 | module-screen | china | china_fichas | wizard/detail |
| `/dashboard/fabrica-china/produto/:id/checklist` | 732 | module-screen | china | china_fichas | wizard/detail |
| `/dashboard/fabrica-china/produto/:id/checklist-status` | 733 | module-screen | china | china_fichas | wizard/detail |
| `/dashboard/fabrica-china/recebimentos-oc` | 725 | module-screen | china | china_recebimentos | child of /dashboard/fabrica-china |
| `/dashboard/fabrica-china/recebimentos/divergencias` | 726 | module-screen | china | china_recebimentos | child of /dashboard/fabrica-china/recebimentos |
| `/dashboard/fabrica-china/submissao/:id` | 730 | module-screen | china | china_submissoes | wizard/detail |
| `/dashboard/fabrica-china/torre-containers` | 734 | module | china | — | child of /dashboard/fabrica-china |
| `/dashboard/fabrica/analises-custos` | 708 | module-screen | fabrica | fabrica_produtos | child of /dashboard/fabrica |
| `/dashboard/fabrica/analises-custos/:grupoId` | 707 | module-screen | fabrica | fabrica_produtos | wizard/detail |
| `/dashboard/fabrica/auditoria-fotos` | 709 | module-screen | fabrica | fabrica_produtos | child of /dashboard/fabrica |
| `/dashboard/fabrica/cenarios/:grupoId` | 706 | module-screen | fabrica | fabrica_produtos | wizard/detail |
| `/dashboard/fabrica/executivo` | 714 | module-screen | fabrica | fabrica_dashboard | child of /dashboard/fabrica |
| `/dashboard/fabrica/formulas/:id` | 695 | module-screen | fabrica | fabrica_formulas | wizard/detail |
| `/dashboard/fabrica/formulas/nova` | 694 | module-screen | fabrica | fabrica_formulas | child of /dashboard/fabrica/formulas |
| `/dashboard/fabrica/fornecedores` | 715 | module-screen | fabrica | fabrica_fornecedores | child of /dashboard/fabrica |
| `/dashboard/fabrica/manual` | 716 | module-screen | fabrica | fabrica_manual | child of /dashboard/fabrica |
| `/dashboard/fabrica/produtos/:id/custos` | 710 | module-screen | fabrica | fabrica_produtos | wizard/detail |
| `/dashboard/fabrica/produtos/importar` | 711 | module-screen | fabrica | fabrica_produtos | wizard/detail |
| `/dashboard/financeiro/contas-a-pagar/:id` | 819 | module-screen | financeiro | financeiro_contas_pagar | wizard/detail |
| `/dashboard/financeiro/contas-a-pagar/:id/editar` | 823 | module-screen | financeiro | financeiro_contas_pagar | wizard/detail |
| `/dashboard/financeiro/contas-a-pagar/auditoria` | 820 | module-screen | financeiro | financeiro_contas_pagar | wizard/detail |
| `/dashboard/financeiro/contas-a-pagar/novo` | 822 | module-screen | financeiro | financeiro_contas_pagar | wizard/detail |
| `/dashboard/financeiro/contas-a-pagar/sync` | 818 | module-screen | financeiro | admin | wizard/detail |
| `/dashboard/financeiro/contas-a-receber/auditoria` | 829 | module-screen | financeiro | financeiro_contas_receber | wizard/detail |
| `/dashboard/financeiro/contas-a-receber/sync` | 830 | screen | — | admin | wizard/detail |
| `/dashboard/financeiro/fornecedores` | 951 | module-screen | financeiro | financeiro_fornecedores | child of /dashboard/financeiro |
| `/dashboard/financeiro/plano-reducao/:planoId` | 855 | module-screen | financeiro | financeiro_dre | wizard/detail |
| `/dashboard/financeiro/plano-reducao/:planoId/consolidado` | 856 | module-screen | financeiro | financeiro_dre | wizard/detail |
| `/dashboard/financeiro/trade` | 816 | module-screen | financeiro | financeiro_trade | child of /dashboard/financeiro |
| `/dashboard/financeiro/vendas/sync` | 831 | module-screen | estoque | admin | wizard/detail |
| `/dashboard/marketing/influencers` | 598 | module-screen | marketing | marketing_social | child of /dashboard/marketing |
| `/dashboard/marketing/mining-data` | 864 | module-screen | marketing | projetos_dashboard | child of /dashboard/marketing |
| `/dashboard/marketing/redes-sociais` | 861 | module | marketing | — | child of /dashboard/marketing |
| `/dashboard/marketing/strategy` | 863 | module | marketing | — | child of /dashboard/marketing |
| `/dashboard/oms/pedidos/:id` | 909 | module-screen | oms | oms_detalhe | wizard/detail |
| `/dashboard/processos/perfis/novo` | 970 | module | processos | — | wizard/detail |
| `/dashboard/projetos/:id` | 902 | module-screen | projetos | projetos_dashboard | wizard/detail |
| `/dashboard/projetos/:id/aprovacoes` | 904 | module-screen | projetos | projetos_dashboard | wizard/detail |
| `/dashboard/projetos/:id/produtividade` | 903 | module-screen | projetos | projetos_dashboard | wizard/detail |
| `/dashboard/projetos/admin/visibilidade` | 899 | module-screen | projetos | admin | child of /dashboard/projetos |
| `/dashboard/projetos/aprovacoes` | 886 | module-screen | projetos | projetos_aprovacoes | child of /dashboard/projetos |
| `/dashboard/projetos/aprovacoes/auditoria` | 873 | module-screen | projetos | projetos_aprovacoes_auditoria | wizard/detail |
| `/dashboard/projetos/central` | 869 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard/projetos |
| `/dashboard/projetos/central/preferencias` | 870 | module-screen | projetos | projetos_aprovacoes_central | wizard/detail |
| `/dashboard/projetos/convites` | 888 | module-screen | projetos | projetos_vincular_china | child of /dashboard/projetos |
| `/dashboard/projetos/home` | 868 | module-screen | projetos | projetos_home | child of /dashboard/projetos |
| `/dashboard/projetos/minhas-tarefas` | 879 | module-screen | projetos | projetos_minhas_tarefas | child of /dashboard/projetos |
| `/dashboard/projetos/modelos` | 880 | module-screen | projetos | projetos_inbox | child of /dashboard/projetos |
| `/dashboard/projetos/produto-brasil/:id` | 891 | module-screen | projetos | projetos_produto_brasil | wizard/detail |
| `/dashboard/projetos/visual-qa` | 878 | module-screen | projetos | projetos_minhas_tarefas | child of /dashboard/projetos |
| `/dashboard/prospects/lista` | 607 | module-screen | prospects | prospects_lista | child of /dashboard/prospects |
| `/dashboard/prospects/mapa` | 611 | module-screen | prospects | prospects_mapa | child of /dashboard/prospects |
| `/dashboard/prospects/municipios` | 612 | module-screen | prospects | prospects_municipios | child of /dashboard/prospects |
| `/dashboard/reunioes/:id` | 914 | module-screen | reunioes | reunioes_detalhe | wizard/detail |
| `/dashboard/trade/admin/approval-levels` | 628 | module-screen | trade | trade_admin | child of /dashboard/trade/admin |
| `/dashboard/trade/admin/executivo` | 632 | module-screen | trade | trade_admin | child of /dashboard/trade/admin |
| `/dashboard/trade/admin/reports/campaigns` | 629 | module-screen | trade | trade_admin | child of /dashboard/trade/admin |
| `/dashboard/trade/admin/reports/clients` | 630 | module-screen | trade | trade_admin | child of /dashboard/trade/admin |
| `/dashboard/trade/admin/reports/sellers` | 631 | module-screen | trade | trade_admin | child of /dashboard/trade/admin |
| `/dashboard/trade/admin/users` | 627 | module-screen | trade | trade_admin | child of /dashboard/trade/admin |
| `/dashboard/trade/brand-share` | 668 | module-screen | trade | trade_brands | child of /dashboard/trade |
| `/dashboard/trade/campanhas/aprovacoes` | 661 | module-screen | trade | trade_admin | child of /dashboard/trade |
| `/dashboard/trade/competitors` | 643 | module-screen | trade | trade_competitors | child of /dashboard/trade |
| `/dashboard/trade/financeiro/campanhas/:id` | 653 | module-screen | trade | trade_admin | wizard/detail |
| `/dashboard/trade/financeiro/dashboard` | 651 | module-screen | trade | trade_admin | child of /dashboard/trade/financeiro |
| `/dashboard/trade/financeiro/extrato/:accountId` | 656 | module-screen | trade | trade_admin | wizard/detail |
| `/dashboard/trade/formularios/admin` | 982 | module-screen | trade | trade_admin | child of /dashboard/trade |
| `/dashboard/trade/formularios/builder` | 981 | module-screen | trade | trade_admin | wizard/detail |
| `/dashboard/trade/formularios/dashboard` | 983 | module-screen | trade | trade_admin | child of /dashboard/trade |
| `/dashboard/trade/import-stores` | 647 | module-screen | trade | trade_import | child of /dashboard/trade |
| `/dashboard/trade/materiais` | 637 | module-screen | trade | trade_materiais | child of /dashboard/trade |
| `/dashboard/trade/measurement-guide` | 666 | module-screen | trade | trade_shelf | child of /dashboard/trade |
| `/dashboard/trade/minhas-solicitacoes` | 674 | module-screen | trade | trade_solicitacoes | child of /dashboard/trade |
| `/projetos/convite/:token` | 562 | public | — | — | wizard/detail |

## Bucket C — CRM nested (intencional fora do menu)

| Rota | Linha | Guard | module_code | screen_code | Motivo |
| --- | ---: | --- | --- | --- | --- |
| `analytics` | 578 | screen | — | ai_analytics | CRM nested tab |
| `bots` | 574 | public | — | — | CRM nested tab |
| `configuracoes` | 579 | screen | — | ai_analytics | CRM nested tab |
| `contatos` | 576 | public | — | — | CRM nested tab |
| `inbox` | 575 | public | — | — | CRM nested tab |
| `tickets` | 577 | public | — | — | CRM nested tab |

## Próximos passos

1. Revise buckets **D** e **E** — cada linha vira um `INSERT` em `sidebar_menu_items`.
2. Para reclassificar uma rota, adicione em `scripts/audit/orphan-routes-exclusions.json`:
   ```json
   { "/dashboard/exemplo": { "bucket": "B", "reason": "acessada via tab interno" } }
   ```
3. Após aprovação, a migration cadastra D+E preservando `require_admin` e `screen_code`.
