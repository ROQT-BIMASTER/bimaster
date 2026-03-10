

## Tela "Vincular Envio China" no Módulo de Projetos (Brasil)

### Conceito

Nova tela no módulo de **Projetos** (Brasil) onde o usuário pode:
1. Selecionar uma submissão da China (busca por código/nome)
2. Escolher um projeto existente para vincular
3. Vincular a submissão a seções e tarefas específicas do projeto
4. A IA audita automaticamente a relação antes de confirmar (usando `audit-china-vinculo`)
5. Visualizar vínculos existentes e removê-los

A China **não vê** esta tela -- fica 100% no módulo Projetos.

### Estrutura

**Nova rota**: `/dashboard/projetos/vincular-china`
**Nova página**: `src/pages/ProjetoVincularChina.tsx`
**Menu lateral**: Adicionar link na seção Projetos do `AppSidebar`

### Layout da Tela

```text
┌──────────────────────────────────────────────────────┐
│  Vincular Envio China                                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─ Painel Esquerdo ──────┐  ┌─ Painel Direito ───┐ │
│  │ Buscar submissão China │  │ Projeto selecionado │ │
│  │ [search input]         │  │ > Seções + Tarefas  │ │
│  │                        │  │ [checkbox para      │ │
│  │ Lista de submissões    │  │  vincular cada      │ │
│  │ - COD001 Produto X  ●  │  │  seção/tarefa]      │ │
│  │ - COD002 Produto Y     │  │                     │ │
│  │ - COD003 Produto Z  ●  │  │ [Badge AI audit]    │ │
│  │   (● = já vinculada)   │  │                     │ │
│  │                        │  │ [Btn: Vincular]     │ │
│  └────────────────────────┘  └─────────────────────┘ │
│                                                      │
│  ┌─ Vínculos Existentes ─────────────────────────┐   │
│  │ Submissão → Projeto → Seções  [Desvincular]   │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Fluxo

1. Usuário seleciona uma submissão China no painel esquerdo
2. Seleciona um projeto no dropdown (ou o projeto já vinculado aparece)
3. Vê as seções e tarefas do projeto com checkboxes
4. Marca quais seções/tarefas se relacionam com aquele produto China
5. **IA audita** automaticamente (badge verde/amarelo/vermelho)
6. Se audit OK -> vincular. Se audit baixo -> aviso + opção de forçar

### Alterações Necessárias

**Banco de dados**: Criar tabela `china_submissao_tarefa_vinculos` para vincular submissão a tarefas específicas (além do vínculo projeto-nível que já existe em `china_submissao_projetos`).

```sql
CREATE TABLE china_submissao_tarefa_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID NOT NULL REFERENCES china_produto_submissoes(id) ON DELETE CASCADE,
  tarefa_id UUID NOT NULL,
  secao_id UUID REFERENCES projeto_secoes(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  audit_result JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submissao_id, tarefa_id)
);
ALTER TABLE china_submissao_tarefa_vinculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage vinculos" ON china_submissao_tarefa_vinculos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

**Arquivos a criar/modificar**:

| Arquivo | Ação |
|---|---|
| `src/pages/ProjetoVincularChina.tsx` | Nova tela completa |
| `src/hooks/useChinaTarefaVinculos.ts` | Hook para CRUD dos vínculos submissão↔tarefa |
| `src/App.tsx` | Adicionar rota `/dashboard/projetos/vincular-china` |
| `src/components/dashboard/AppSidebar.tsx` | Adicionar link no menu Projetos |

### Hook `useChinaTarefaVinculos`

- `useSubmissoesChina()` - lista submissões com busca
- `useVinculosExistentes(projetoId)` - lista vínculos atuais
- `useCreateVinculo()` - cria vínculo + roda audit
- `useDeleteVinculo()` - remove vínculo
- Integra `audit-china-vinculo` automaticamente ao vincular

### Integração com Audit IA

Ao vincular, chama `audit-china-vinculo` com os dados da submissão + tarefa. O resultado é salvo na coluna `audit_result` e exibido via `AuditChinaVinculoBadge` existente.

