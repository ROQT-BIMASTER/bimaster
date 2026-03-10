

# Separação de Permissões: Brasil vs China no Módulo Fábrica China

## Regra de Negócio

- **China** (departamento = "China"): só envia documentos, visualiza status e observações do Brasil. Não vê botões de aprovar/rejeitar, criar projeto, emitir OC, enviar arte.
- **Brasil** (qualquer outro departamento ou admin): controle total — aprova, rejeita, cria projetos, emite OC, envia arte final + EAN.

## Implementação

### 1. Hook `useChinaUserContext` (novo)

Cria um hook simples que consulta o perfil do usuário logado e verifica se o `departamento_id` corresponde ao departamento "China":

```typescript
// Retorna { isChinaUser: boolean, isBrasilUser: boolean, loading: boolean }
```

Faz lookup do departamento pelo nome "China" na tabela `departamentos`, compara com o `departamento_id` do perfil. Admins são sempre tratados como Brasil.

### 2. `ChinaFichaProduto.tsx` — Esconder ações do Brasil

Usando o hook, esconder condicionalmente:
- Botões **Aprovar/Rejeitar** submissão (linhas 274-298)
- Botões **Aprovar/Rejeitar** documentos individuais (linhas 372-398) 
- Seção **Arte Final + EAN** (linhas 422-453)
- Botão **Emitir OC** (linhas 270-272)
- Seção **Projetos Vinculados** com botão de criação (linha 479)

China continua vendo:
- Upload de documentos ✓
- Status de cada documento ✓
- Observações de rejeição do Brasil ✓
- Download da arte final enviada ✓
- Dados do produto e grade ✓

### 3. `ChinaFabrica.tsx` — Dashboard adaptativo

Para usuários China:
- Esconder card "Ordens de Compra" e "Arte Enviada" (ações do Brasil)
- Manter "Nova Submissão", "Minhas Submissões", "Aprovados" (visualização)

### 4. `ChinaNovaSubmissao.tsx` — Sem mudanças

A submissão é feita pela China, então permanece acessível normalmente.

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/hooks/useChinaUserContext.ts` | **Criar**: hook para detectar se usuário é do departamento China |
| `src/pages/ChinaFichaProduto.tsx` | **Editar**: esconder ações Brasil com `isChinaUser` |
| `src/pages/ChinaFabrica.tsx` | **Editar**: dashboard adaptativo por contexto |

