
# Cadastro de Equipe Comercial no Trade Marketing

## Objetivo
Criar um formulario de cadastro completo para vendedores e supervisores dentro do modulo Trade Marketing, permitindo coletar dados pessoais como CPF, RG, data de nascimento, WhatsApp e tamanho de camiseta. Esses dados ficarao disponiveis para consulta na tela "Minha Equipe".

## O que sera feito

### 1. Nova tabela no banco de dados: `team_member_details`

Tabela complementar a `profiles` para armazenar dados pessoais dos membros da equipe comercial:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador unico |
| user_id | uuid (FK profiles.id, UNIQUE) | Vinculo com o perfil do usuario |
| nome_completo | text | Nome completo |
| cpf | text | CPF (criptografado/mascarado na exibicao) |
| rg | text | RG |
| data_nascimento | date | Data de nascimento |
| email_pessoal | text | Email pessoal (pode diferir do login) |
| whatsapp | text | Numero WhatsApp |
| tamanho_camiseta | text | P, M, G, GG, XGG |
| equipe_comercial | text | Nome/numero da equipe comercial |
| supervisor_nome | text | Nome do supervisor (referencia) |
| observacoes | text | Campo livre para anotacoes |
| created_at | timestamptz | Data de criacao |
| updated_at | timestamptz | Data de atualizacao |
| created_by | uuid | Quem cadastrou |

**Politicas RLS:**
- Admin/Gerente: leitura e escrita de todos os registros
- Supervisor: leitura e escrita dos membros da sua equipe (subordinados)
- Vendedor/Promotor: leitura e edicao apenas do proprio registro

### 2. Nova tela: Cadastro da Equipe (dentro de "Minha Equipe")

Sera adicionada uma nova aba ou secao na pagina `TradeSupervisorDashboard` com:

**a) Tabela de membros com dados completos**
- Nome, CPF (mascarado), WhatsApp, Tamanho Camiseta, Equipe
- Filtro por nome e equipe
- Badge indicando se o cadastro esta completo ou pendente
- Botao de editar para cada membro

**b) Dialog de cadastro/edicao**
- Formulario com todos os campos da imagem de referencia:
  1. Equipe Comercial (numero/nome) + Supervisor(a) responsavel
  2. Nome Completo
  3. Data de Nascimento
  4. CPF
  5. RG
  6. E-mail
  7. Contato WhatsApp
  8. Tamanho Camiseta (opcoes: P, M, G, GG, XGG)
- Validacao com Zod (CPF valido, formato de telefone, etc.)
- Uso das funcoes `formatCPF` e `formatPhone` ja existentes no projeto

**c) Exportacao Excel**
- Botao para exportar todos os dados da equipe em planilha

### 3. Auto-preenchimento pelo proprio vendedor

Vendedores e promotores poderao acessar e preencher seus proprios dados atraves de um card na pagina principal do Trade ou na pagina de perfil, garantindo que a coleta de dados nao dependa apenas do supervisor.

### 4. Integracao com upload de foto

O componente `ProfileAvatarUpload` ja existente sera integrado ao formulario, permitindo que cada membro inclua sua foto junto com os dados cadastrais.

## Arquivos a criar

1. **`src/components/trade/supervisor/TeamMemberRegistration.tsx`** - Tabela com lista dos membros e status de cadastro
2. **`src/components/trade/supervisor/TeamMemberFormDialog.tsx`** - Dialog com formulario de cadastro/edicao
3. **`src/hooks/useTeamMemberDetails.ts`** - Hook para CRUD dos dados dos membros
4. **`src/lib/validations/teamMember.ts`** - Schema Zod de validacao

## Arquivos a editar

1. **`src/pages/TradeSupervisorDashboard.tsx`** - Adicionar aba "Cadastro Equipe" com o componente de registro
2. **`src/components/dashboard/AppSidebar.tsx`** - Nenhuma alteracao necessaria (ja existe a rota "Minha Equipe")

## Detalhes tecnicos

### Validacao (Zod)
```text
- CPF: 11 digitos, validacao de digito verificador
- RG: 5-15 caracteres alfanumericos
- WhatsApp: formato (00) 00000-0000
- Email: formato email valido
- Data nascimento: data valida, pessoa deve ter > 16 anos
- Tamanho camiseta: enum ['P', 'M', 'G', 'GG', 'XGG']
```

### Fluxo de visibilidade
```text
Admin/Gerente  -> Ve e edita todos os membros
Supervisor     -> Ve e edita membros da sua equipe (via get_subordinados)
Vendedor       -> Ve e edita apenas o proprio cadastro
```

### Migracao SQL
- Criar tabela `team_member_details`
- RLS com politicas baseadas em hierarquia
- Trigger para atualizar `updated_at` automaticamente
