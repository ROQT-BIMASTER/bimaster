import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChinaPageShell } from "@/components/china/ChinaPageShell";
import { ChinaPageHeader } from "@/components/china/ChinaPageHeader";
import { Button } from "@/components/ui/button";
import { Inbox, Plus } from "lucide-react";
import { InboxFolderList } from "@/components/compras/inbox/InboxFolderList";
import { InboxOCList } from "@/components/compras/inbox/InboxOCList";
import { InboxOCReader } from "@/components/compras/inbox/InboxOCReader";
import { NovaOCDialog } from "@/components/compras/inbox/NovaOCDialog";
import { CatalogoChinaPanel } from "@/components/compras/inbox/CatalogoChinaPanel";
import { SubmissoesAprovadasPanel } from "@/components/compras/inbox/SubmissoesAprovadasPanel";
import { PatioEmbarquePanel } from "@/components/compras/inbox/PatioEmbarquePanel";
import { TorreContainersPanel } from "@/components/compras/inbox/TorreContainersPanel";
import {
  useCompradorInboxOCs,
  inboxFolderCounts,
  folderMatches,
  type InboxFolder,
} from "@/hooks/useCompradorInboxOCs";

const STORAGE_KEY = "bm.compras.inbox.state";

export default function CompradorInbox() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const initial = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  })();

  const [folder, setFolder] = useState<InboxFolder>((initial.folder as InboxFolder) || "todas");
  const [search, setSearch] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);
  const selectedId = params.get("oc");

  const { data: items = [], isLoading } = useCompradorInboxOCs();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ folder }));
  }, [folder]);

  const counts = useMemo(() => inboxFolderCounts(items), [items]);

  const filtered = useMemo(() => {
    let list = items.filter((o) => folderMatches(o, folder));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.numero_oc.toLowerCase().includes(q) ||
          o.produto_nome.toLowerCase().includes(q) ||
          o.produto_codigo.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, folder, search]);

  const selected = items.find((o) => o.ordem_compra_id === selectedId) || null;

  const handleSelect = (id: string) => {
    const np = new URLSearchParams(params);
    np.set("oc", id);
    setParams(np, { replace: true });
  };

  return (
    <ChinaPageShell>
      <div className="flex items-center justify-between gap-3">
        <ChinaPageHeader
          icon={Inbox}
          iconTone="primary"
          titlePt="Inbox do Comprador"
          titleCn="采购员收件箱"
          subtitle="Brasil — criação de OC, produção, embarque, trânsito e desembaraço"
        />
        <Button onClick={() => setNovaOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nova OC
        </Button>
      </div>

      {folder === "catalogo" || folder === "submissoes" ? (
        <div className="grid grid-cols-[220px_1fr] gap-0 border rounded-xl overflow-hidden bg-card h-[calc(100vh-220px)] min-h-[560px]">
          <div className="border-r bg-muted/20">
            <InboxFolderList active={folder} onSelect={setFolder} counts={counts} />
          </div>
          <div className="bg-background overflow-hidden">
            {folder === "catalogo" ? (
              <CatalogoChinaPanel onCreated={() => qc.invalidateQueries({ queryKey: ["comprador-inbox-ocs"] })} />
            ) : (
              <SubmissoesAprovadasPanel onCreated={() => qc.invalidateQueries({ queryKey: ["comprador-inbox-ocs"] })} />
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[220px_360px_1fr] gap-0 border rounded-xl overflow-hidden bg-card h-[calc(100vh-220px)] min-h-[560px]">
          <div className="border-r bg-muted/20">
            <InboxFolderList active={folder} onSelect={setFolder} counts={counts} />
          </div>
          <div className="border-r">
            <InboxOCList
              items={filtered}
              selectedId={selectedId}
              onSelect={handleSelect}
              search={search}
              onSearchChange={setSearch}
              isLoading={isLoading}
            />
          </div>
          <div className="bg-background overflow-hidden">
            <InboxOCReader oc={selected} />
          </div>
        </div>
      )}

      <NovaOCDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["comprador-inbox-ocs"] })}
      />
    </ChinaPageShell>
  );
}
