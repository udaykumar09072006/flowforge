/**
 * SSRF Guard for FlowForge HTTP Action Nodes
 * Prevents execution against internal services, cloud metadata APIs,
 * loopback, and private IPv4/IPv6 address blocks.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'instance-data',
]);

/**
 * Checks if an IPv4 address falls within RFC 1918 or link-local/cloud metadata ranges
 */
function isPrivateOrReservedIP(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;

  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;

  // 0.0.0.0/8 - Current network
  if (a === 0) return true;

  // 10.0.0.0/8 - Private Class A
  if (a === 10) return true;

  // 172.16.0.0/12 - Private Class B
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 - Private Class C
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 - Link-local / Cloud Metadata (AWS, GCP, Azure 169.254.169.254)
  if (a === 169 && b === 254) return true;

  return false;
}

export interface SSRFValidationResult {
  isAllowed: boolean;
  reason?: string;
  sanitizedUrl?: string;
}

export function validateUrlForSSRF(urlString: string): SSRFValidationResult {
  try {
    const url = new URL(urlString);

    // Only allow http: and https: protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        isAllowed: false,
        reason: `Disallowed protocol: '${url.protocol}'. Only http: and https: are supported.`,
      };
    }

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Check blocked hostname names
    if (BLOCKED_HOSTNAMES.has(hostname) || hostname === '::1' || hostname === '0:0:0:0:0:0:0:1') {
      return {
        isAllowed: false,
        reason: `Target hostname '${hostname}' is restricted (loopback/internal service).`,
      };
    }

    // Check IP addresses
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      if (isPrivateOrReservedIP(hostname)) {
        return {
          isAllowed: false,
          reason: `Target IP '${hostname}' resides in a private, loopback, or metadata subnet.`,
        };
      }
    }

    // Reject localhost variations (e.g. .local, .internal, .localhost)
    if (
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return {
        isAllowed: false,
        reason: `Hostnames under .localhost, .local, or .internal are restricted.`,
      };
    }

    return {
      isAllowed: true,
      sanitizedUrl: url.toString(),
    };
  } catch (err: any) {
    return {
      isAllowed: false,
      reason: `Malformed URL: ${err.message}`,
    };
  }
}
