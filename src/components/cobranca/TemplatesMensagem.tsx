import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Copy, 
  Mail, 
  MessageCircle, 
  Phone,
  FileText,
  CheckCircle
} from "lucide-react";
import { toast } from "sonner";

interface ClienteInfo {
  nome: string;
  codigo: string;
  totalAberto: number;
  diasAtraso: number;
  titulos: number;
}

interface Props {
  cliente: ClienteInfo;
  onSelectTemplate?: (template: string, tipo: string) => void;
}

export function TemplatesMensagem({ cliente, onSelectTemplate }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const substituirVariaveis = (template: string) => {
    return template
      .replace(/\{nome\}/g, cliente.nome)
      .replace(/\{codigo\}/g, cliente.codigo)
      .replace(/\{valor\}/g, formatCurrency(cliente.totalAberto))
      .replace(/\{dias\}/g, cliente.diasAtraso.toString())
      .replace(/\{titulos\}/g, cliente.titulos.toString())
      .replace(/\{data\}/g, new Date().toLocaleDateString('pt-BR'));
  };

  const templates = {
    whatsapp: [
      {
        id: 'wpp-lembrete',
        nome: 'Lembrete Amigável',
        conteudo: `Olá {nome}! 👋

Identificamos que existe um valor em aberto de {valor} com {dias} dias de atraso.

Gostaríamos de ajudá-lo a regularizar esta situação. 

Entre em contato conosco para verificarmos as melhores condições para você.

Aguardamos seu retorno! 🤝`
      },
      {
        id: 'wpp-urgente',
        nome: 'Cobrança Urgente',
        conteudo: `Prezado(a) {nome},

Verificamos que existem {titulos} título(s) vencido(s) totalizando {valor}, com atraso de {dias} dias.

⚠️ É importante regularizarmos esta situação o mais breve possível para evitar:
- Restrição no crédito
- Protestos
- Negativação nos órgãos de proteção

Entre em contato HOJE para negociarmos.

Atenciosamente,
Equipe Financeira`
      },
      {
        id: 'wpp-acordo',
        nome: 'Proposta de Acordo',
        conteudo: `Olá {nome}! 

Temos uma proposta especial para você! 🎯

Valor em aberto: {valor}
Dias de atraso: {dias}

Condições especiais:
✅ Parcelamento em até 6x
✅ Desconto para pagamento à vista
✅ Atualização sem juros adicionais

Responda esta mensagem para conhecer as condições completas!`
      }
    ],
    email: [
      {
        id: 'email-lembrete',
        nome: 'Lembrete de Pagamento',
        conteudo: `Prezado(a) {nome},

Identificamos que existem pendências financeiras em seu cadastro no valor de {valor}, referente a {titulos} título(s) vencido(s).

Data de referência: {data}
Dias de atraso: {dias} dias

Solicitamos a gentileza de regularizar esta situação através dos nossos canais de atendimento ou respondendo este e-mail.

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Atenciosamente,
Departamento Financeiro`
      },
      {
        id: 'email-negociacao',
        nome: 'Convite para Negociação',
        conteudo: `Prezado(a) {nome},

Gostaríamos de convidá-lo(a) para uma negociação amigável referente às pendências em aberto em seu cadastro.

Valor total: {valor}
Quantidade de títulos: {titulos}
Tempo de atraso: {dias} dias

Oferecemos condições especiais de parcelamento e desconto para regularização.

Para mais informações, entre em contato através:
📞 (XX) XXXX-XXXX
💬 WhatsApp: (XX) XXXXX-XXXX
📧 financeiro@empresa.com.br

Aguardamos seu contato!

Atenciosamente,
Equipe de Cobrança`
      },
      {
        id: 'email-formal',
        nome: 'Notificação Formal',
        conteudo: `NOTIFICAÇÃO DE DÉBITO

À
{nome}
Código: {codigo}

Ref.: Débito Vencido

Prezado(a) Senhor(a),

Pelo presente, NOTIFICAMOS Vossa Senhoria da existência de débito(s) vencido(s) em sua conta, conforme discriminado abaixo:

VALOR TOTAL: {valor}
QUANTIDADE DE TÍTULOS: {titulos}
DIAS DE ATRASO: {dias}
DATA DESTA NOTIFICAÇÃO: {data}

Informamos que o não pagamento ou negociação no prazo de 5 (cinco) dias úteis a contar do recebimento desta notificação poderá acarretar em:

1. Protesto do(s) título(s) em cartório;
2. Inscrição nos órgãos de proteção ao crédito (SPC/SERASA);
3. Cobrança judicial com os acréscimos legais.

Para sua comodidade, disponibilizamos diversos canais de atendimento para negociação.

Sem mais para o momento, subscrevemo-nos.

Atenciosamente,
Departamento Jurídico/Financeiro`
      }
    ],
    telefone: [
      {
        id: 'tel-script1',
        nome: 'Script Inicial',
        conteudo: `SCRIPT DE COBRANÇA - CONTATO INICIAL

Cliente: {nome}
Código: {codigo}
Valor: {valor} | Atraso: {dias} dias

---

"Bom dia/Boa tarde, posso falar com o(a) Sr(a) {nome}?"

[Se sim]
"Aqui é [seu nome] do departamento financeiro da [empresa]. Estou entrando em contato referente a alguns títulos em aberto no valor de {valor}, com {dias} dias de atraso."

"O(a) senhor(a) tem ciência dessas pendências?"

[Se não sabia]
"Temos {titulos} título(s) vencido(s). Gostaria de verificar a melhor forma de regularizarmos?"

[Se sabia]
"Conseguimos ajudar com uma negociação. Qual seria a melhor condição para o senhor?"

---
INFORMAÇÕES PARA NEGOCIAÇÃO:
- Desconto à vista: até X%
- Parcelamento: até Xx
- Primeira parcela: entrada mínima X%`
      },
      {
        id: 'tel-script2',
        nome: 'Script Retorno',
        conteudo: `SCRIPT DE COBRANÇA - RETORNO

Cliente: {nome}
Valor: {valor} | Atraso: {dias} dias

---

"Bom dia/Boa tarde, é o(a) Sr(a) {nome}?"

"Aqui é [seu nome], estou retornando conforme combinamos sobre a regularização dos títulos em aberto."

"Conseguiu avaliar nossa proposta?"

[Se sim, positivo]
"Ótimo! Vamos então formalizar o acordo..."

[Se ainda não decidiu]
"Entendo. Para facilitar, posso oferecer [condição especial]. Assim conseguimos resolver hoje."

[Se negativo]
"Entendo a situação. Qual seria uma condição que caberia no seu orçamento? Vou verificar se consigo autorização."

---
OBJEÇÕES COMUNS:
- "Não tenho dinheiro" → Parcelamento
- "Vou pagar depois" → Agendar data específica
- "Valor errado" → Verificar e retornar`
      }
    ]
  };

  const copyToClipboard = async (texto: string, id: string) => {
    const textoFinal = substituirVariaveis(texto);
    await navigator.clipboard.writeText(textoFinal);
    setCopiedId(id);
    toast.success("Copiado para área de transferência!");
    setTimeout(() => setCopiedId(null), 2000);
    
    if (onSelectTemplate) {
      onSelectTemplate(textoFinal, id.split('-')[0]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Templates de Mensagem</CardTitle>
        <p className="text-sm text-muted-foreground">
          Variáveis disponíveis: {'{nome}'}, {'{valor}'}, {'{dias}'}, {'{titulos}'}, {'{codigo}'}, {'{data}'}
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="whatsapp">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              E-mail
            </TabsTrigger>
            <TabsTrigger value="telefone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Telefone
            </TabsTrigger>
          </TabsList>

          {Object.entries(templates).map(([tipo, lista]) => (
            <TabsContent key={tipo} value={tipo} className="space-y-4 mt-4">
              {lista.map((template) => (
                <div key={template.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{template.nome}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(template.conteudo, template.id)}
                    >
                      {copiedId === template.id ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Textarea 
                    value={substituirVariaveis(template.conteudo)}
                    readOnly
                    className="min-h-[150px] text-sm bg-muted/50"
                  />
                </div>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
