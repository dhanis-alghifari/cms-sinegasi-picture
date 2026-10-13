import { isIP } from 'node:net';

export interface ProxyTrustConfig {
  trustProxy: false | number;
  trustedProxyAddresses: readonly string[];
}

export type ProxyTrust = false | ((address: string, hop: number) => boolean);

function invalidConfiguration(): never {
  throw new Error('INVALID_PROXY_TRUST_CONFIGURATION');
}

/** Exact addresses only: no hostnames, CIDRs, zone IDs, wildcard or DNS lookup. */
function normalizeAddress(address: string): string {
  const version = isIP(address);
  if (version === 4) return address;
  if (version !== 6 || address.includes('%')) return invalidConfiguration();
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  // Node sockets may represent an IPv4 peer using IPv4-mapped IPv6.
  if (canonical.startsWith('::ffff:')) {
    const words = canonical.slice(7).split(':').map(word => Number.parseInt(word, 16));
    return [words[0] >>> 8, words[0] & 255, words[1] >>> 8, words[1] & 255].join('.');
  }
  return canonical;
}

/** Pure startup validation; a hop count alone can never enable header trust. */
export function parseProxyTrust(hops: string | undefined, addresses: string | undefined): ProxyTrustConfig {
  const count = (hops ?? '0').trim().toLowerCase();
  const raw = (addresses ?? '').trim();
  if (count === '0' || count === 'false' || count === '') {
    if (raw !== '' && raw !== 'none') return invalidConfiguration();
    return { trustProxy: false, trustedProxyAddresses: Object.freeze([]) };
  }
  if (!/^[1-4]$/.test(count) || raw.length > 256 || raw === '') return invalidConfiguration();
  const entries = raw.split(',');
  if (entries.length > 8) return invalidConfiguration();
  const normalized = entries.map(entry => {
    if (entry.trim() !== entry) return invalidConfiguration();
    const address = normalizeAddress(entry);
    if (address === '0.0.0.0' || address === '::' || address === '255.255.255.255') return invalidConfiguration();
    return address;
  });
  if (new Set(normalized).size !== normalized.length) return invalidConfiguration();
  return { trustProxy: Number(count), trustedProxyAddresses: Object.freeze(normalized) };
}

/** Validate BOTH the peer address and hop. Untrusted paths ignore forwarding metadata. */
export function createProxyTrust(config: ProxyTrustConfig): ProxyTrust {
  const policy = parseProxyTrust(String(config.trustProxy), config.trustedProxyAddresses.join(','));
  const hops = policy.trustProxy;
  if (hops === false) return false;
  const peers = new Set(policy.trustedProxyAddresses);
  return function trustProxy(address: string, hop: number): boolean {
    if (!Number.isInteger(hop) || hop < 0 || hop >= hops || !isIP(address) || address.includes('%')) return false;
    return peers.has(normalizeAddress(address));
  };
}
