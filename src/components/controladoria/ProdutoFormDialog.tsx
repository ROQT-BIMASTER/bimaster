import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  rrProdutoSchema,
  type RrProdutoInput,
  WF_VALUES,
  MARCAS,
} from "@/lib/validations/rr-produtos";
import { WF_FIELDS } from "@/lib/controladoria";
import {
  useCriarProduto,
  useEditarProduto,
} from "@/hooks/useRrProdutosMutations";
import { useRrLinhas, type RrProduto } from "@/hooks/useRrProdutos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: RrProduto | null;
}

const NULL_SENTINEL = "__none__";

function emptyWf(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  WF_FIELDS.forEach((f) => {
    out[f] = null;
  });
  return out;
}

function defaultValues(editing?: RrProduto | null): RrProdutoInput {
  if (!editing) {
    return {
      sku: "",
      nome_comercial: "",
      marca: null,
      categoria: null,
      status: null,
      linha_notion_id: null,
      composicao_pt: false,
      composicao_en: false,
      anvisa: null,
      ultima_revisao_regulatoria: null,
      wf: emptyWf(),
    };
  }
  const wf = { ...emptyWf(), ...(editing.wf ?? {}) };
  return {
    sku: editing.sku ?? "",
    nome_comercial: editing.nome_comercial ?? "",
    marca: editing.marca ?? null,
    categoria: editing.categoria ?? null,
    status: editing.status ?? null,
    linha_notion_id: editing.linha_notion_id ?? null,
    composicao_pt: !!editing.composicao_pt,
    composicao_en: !!editing.composicao_en,
    anvisa: editing.anvisa ?? null,
    ultima_revisao_regulatoria: editing.ultima_revisao_regulatoria ?? null,
    wf,
  };
}

export function ProdutoFormDialog({ open, onOpenChange, editingItem }: Props) {
  const { data: linhas } = useRrLinhas();
  const criar = useCriarProduto();
  const editar = useEditarProduto();
  const isPending = criar.isPending || editar.isPending;

  const form = useForm<RrProdutoInput>({
    resolver: zodResolver(rrProdutoSchema),
    defaultValues: defaultValues(editingItem),
  });

  useEffect(() => {
    form.reset(defaultValues(editingItem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingItem?.notion_page_id, open]);

  const onSubmit = (data: RrProdutoInput) => {
    if (editingItem) {
      editar.mutate(
        { notion_page_id: editingItem.notion_page_id, data },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      criar.mutate(data, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            {editingItem ? "Editar produto" : "Novo produto"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs defaultValue="geral" className="w-full">
              <div className="px-6 pt-3">
                <TabsList>
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="workflow">Workflow</TabsTrigger>
                  <TabsTrigger value="regulatorio">Regulatório</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="max-h-[60vh]">
                <TabsContent value="geral" className="px-6 py-4 space-y-4 mt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU *</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nome_comercial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome comercial *</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="marca"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marca</FormLabel>
                          <Select
                            value={field.value ?? NULL_SENTINEL}
                            onValueChange={(v) =>
                              field.onChange(v === NULL_SENTINEL ? null : v)
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NULL_SENTINEL}>—</SelectItem>
                              {MARCAS.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="categoria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value || null)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value || null)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="linha_notion_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Linha</FormLabel>
                          <Select
                            value={field.value ?? NULL_SENTINEL}
                            onValueChange={(v) =>
                              field.onChange(v === NULL_SENTINEL ? null : v)
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NULL_SENTINEL}>—</SelectItem>
                              {(linhas ?? []).map((l) => (
                                <SelectItem
                                  key={l.notion_page_id}
                                  value={l.notion_page_id}
                                >
                                  {l.nome ?? l.notion_page_id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent
                  value="workflow"
                  className="px-6 py-4 space-y-4 mt-0"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {WF_FIELDS.map((wfField) => (
                      <FormField
                        key={wfField}
                        control={form.control}
                        name={`wf.${wfField}` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{wfField}</FormLabel>
                            <Select
                              value={field.value ?? NULL_SENTINEL}
                              onValueChange={(v) =>
                                field.onChange(v === NULL_SENTINEL ? null : v)
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NULL_SENTINEL}>—</SelectItem>
                                {WF_VALUES.map((v) => (
                                  <SelectItem key={v} value={v}>
                                    {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent
                  value="regulatorio"
                  className="px-6 py-4 space-y-4 mt-0"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="composicao_pt"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Switch
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">
                            Composição PT preenchida
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="composicao_en"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Switch
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">
                            Composição EN preenchida
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="anvisa"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registro ANVISA</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value || null)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ultima_revisao_regulatoria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Última revisão regulatória</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value || null)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
