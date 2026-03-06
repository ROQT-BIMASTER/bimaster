declare module "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs" {
  const mermaid: {
    initialize: (config: any) => void;
    render: (id: string, code: string) => Promise<{ svg: string }>;
  };
  export default mermaid;
}
