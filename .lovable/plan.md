

## Auditoria Completa de Permissões - Vulnerabilidades Encontradas

### Metodologia
Cruzamento de 3 fontes de permissão (role, departamento, individual) para todos os ~80 usuários aprovados.

---

### VULNERABILIDADE 1: Compras e Faturamento tem módulo `fabrica`
**Risco: ALTO**

| Departamento | Módulo herdado | Telas herdadas |
|---|---|---|
| Compras e Faturamento | `fabrica` | `fabrica_mps`, `fabrica_produtos`, `instalar_app` |

Os usuários "Compras" e "Faturamento" acessam o módulo Fábrica inteiro via departamento. Mesmo sem ser China, isso expõe dados de produção.

**Correção**: Remover `fabrica` de `departamento_permissoes_modulos` e telas associadas de `departamento_permissoes_telas` para este departamento.

---

### VULNERABILIDADE 2: Operações tem módulo `fabrica`
**Risco: MÉDIO**

| Departamento | Módulo herdado |
|---|---|
| Operações | `dashboard`, `fabrica` |

**Correção**: Remover `fabrica` de `departamento_permissoes_modulos` para Operações, a menos que seja intencional.

---

### VULNERABILIDADE 3: Role `vendedor` mantém telas de Prospects (órfãs)
**Risco: MÉDIO**

Removemos o módulo `prospects` do role vendedor, mas as **telas** ainda existem em `role_permissoes_telas`:
- `PROSPECTS_DASHBOARD`, `PROSPECTS_KANBAN`, `PROSPECTS_MAPA`, `PROSPECTS_LISTA`, `PROSPECTS_ATIVIDADES`
- Também: `comercial_dashboard` (módulo comercial foi removido)

Embora o `ModuleRoute` bloqueie no nível do módulo, essas entradas órfãs são inconsistentes e podem causar confusão.

**Correção**: Remover essas telas de `role_permissoes_telas` para role `vendedor`.

---

### VULNERABILIDADE 4: Role `gerente` tem acesso global a `projetos`
**Risco: ALTO**

Todos os gerentes (Ahmad, Luana, Jessika, Juliana Germinhasi, Michele, Milene) recebem:
- Módulo: `projetos`
- Telas: `projetos_dashboard`, `projetos_equipe`, `projetos_inbox`

Gerentes de Trade Marketing (Jessika, Juliana, Milene) **não deveriam** acessar Projetos. Apenas gerentes do departamento Projetos deveriam.

**Correção**: Remover `projetos` de `role_permissoes_modulos` e telas `projetos_*` de `role_permissoes_telas` para role `gerente`. Atribuir individualmente onde necessário.

---

### VULNERABILIDADE 5: Role `supervisor` com acesso amplo
**Risco: MÉDIO**

Supervisores (Douglas, Juliana Moura, Monique, Nathalia) recebem via role:
- Módulos: `comercial`, `dashboard`, `precos`, `prospects`, `trade`
- 16 telas incluindo toda a área de Trade e Prospects

Nenhum deles tem departamento atribuído. Precisam realmente de todos esses módulos?

**Correção**: Avaliar caso a caso. Sugestão: remover módulos de `role_permissoes_modulos` para supervisor e atribuir individualmente.

---

### VULNERABILIDADE 6: "Administrador Sistema" é vendedor com `config`
**Risco: ALTO**

Usuário "Administrador Sistema" tem role `vendedor` mas permissões individuais de `config` e `dashboard`. Um vendedor com acesso a configurações é um risco de segurança.

**Correção**: Alterar role para `admin` ou remover permissão individual de `config`.

---

### VULNERABILIDADE 7: Leandro Ramos (Financeiro) com módulo `trade`
**Risco: BAIXO**

Usuário do departamento Financeiro com permissão individual ao módulo `trade`. Cross-department - pode ser intencional para acompanhamento financeiro de trade.

**Correção**: Verificar se é intencional.

---

### VULNERABILIDADE 8: 42 usuários sem departamento
**Risco: MÉDIO**

42 usuários aprovados não têm departamento atribuído (todos os supervisores, muitos vendedores, alguns gerentes). Isso significa que:
- Não se beneficiam do isolamento departamental
- Regras RLS baseadas em departamento não se aplicam
- Podem escapar de filtros de dados

---

### Resumo de Ações (Migration SQL)

| # | Ação | Tabela |
|---|---|---|
| 1 | Remover `fabrica` do dept Compras e Faturamento | `departamento_permissoes_modulos` + `_telas` |
| 2 | Remover `fabrica` do dept Operações | `departamento_permissoes_modulos` |
| 3 | Limpar telas órfãs do role vendedor | `role_permissoes_telas` |
| 4 | Remover `projetos` do role gerente | `role_permissoes_modulos` + `_telas` |
| 5 | (Opcional) Revisar role supervisor | Decisão do cliente |
| 6 | (Opcional) Corrigir "Administrador Sistema" | `user_roles` |

Itens 1-4 são correções claras de segurança. Itens 5-6 precisam de confirmação.

