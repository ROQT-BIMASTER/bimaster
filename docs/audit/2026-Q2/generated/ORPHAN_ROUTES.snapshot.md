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
| **B** — Child / wizard / detail (intencional fora do menu) | 152 |
| **C** — CRM nested (intencional fora do menu) | 6 |
| **D** — Admin / diagnóstico (cadastrar com require_admin) | 8 |
| **E** — Feature órfã real (cadastrar no módulo correto) | 1 |

## Bucket D — Admin / diagnóstico (cadastrar com require_admin)

| Rota | Linha | Guard | module_code | screen_code | Motivo |
| --- | ---: | --- | --- | --- | --- |
| `/admin/briefings-fluxos` | 790 | screen | — | comercial_reativacao | admin/diagnostic |
| `/admin/cofre-templates` | 792 | screen | — | comercial_municipios | admin/diagnostic |
| `/admin/documentacao-tecnica` | 942 | public | — | — | admin/diagnostic |
| `/admin/integracoes-saude` | 943 | public | — | — | admin/diagnostic |
| `/admin/integracoes/google-drive` | 793 | screen | — | comercial_whitespace | admin/diagnostic |
| `/admin/suporte` | 794 | screen | — | precos_matriz | admin/diagnostic |
| `/admin/templates-alcadas` | 789 | screen | — | comercial_inteligencia | admin/diagnostic |
| `/admin/versoes-clientes` | 791 | screen | — | comercial_mapa | admin/diagnostic |

## Bucket E — Feature órfã real (cadastrar no módulo correto)

| Rota | Linha | Guard | module_code | screen_code | Motivo |
| --- | ---: | --- | --- | --- | --- |
| `/configuracoes/integracoes/notion` | 945 | protected | — | — | feature órfã real |

## Bucket A — Public / auth (intencional fora do menu)

| Rota | Linha | Guard | module_code | screen_code | Motivo |
| --- | ---: | --- | --- | --- | --- |
| `*` | 995 | screen | — | trade_admin | public/auth |
| `/` | 554 | protected | — | — | public/auth |
| `/aguardando-aprovacao` | 559 | protected | — | — | public/auth |
| `/auth/forgot-password` | 557 | protected | — | — | public prefix |
| `/auth/login` | 555 | protected | — | — | public prefix |
| `/auth/signup` | 556 | protected | — | — | public prefix |
| `/cofre-share` | 984 | screen | — | processos_consulta | public/auth |
| `/contato` | 565 | public | — | — | public/auth |
| `/formulario-dashboard` | 978 | screen | — | financeiro_pagamentos | public/auth |
| `/formulario-dinamico` | 977 | screen | — | financeiro_pagamentos | public/auth |
| `/formulario-equipe` | 976 | screen | — | financeiro_fornecedores | public/auth |
| `/home` | 993 | screen | — | processos_workflows | public/auth |
| `/index` | 991 | screen | — | processos_consulta | public/auth |
| `/index.html` | 992 | screen | — | processos_etapas | public/auth |
| `/meu-perfil` | 569 | protected | — | — | public/auth |
| `/not-found` | 989 | screen | — | processos_consulta | public/auth |
| `/painel/marketing/redes-sociais` | 862 | screen | marketing | estoque_marca_niveis | public prefix |
| `/politica-privacidade` | 985 | screen | — | processos_consulta | public/auth |
| `/portal` | 961 | screen | — | financeiro_fornecedores | public/auth |
| `/portal/perfil` | 963 | screen | — | financeiro_fornecedores | public prefix |
| `/portal/precos` | 962 | screen | — | financeiro_fornecedores | public prefix |
| `/privacidade` | 563 | public | — | — | public/auth |
| `/reset-password` | 558 | protected | — | — | public/auth |
| `/termos` | 564 | public | — | — | public/auth |
| `/termos-de-uso` | 986 | screen | — | processos_consulta | public/auth |
| `/unsubscribe` | 561 | public | — | — | public/auth |
| `/usuario-bloqueado` | 560 | public | — | — | public/auth |

## Bucket B — Child / wizard / detail (intencional fora do menu)

| Rota | Linha | Guard | module_code | screen_code | Motivo |
| --- | ---: | --- | --- | --- | --- |
| `/dashboard/admin-api-support` | 941 | public | — | — | child of /dashboard |
| `/dashboard/admin/alertas-backfill-tarefas` | 884 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/admin/asana-importacao` | 949 | protected | — | — | child of /dashboard |
| `/dashboard/admin/asana-sync` | 948 | protected | — | — | child of /dashboard |
| `/dashboard/admin/checagem-semanal-tarefas` | 885 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/admin/dedupe-perfis` | 950 | protected | — | — | child of /dashboard |
| `/dashboard/admin/diagnostico-tarefas-data-conclusao` | 882 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/admin/historico-backfill-tarefas` | 883 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/admin/projetos-custos-tecnologia` | 905 | screen | — | projetos_inbox | child of /dashboard |
| `/dashboard/admin/projetos-saude` | 894 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/admin/relatorios-v2` | 585 | crm-admin | crm | — | child of /dashboard |
| `/dashboard/admin/relatorios-v2/:reportId` | 587 | crm-admin | crm | — | wizard/detail |
| `/dashboard/admin/relatorios-v2/novo` | 586 | crm-admin | crm | — | wizard/detail |
| `/dashboard/admin/security/hardening` | 896 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/admin/security/hardening-v2` | 897 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/admin/security/security-definer` | 895 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/admin/visibilidade-detalhe-tarefa` | 900 | screen | — | projetos_minhas_tarefas | child of /dashboard |
| `/dashboard/ajuda/projetos-visibilidade` | 901 | screen | — | projetos_minhas_tarefas | child of /dashboard |
| `/dashboard/bancos` | 958 | screen | — | financeiro_fornecedores | child of /dashboard |
| `/dashboard/briefings` | 590 | crm-admin | crm | — | child of /dashboard |
| `/dashboard/briefings/:id` | 591 | crm-admin | crm | — | wizard/detail |
| `/dashboard/central/amostras` | 877 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/central/aprovacoes` | 872 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/central/composicao` | 875 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/central/embalagens` | 876 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/central/motor-artes` | 874 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard |
| `/dashboard/chat` | 618 | screen | — | marketing_social | child of /dashboard |
| `/dashboard/chat/aprovacoes` | 619 | screen | — | marketing_social | child of /dashboard |
| `/dashboard/composicao/sync` | 846 | screen | — | financeiro_contas_pagar | wizard/detail |
| `/dashboard/compras-internacionais` | 738 | screen | — | fabrica_produtos | child of /dashboard |
| `/dashboard/compras-internacionais/inbox` | 739 | screen | — | fabrica_dashboard | child of /dashboard |
| `/dashboard/compras-nacionais` | 740 | screen | — | fabrica_fornecedores | child of /dashboard |
| `/dashboard/configuracoes` | 620 | screen | — | marketing_social | child of /dashboard |
| `/dashboard/configuracoes/api-health` | 927 | screen | — | projetos_dashboard | child of /dashboard |
| `/dashboard/configuracoes/fornecedores-visibilidade` | 953 | screen | — | financeiro_fornecedores | child of /dashboard |
| `/dashboard/configuracoes/permissoes-modulo` | 929 | screen | — | projetos_dashboard | child of /dashboard |
| `/dashboard/configuracoes/permissoes-modulo/:moduleCode` | 930 | screen | — | oms_painel | wizard/detail |
| `/dashboard/contas-a-pagar` | 917 | screen | — | projetos_dashboard | child of /dashboard |
| `/dashboard/contas-pagar` | 957 | screen | — | financeiro_fornecedores | child of /dashboard |
| `/dashboard/controladoria` | 592 | crm-admin | crm | — | child of /dashboard |
| `/dashboard/crm` | 572 | crm-admin | crm | — | child of /dashboard |
| `/dashboard/departamentos` | 683 | screen | — | trade_admin | child of /dashboard |
| `/dashboard/departamentos/:id` | 684 | screen | — | trade_admin | wizard/detail |
| `/dashboard/departamentos/:id/aprovacoes` | 686 | screen | — | trade_admin | wizard/detail |
| `/dashboard/departamentos/:id/dashboard` | 685 | screen | — | trade_admin | wizard/detail |
| `/dashboard/departamentos/aprovacoes` | 687 | screen | — | trade_admin | child of /dashboard |
| `/dashboard/design-studio` | 601 | screen | — | marketing_social | child of /dashboard |
| `/dashboard/estoque/fornecedor` | 750 | screen | — | china_recebimentos | child of /dashboard/estoque |
| `/dashboard/estoque/fornecedor-depara` | 751 | screen | — | china_recebimentos | child of /dashboard/estoque |
| `/dashboard/eventos/:id` | 679 | screen | — | trade_admin | wizard/detail |
| `/dashboard/eventos/aprovacoes` | 678 | screen | — | trade_admin | child of /dashboard/eventos |
| `/dashboard/fabrica-china/auditoria-normalizacao` | 721 | screen | — | fabrica_planejamento | child of /dashboard/fabrica-china |
| `/dashboard/fabrica-china/caixa-entrada` | 720 | screen | — | fabrica_formulas | child of /dashboard/fabrica-china |
| `/dashboard/fabrica-china/nova/:submissaoId` | 723 | screen | — | fabrica_fiscal | wizard/detail |
| `/dashboard/fabrica-china/ordens-producao` | 728 | screen | — | fabrica_maquinas | child of /dashboard/fabrica-china |
| `/dashboard/fabrica-china/ordens/:id` | 729 | screen | — | fabrica_operadores | wizard/detail |
| `/dashboard/fabrica-china/patio-embarque` | 735 | screen | — | fabrica_produtos | child of /dashboard/fabrica-china |
| `/dashboard/fabrica-china/produto/:id` | 731 | screen | — | fabrica_produtos | wizard/detail |
| `/dashboard/fabrica-china/produto/:id/checklist` | 732 | screen | — | fabrica_produtos | wizard/detail |
| `/dashboard/fabrica-china/produto/:id/checklist-status` | 733 | screen | — | fabrica_produtos | wizard/detail |
| `/dashboard/fabrica-china/recebimentos-oc` | 725 | screen | — | fabrica_apontamentos | child of /dashboard/fabrica-china |
| `/dashboard/fabrica-china/recebimentos/divergencias` | 726 | screen | — | fabrica_qualidade | child of /dashboard/fabrica-china/recebimentos |
| `/dashboard/fabrica-china/submissao/:id` | 730 | screen | — | fabrica_produtos | wizard/detail |
| `/dashboard/fabrica-china/torre-containers` | 734 | screen | — | fabrica_produtos | child of /dashboard/fabrica-china |
| `/dashboard/fabrica/analises-custos` | 708 | screen | — | departamentos_hub | child of /dashboard/fabrica |
| `/dashboard/fabrica/analises-custos/:grupoId` | 707 | screen | — | departamentos_hub | wizard/detail |
| `/dashboard/fabrica/auditoria-fotos` | 709 | screen | — | departamentos_detail | child of /dashboard/fabrica |
| `/dashboard/fabrica/cenarios/:grupoId` | 706 | screen | — | departamentos_hub | wizard/detail |
| `/dashboard/fabrica/executivo` | 714 | screen | — | fabrica_recebimentos | child of /dashboard/fabrica |
| `/dashboard/fabrica/formulas/:id` | 695 | screen | — | trade_competitors | wizard/detail |
| `/dashboard/fabrica/formulas/nova` | 694 | screen | — | trade_competitors | child of /dashboard/fabrica/formulas |
| `/dashboard/fabrica/fornecedores` | 715 | screen | — | fabrica_recebimentos | child of /dashboard/fabrica |
| `/dashboard/fabrica/manual` | 716 | screen | — | fabrica_recebimentos | child of /dashboard/fabrica |
| `/dashboard/fabrica/produtos/:id/custos` | 710 | screen | — | departamentos_dashboard | wizard/detail |
| `/dashboard/fabrica/produtos/importar` | 711 | screen | — | departamentos_aprovacoes | wizard/detail |
| `/dashboard/financeiro/contas-a-pagar/:id` | 819 | screen | — | composicao_checklist | wizard/detail |
| `/dashboard/financeiro/contas-a-pagar/:id/editar` | 823 | screen | — | composicao_checklist | wizard/detail |
| `/dashboard/financeiro/contas-a-pagar/auditoria` | 820 | screen | — | composicao_checklist | wizard/detail |
| `/dashboard/financeiro/contas-a-pagar/novo` | 822 | screen | — | composicao_checklist | wizard/detail |
| `/dashboard/financeiro/contas-a-pagar/sync` | 818 | screen | — | composicao_checklist | wizard/detail |
| `/dashboard/financeiro/contas-a-receber/auditoria` | 829 | screen | — | embalagem_analise | wizard/detail |
| `/dashboard/financeiro/contas-a-receber/sync` | 830 | screen | — | etiqueta_checklist | wizard/detail |
| `/dashboard/financeiro/fornecedores` | 951 | screen | — | financeiro_fornecedores | child of /dashboard/financeiro |
| `/dashboard/financeiro/plano-reducao/:planoId` | 855 | screen | — | estoque_marca_niveis | wizard/detail |
| `/dashboard/financeiro/plano-reducao/:planoId/consolidado` | 856 | screen | — | estoque_marca_niveis | wizard/detail |
| `/dashboard/financeiro/trade` | 816 | screen | — | composicao_checklist | child of /dashboard/financeiro |
| `/dashboard/financeiro/vendas/sync` | 831 | screen | — | etiqueta_checklist | wizard/detail |
| `/dashboard/fornecedor` | 746 | screen | — | china_dashboard | child of /dashboard |
| `/dashboard/importar-clientes` | 621 | screen | — | marketing_social | child of /dashboard |
| `/dashboard/integracoes/asana` | 944 | public | — | — | child of /dashboard |
| `/dashboard/integracoes/notion` | 946 | protected | — | — | child of /dashboard |
| `/dashboard/integracoes/shipsgo` | 947 | protected | — | — | child of /dashboard |
| `/dashboard/marketing/influencers` | 598 | screen | — | marketing_social | child of /dashboard/marketing |
| `/dashboard/marketing/mining-data` | 864 | screen | marketing | estoque_marca_niveis | child of /dashboard/marketing |
| `/dashboard/marketing/redes-sociais` | 861 | screen | — | estoque_marca_niveis | child of /dashboard/marketing |
| `/dashboard/marketing/strategy` | 863 | screen | marketing | estoque_marca_niveis | child of /dashboard/marketing |
| `/dashboard/oms` | 908 | screen | — | projetos_aprovacoes | child of /dashboard |
| `/dashboard/oms/condicoes-pagamento` | 910 | screen | — | projetos_aprovacoes | child of /dashboard |
| `/dashboard/oms/pedidos/:id` | 909 | screen | — | projetos_aprovacoes | wizard/detail |
| `/dashboard/pagamentos` | 954 | screen | — | financeiro_fornecedores | child of /dashboard |
| `/dashboard/plano-contas` | 922 | screen | — | projetos_dashboard | child of /dashboard |
| `/dashboard/preferencias-ui` | 570 | protected | — | — | child of /dashboard |
| `/dashboard/processos/etapas-gerenciamento` | 971 | screen | — | financeiro_fornecedores | child of /dashboard |
| `/dashboard/processos/modulos-catalogo` | 972 | screen | — | financeiro_fornecedores | child of /dashboard |
| `/dashboard/processos/perfis` | 969 | screen | — | financeiro_fornecedores | child of /dashboard |
| `/dashboard/processos/perfis/novo` | 970 | screen | — | financeiro_fornecedores | wizard/detail |
| `/dashboard/projetos/:id` | 902 | screen | — | projetos_minhas_tarefas | wizard/detail |
| `/dashboard/projetos/:id/aprovacoes` | 904 | screen | — | projetos_minhas_tarefas | wizard/detail |
| `/dashboard/projetos/:id/produtividade` | 903 | screen | — | projetos_minhas_tarefas | wizard/detail |
| `/dashboard/projetos/admin/visibilidade` | 899 | screen | — | projetos_minhas_tarefas | child of /dashboard/projetos |
| `/dashboard/projetos/aprovacoes` | 886 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard/projetos |
| `/dashboard/projetos/aprovacoes/auditoria` | 873 | module-screen | projetos | projetos_aprovacoes_central | wizard/detail |
| `/dashboard/projetos/central` | 869 | screen | marketing | financeiro_cobrancas | child of /dashboard/projetos |
| `/dashboard/projetos/central/preferencias` | 870 | screen | marketing | financeiro_cobrancas | wizard/detail |
| `/dashboard/projetos/convites` | 888 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard/projetos |
| `/dashboard/projetos/home` | 868 | screen | marketing | estoque_marca_vs_distribuidoras | child of /dashboard/projetos |
| `/dashboard/projetos/minhas-tarefas` | 879 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard/projetos |
| `/dashboard/projetos/modelos` | 880 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard/projetos |
| `/dashboard/projetos/produto-brasil/:id` | 891 | module-screen | projetos | projetos_aprovacoes_central | wizard/detail |
| `/dashboard/projetos/visual-qa` | 878 | module-screen | projetos | projetos_aprovacoes_central | child of /dashboard/projetos |
| `/dashboard/prospects/lista` | 607 | screen | — | marketing_social | child of /dashboard/prospects |
| `/dashboard/prospects/mapa` | 611 | screen | — | marketing_social | child of /dashboard/prospects |
| `/dashboard/prospects/municipios` | 612 | screen | — | marketing_social | child of /dashboard/prospects |
| `/dashboard/relatorios` | 584 | crm-admin | crm | — | child of /dashboard |
| `/dashboard/reunioes/:id` | 914 | screen | — | projetos_vincular_china | wizard/detail |
| `/dashboard/rr-tasks` | 593 | crm-admin | crm | — | child of /dashboard |
| `/dashboard/security-explorer` | 935 | screen | — | oms_condicoes | child of /dashboard |
| `/dashboard/security/mfa` | 898 | module-screen | projetos | projetos_aprovacoes_auditoria | child of /dashboard |
| `/dashboard/seguranca-dashboard` | 934 | screen | — | oms_detalhe | child of /dashboard |
| `/dashboard/simulacao` | 810 | screen | — | estoque_vinculacoes | child of /dashboard |
| `/dashboard/trade/admin/approval-levels` | 628 | screen | — | prospects_lista | child of /dashboard/trade/admin |
| `/dashboard/trade/admin/executivo` | 632 | screen | — | prospects_lista | child of /dashboard/trade/admin |
| `/dashboard/trade/admin/reports/campaigns` | 629 | screen | — | prospects_lista | child of /dashboard/trade/admin |
| `/dashboard/trade/admin/reports/clients` | 630 | screen | — | prospects_lista | child of /dashboard/trade/admin |
| `/dashboard/trade/admin/reports/sellers` | 631 | screen | — | prospects_lista | child of /dashboard/trade/admin |
| `/dashboard/trade/admin/users` | 627 | screen | — | prospects_lista | child of /dashboard/trade/admin |
| `/dashboard/trade/brand-share` | 668 | screen | — | trade_competitors | child of /dashboard/trade |
| `/dashboard/trade/campanhas/aprovacoes` | 661 | screen | — | trade_admin | child of /dashboard/trade |
| `/dashboard/trade/competitors` | 643 | screen | — | comercial_importar | child of /dashboard/trade |
| `/dashboard/trade/financeiro/campanhas/:id` | 653 | screen | — | trade_admin | wizard/detail |
| `/dashboard/trade/financeiro/dashboard` | 651 | screen | — | trade_admin | child of /dashboard/trade/financeiro |
| `/dashboard/trade/financeiro/extrato/:accountId` | 656 | screen | — | trade_admin | wizard/detail |
| `/dashboard/trade/formularios/admin` | 982 | screen | — | financeiro_contas_pagar_gestao | child of /dashboard/trade |
| `/dashboard/trade/formularios/builder` | 981 | screen | — | financeiro_centros_custo | wizard/detail |
| `/dashboard/trade/formularios/dashboard` | 983 | screen | — | financeiro_contas_bancarias | child of /dashboard/trade |
| `/dashboard/trade/import-stores` | 647 | screen | — | trade_admin | child of /dashboard/trade |
| `/dashboard/trade/materiais` | 637 | screen | — | prospects_municipios | child of /dashboard/trade |
| `/dashboard/trade/measurement-guide` | 666 | screen | — | trade_visits | child of /dashboard/trade |
| `/dashboard/trade/minhas-solicitacoes` | 674 | screen | — | trade_ideal_photos | child of /dashboard/trade |
| `/dashboard/trilha-auditoria-acessos` | 936 | screen | — | reunioes_lista | child of /dashboard |
| `/dashboard/vendas/analise` | 744 | screen | — | china_dashboard | child of /dashboard |
| `/projetos/convite/:token` | 562 | public | — | — | wizard/detail |

## Bucket C — CRM nested (intencional fora do menu)

| Rota | Linha | Guard | module_code | screen_code | Motivo |
| --- | ---: | --- | --- | --- | --- |
| `analytics` | 578 | crm-admin | crm | — | CRM nested tab |
| `bots` | 574 | crm-admin | crm | — | CRM nested tab |
| `configuracoes` | 579 | crm-admin | crm | — | CRM nested tab |
| `contatos` | 576 | crm-admin | crm | — | CRM nested tab |
| `inbox` | 575 | crm-admin | crm | — | CRM nested tab |
| `tickets` | 577 | crm-admin | crm | — | CRM nested tab |

## Próximos passos

1. Revise buckets **D** e **E** — cada linha vira um `INSERT` em `sidebar_menu_items`.
2. Para reclassificar uma rota, adicione em `scripts/audit/orphan-routes-exclusions.json`:
   ```json
   { "/dashboard/exemplo": { "bucket": "B", "reason": "acessada via tab interno" } }
   ```
3. Após aprovação, a migration cadastra D+E preservando `require_admin` e `screen_code`.
