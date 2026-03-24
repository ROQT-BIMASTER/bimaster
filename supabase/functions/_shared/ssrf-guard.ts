// _shared/ssrf-guard.ts — SSRF protection (ADV-3)

const BLOCKED_PROTOCOLS = ["file:", "gopher:", "dict:", "ftp:", "data:", "javascript:"];

// Private/internal IP ranges in CIDR notation
const PRIVATE_RANGES = [
  { prefix: "10.", mask: 8 },
  { prefix: "172.16.", mask: 12 },
  { prefix: "172.17.", mask: 12 },
  { prefix: "172.18.", mask: 12 },
  { prefix: "172.19.", mask: 12 },
  { prefix: "172.20.", mask: 12 },
  { prefix: "172.21.", mask: 12 },
  { prefix: "172.22.", mask: 12 },
  { prefix: "172.23.", mask: 12 },
  { prefix: "172.24.", mask: 12 },
  { prefix: "172.25.", mask: 12 },
  { prefix: "172.26.", mask: 12 },
  { prefix: "172.27.", mask: 12 },
  { prefix: "172.28.", mask: 12 },
  { prefix: "172.29.", mask: 12 },
  { prefix: "172.30.", mask: 12 },
  { prefix: "172.31.", mask: 12 },
  { prefix: "192.168.", mask: 16 },
  { prefix: "169.254.", mask: 16 },
  { prefix: "127.", mask: 8 },
  { prefix: "0.", mask: 8 },
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "169.254.169.254", // AWS/GCP metadata
  "[::1]",
];

const BLOCKED_DOMAIN_SUFFIXES = [
  ".internal",
  ".local",
  ".localhost",
];

/**
 * Validate that a URL is safe to fetch (not internal/private).
 * Throws SSRFError if the URL targets internal resources.
 */
export function validateExternalUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SSRFError(`URL inválida: ${url}`);
  }

  // Only allow http and https
  if (parsed.protocol !== "https:") {
    throw new SSRFError(`Protocolo não permitido: ${parsed.protocol}. Apenas HTTPS é aceito.`);
  }

  // Block non-https in production for safety
  // (allow http for dev flexibility but warn)

  const hostname = parsed.hostname.toLowerCase();

  // Block known dangerous hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new SSRFError(`Hostname bloqueado: ${hostname}`);
  }

  // Block internal domain suffixes
  for (const suffix of BLOCKED_DOMAIN_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      throw new SSRFError(`Domínio interno bloqueado: ${hostname}`);
    }
  }

  // Block private IP ranges
  for (const range of PRIVATE_RANGES) {
    if (hostname.startsWith(range.prefix)) {
      throw new SSRFError(`IP privado bloqueado: ${hostname}`);
    }
  }

  // Block IPv6 loopback
  if (hostname === "[::1]" || hostname === "::1") {
    throw new SSRFError(`IP loopback bloqueado: ${hostname}`);
  }

  // Block supabase.co (except own project)
  const ownProjectRef = Deno.env.get("SUPABASE_URL")?.match(/https:\/\/([^.]+)\./)?.[1];
  if (hostname.endsWith(".supabase.co") && !hostname.startsWith(ownProjectRef || "__none__")) {
    throw new SSRFError(`Acesso a projetos Supabase externos bloqueado: ${hostname}`);
  }
}

export class SSRFError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "SSRFError";
  }
}
