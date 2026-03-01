

## Plano: Acesso de Compras/Faturamento a Matérias-Primas + Correções da Fábrica

### 1. Corrigir inconsistência de screenCode na rota de Matérias-Primas

**Bug encontrado:** Em `App.tsx`, a rota `/dashboard/fabrica/materias-primas` usa `screenCode="fabrica_materias_primas"`, mas a tela no banco tem código `fabrica_mps`. Isso pode bloquear acesso mesmo para quem tem permissão. Corrigir para `screenCode="fabrica_mps"`.

### 2. Garantir acesso para Compras/Faturamento

O sistema usa permissões por tela (`usuario_permissoes_telas`) vinculadas ao código da tela. Duas opções para liberar acesso:

- **Via banco:** Inserir permissão `fabrica_mps` para os usuários do departamento Compras/Faturamento (se o departamento não existe, criá-lo).
- **Via código:** Não é necessário alterar código além da correção do screenCode, pois o sistema já suporta permissões individuais por usuário e departamento. O administrador pode conceder acesso pela tela de Permissões.

**Ação:** Como não existe departamento "Compras/Faturamento" no banco, criar via migration e vincular a permissão do módulo `fabrica` e da tela `fabrica_mps` a esse departamento para que todos os membros tenham acesso automático.

### 3. Testar funcionalidades da Fábrica via navegação

Após as correções, navegar pelo módulo Fábrica para verificar:
- Matérias-Primas (listagem, criação, edição, exclusão)
- Produtos Acabados
- Fórmulas BOM
- Ordens de Produção
- Vinculação de XML (novo e salvos)
- Configuração Fiscal

### Arquivos afetados

- `src/App.tsx` — corrigir `fabrica_materias_primas` → `fabrica_mps` na rota (linha 372)
- Migration SQL — criar departamento "Compras e Faturamento" e vincular permissão da tela `fabrica_mps` e módulo `fabrica` ao departamento

### Detalhes técnicos

```text
App.tsx linha 372:
  ANTES: screenCode="fabrica_materias_primas"
  DEPOIS: screenCode="fabrica_mps"

Migration SQL:
  1. INSERT departamento "Compras e Faturamento"
  2. INSERT departamento_permissoes_modulos → módulo fabrica
  3. INSERT (se tabela existir) permissão de tela fabrica_mps
```

