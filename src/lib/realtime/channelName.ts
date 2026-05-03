/**
 * Helper para gerar nomes únicos de canal Realtime.
 *
 * O cliente Realtime do Supabase **reutiliza canais com o mesmo topic**
 * (ver supabase-js > realtime channel(topic)). Quando dois componentes
 * montam ao mesmo tempo com o mesmo nome (ou em React StrictMode), a
 * segunda chamada a `.on('postgres_changes', ...)` ocorre depois do
 * `subscribe()` da primeira instância e dispara:
 *
 *   "cannot add `postgres_changes` callbacks for realtime:<topic> after `subscribe()`"
 *
 * Sempre que um hook/página chamar `supabase.channel(...)`, use
 * `uniqueChannelName(prefix)` para garantir um topic exclusivo por instância.
 */
export function uniqueChannelName(prefix: string): string {
  let id: string;
  try {
    id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
  } catch {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return `${prefix}:${id}`;
}
