import { useState } from "react";
import { BookOpen, ChevronDown, FileText, Upload, Weight, CheckCircle2, Send, Eye, XCircle, Palette, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const STATUS_FLOW = [
  { label: "Rascunho 草稿", cn: "草稿", variant: "secondary" as const, icon: FileText },
  { label: "Enviado 已发送", cn: "已发送", variant: "warning" as const, icon: Send },
  { label: "Em Revisão 审核中", cn: "审核中", variant: "default" as const, icon: Eye },
  { label: "Aprovado 已批准", cn: "已批准", variant: "success" as const, icon: CheckCircle2 },
];

export function SubmissionManual() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Card className="p-3 cursor-pointer hover:border-primary/40 transition-colors border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Manual de Submissão 提交手册</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </Card>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-1 p-4 border-primary/20 bg-primary/5 space-y-4">
          {/* Status Flow */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">CICLO DE STATUS 状态流程</p>
            <div className="flex items-center gap-1 flex-wrap">
              {STATUS_FLOW.map((s, i) => (
                <div key={s.label} className="flex items-center gap-1">
                  <Badge variant={s.variant} className="text-[10px] gap-1">
                    <s.icon className="h-3 w-3" />
                    {s.label}
                  </Badge>
                  {i < STATUS_FLOW.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              ))}
              <span className="text-[10px] text-muted-foreground ml-1">ou 或</span>
              <Badge variant="destructive" className="text-[10px] gap-1">
                <XCircle className="h-3 w-3" />
                Rejeitado 已拒绝
              </Badge>
            </div>
          </div>

          {/* Steps Accordion */}
          <Accordion type="multiple" className="space-y-0">
            <AccordionItem value="step1" className="border-b-0">
              <AccordionTrigger className="py-2 text-xs font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">1</Badge>
                  <span>Dados do Produto 产品数据</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1 pl-7">
                <p>• Envie um <strong>Excel ou foto</strong> — a IA extrai os dados automaticamente</p>
                <p>• 上传 <strong>Excel 或照片</strong> — AI 自动提取数据</p>
                <p>• Ou preencha manualmente os campos (código, nome, EANs, fórmula)</p>
                <p>• 或手动填写字段（代码、名称、EAN、配方）</p>
                <p>• Após revisão, confirme na <strong>Caixa de Validação</strong> para salvar</p>
                <p>• 审核后，在 <strong>验证框</strong> 中确认保存</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step2" className="border-b-0">
              <AccordionTrigger className="py-2 text-xs font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">2</Badge>
                  <span>Documentos e Fotos 文件和照片</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1 pl-7">
                <p>• <strong>Categorias:</strong> Dados Oficiais, Fotos da Planilha, Imagens Gerais, Rotulagem, Embalagem</p>
                <p>• <strong>类别:</strong> 官方数据、表格照片、通用图片、标签、包装</p>
                <p>• Suporte a <strong>múltiplos arquivos</strong> por slot (fotos, PDF, Excel, Word)</p>
                <p>• 每个槽位支持 <strong>多个文件</strong>（照片、PDF、Excel、Word）</p>
                <p>• Arquivos vão para o <strong>Cofre do Produto</strong> com status "Pendente"</p>
                <p>• 文件将进入 <strong>产品保险库</strong>，状态为"待审核"</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step3" className="border-b-0">
              <AccordionTrigger className="py-2 text-xs font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">3</Badge>
                  <span>Pesos e Medidas 重量和尺寸</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1 pl-7">
                <p>• Preencha peso bruto, líquido e tester (em gramas)</p>
                <p>• 填写毛重、净重和试用装重量（克）</p>
                <p>• Defina medidas do display (comprimento × largura × altura)</p>
                <p>• 定义展示盒尺寸（长 × 宽 × 高）</p>
                <p>• Monte a <strong>grade de cores</strong> com SKU, EAN e quantidade por cor</p>
                <p>• 设置 <strong>颜色网格</strong>，包括 SKU、EAN 和每种颜色的数量</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="draft" className="border-b-0">
              <AccordionTrigger className="py-2 text-xs font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Modo Rascunho 草稿模式</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1 pl-7">
                <p>• Salve a qualquer momento com <strong>"Salvar Rascunho"</strong></p>
                <p>• 随时使用 <strong>"保存草稿"</strong> 保存</p>
                <p>• Volte depois e continue de onde parou (clique <strong>"Continuar 继续"</strong>)</p>
                <p>• 稍后回来继续（点击 <strong>"继续"</strong>）</p>
                <p>• A submissão só é enviada ao Brasil após o <strong>checklist final</strong></p>
                <p>• 只有完成 <strong>最终检查清单</strong> 后才会发送到巴西</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="review" className="border-b-0">
              <AccordionTrigger className="py-2 text-xs font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Revisão Final e Envio 最终审核与发送</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-1 pl-7">
                <p>• O checklist verifica: dados do produto ✓, documentos obrigatórios ✓, pesos ✓, grade de cores ✓</p>
                <p>• 清单验证：产品数据 ✓、必要文件 ✓、重量 ✓、颜色网格 ✓</p>
                <p>• Após confirmação, status muda para <strong>"Enviado"</strong> — visível ao Brasil</p>
                <p>• 确认后，状态变为 <strong>"已发送"</strong> — 巴西可见</p>
                <p>• Se rejeitado, docs com problema aparecem com badge <strong>vermelho</strong> para correção</p>
                <p>• 如果被拒绝，有问题的文件会显示 <strong>红色</strong> 标记以供修改</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
