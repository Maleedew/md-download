import dns from "node:dns/promises";
import net from "node:net";
import { config } from "./config.js";
import { UserError } from "./errors.js";

const MAX_URL_LENGTH = 2048;

/** Validate + normalise what the user pasted. Adds https:// when the scheme is missing. */
export function parseUrl(input: unknown): URL {
  if (typeof input !== "string" || !input.trim()) {
    throw new UserError("Please paste a video link.");
  }
  let raw = input.trim();
  if (raw.length > MAX_URL_LENGTH) throw new UserError("That link is too long.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UserError("That doesn't look like a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UserError("Only http(s) links are supported.");
  }
  if (url.username || url.password) {
    throw new UserError("Links with embedded credentials are not allowed.");
  }
  if (!url.hostname.includes(".") && !net.isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
    throw new UserError("That doesn't look like a valid link.");
  }
  return url;
}

/** Address ranges that must never be reachable from a public downloader (SSRF protection). */
const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv6");
}

export function isPrivateAddress(ip: string): boolean {
  const family = net.isIPv6(ip) ? "ipv6" : "ipv4";
  return blocked.check(ip, family);
}

/** Resolve the hostname and refuse anything that points at a private / internal address. */
export async function assertPublicHost(url: URL): Promise<void> {
  if (config.allowPrivateHosts) return;

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new UserError("That address isn't allowed.");
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new UserError("That address isn't allowed.");
    return;
  }

  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new UserError("Couldn't find that website. Check the link and try again.");
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new UserError("That address isn't allowed.");
  }
}
