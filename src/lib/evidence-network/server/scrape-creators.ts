import type {
  EvidenceDiscoveryInput,
  EvidenceDiscoveryPlatform,
  ProductQuestionInput,
} from '../model';

const scrapeCreatorsOrigin = 'https://api.scrapecreators.com';
const maximumLeadsPerPlatform = 2;

type DiscoveryFetch = (url: string, init: RequestInit) => Promise<Response>;

interface SearchDependencies {
  readonly apiKey: string | undefined;
  readonly fetchImpl?: DiscoveryFetch;
}

interface PlatformSearchResult {
  readonly platform: Exclude<EvidenceDiscoveryPlatform, 'web'>;
  readonly ok: boolean;
  readonly data: unknown;
  readonly warning: string | null;
}

interface RecordValue {
  readonly [key: string]: unknown;
}

interface DiscoveryLead {
  readonly platform: Exclude<EvidenceDiscoveryPlatform, 'web'>;
  readonly title: string;
  readonly url: string;
  readonly summary: string;
  readonly creatorLabel: string;
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nestedRecord(value: RecordValue, key: string): RecordValue | null {
  const candidate = value[key];
  return isRecord(candidate) ? candidate : null;
}

function creatorName(value: RecordValue, ...fields: readonly string[]): string | null {
  for (const field of fields) {
    const candidate = stringValue(value[field]);
    if (candidate !== null) {
      return candidate.replace(/^@/, '');
    }
  }
  return null;
}

function summarize(caption: string | null): string {
  const metadata =
    caption === null ? 'No caption was returned.' : `Search metadata: “${caption.slice(0, 220)}”.`;
  return `${metadata} Candidate only; the video has not been reviewed against the question.`;
}

function canonicalSocialUrl(
  platform: Exclude<EvidenceDiscoveryPlatform, 'web'>,
  raw: unknown,
): string | null {
  const value = stringValue(raw);
  if (value === null) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  const validHost =
    platform === 'tiktok'
      ? hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')
      : platform === 'instagram'
        ? hostname === 'instagram.com' || hostname.endsWith('.instagram.com')
        : hostname === 'youtube.com' ||
          hostname.endsWith('.youtube.com') ||
          hostname === 'youtu.be';
  if (!validHost) {
    return null;
  }
  url.hash = '';
  if (platform !== 'youtube') {
    url.search = '';
  }
  return url.toString();
}

function parseTikTok(data: unknown): readonly DiscoveryLead[] {
  if (!isRecord(data) || !Array.isArray(data.search_item_list)) {
    return [];
  }
  const leads: DiscoveryLead[] = [];
  for (const rawItem of data.search_item_list) {
    if (!isRecord(rawItem)) {
      continue;
    }
    const item = nestedRecord(rawItem, 'aweme_info') ?? rawItem;
    if (item.is_ad === true || item.is_paid_partnership === true) {
      continue;
    }
    const url = canonicalSocialUrl('tiktok', item.url);
    if (url === null) {
      continue;
    }
    const author = nestedRecord(item, 'author');
    const authorName = author === null ? null : creatorName(author, 'unique_id', 'nickname');
    const caption = stringValue(item.desc);
    leads.push({
      platform: 'tiktok',
      title:
        caption?.slice(0, 160) ?? `TikTok video${authorName === null ? '' : ` by @${authorName}`}`,
      url,
      summary: summarize(caption),
      creatorLabel: authorName === null ? 'TikTok publisher' : `TikTok · @${authorName}`,
    });
  }
  return leads;
}

function parseInstagram(data: unknown): readonly DiscoveryLead[] {
  if (!isRecord(data) || !Array.isArray(data.reels)) {
    return [];
  }
  const leads: DiscoveryLead[] = [];
  for (const rawItem of data.reels) {
    if (!isRecord(rawItem)) {
      continue;
    }
    if (
      rawItem.is_ad === true ||
      rawItem.is_affiliate === true ||
      rawItem.is_paid_partnership === true
    ) {
      continue;
    }
    const shortcode = stringValue(rawItem.shortcode);
    const fallbackUrl =
      shortcode === null
        ? null
        : `https://www.instagram.com/reel/${encodeURIComponent(shortcode)}/`;
    const url = canonicalSocialUrl('instagram', rawItem.url ?? fallbackUrl);
    if (url === null) {
      continue;
    }
    const owner = nestedRecord(rawItem, 'owner');
    const authorName = owner === null ? null : creatorName(owner, 'username', 'full_name');
    const caption = stringValue(rawItem.caption);
    leads.push({
      platform: 'instagram',
      title:
        caption?.slice(0, 160) ??
        `Instagram Reel${authorName === null ? '' : ` by @${authorName}`}`,
      url,
      summary: summarize(caption),
      creatorLabel: authorName === null ? 'Instagram publisher' : `Instagram · @${authorName}`,
    });
  }
  return leads;
}

function youtubeItems(data: RecordValue): readonly unknown[] {
  const direct = [data.videos, data.shorts].flatMap((value) => (Array.isArray(value) ? value : []));
  const shelves = Array.isArray(data.shelves) ? data.shelves : [];
  const shelfItems = shelves.flatMap((shelf) => {
    if (!isRecord(shelf) || !Array.isArray(shelf.items)) {
      return [];
    }
    return shelf.items;
  });
  return [...direct, ...shelfItems];
}

function parseYouTube(data: unknown): readonly DiscoveryLead[] {
  if (!isRecord(data)) {
    return [];
  }
  const leads: DiscoveryLead[] = [];
  for (const rawItem of youtubeItems(data)) {
    if (!isRecord(rawItem)) {
      continue;
    }
    const id = stringValue(rawItem.id);
    const rawUrl = rawItem.url ?? (id === null ? null : `https://www.youtube.com/watch?v=${id}`);
    const url = canonicalSocialUrl('youtube', rawUrl);
    if (url === null) {
      continue;
    }
    const channel = nestedRecord(rawItem, 'channel');
    const authorName = channel === null ? null : creatorName(channel, 'title', 'handle');
    const title = stringValue(rawItem.title);
    leads.push({
      platform: 'youtube',
      title: title?.slice(0, 160) ?? 'YouTube product video',
      url,
      summary: summarize(title),
      creatorLabel: authorName === null ? 'YouTube publisher' : `YouTube · ${authorName}`,
    });
  }
  return leads;
}

function uniqueLeads(leads: readonly DiscoveryLead[]): readonly DiscoveryLead[] {
  const urls = new Set<string>();
  return leads.filter(({ url }) => {
    if (urls.has(url)) {
      return false;
    }
    urls.add(url);
    return true;
  });
}

function interleave(
  platformLists: readonly (readonly DiscoveryLead[])[],
): readonly DiscoveryLead[] {
  const output: DiscoveryLead[] = [];
  for (let index = 0; index < maximumLeadsPerPlatform; index += 1) {
    for (const list of platformLists) {
      const lead = list[index];
      if (lead !== undefined) {
        output.push(lead);
      }
    }
  }
  return uniqueLeads(output);
}

export function buildEvidenceSearchQuery(input: ProductQuestionInput): string {
  const questionTerms = input.question
    .replace(/[?!.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${input.productName} ${questionTerms}`.slice(0, 420);
}

async function searchPlatform(
  platform: Exclude<EvidenceDiscoveryPlatform, 'web'>,
  path: string,
  apiKey: string,
  fetchImpl: DiscoveryFetch,
): Promise<PlatformSearchResult> {
  try {
    const response = await fetchImpl(`${scrapeCreatorsOrigin}${path}`, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      return {
        platform,
        ok: false,
        data: null,
        warning: `${platform} search returned HTTP ${response.status}.`,
      };
    }
    return { platform, ok: true, data: await response.json(), warning: null };
  } catch {
    return {
      platform,
      ok: false,
      data: null,
      warning: `${platform} search was temporarily unreachable.`,
    };
  }
}

export async function searchScrapeCreatorsEvidence(
  input: ProductQuestionInput,
  dependencies: SearchDependencies,
): Promise<EvidenceDiscoveryInput> {
  const query = buildEvidenceSearchQuery(input);
  const apiKey = dependencies.apiKey?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    return {
      provider: 'scrapecreators',
      status: 'unavailable',
      query,
      searchedPlatforms: [],
      warnings: ['Live social search is not configured on this deployment.'],
      leads: [],
    };
  }
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const encodedQuery = encodeURIComponent(query);
  const results = await Promise.all([
    searchPlatform(
      'tiktok',
      `/v1/tiktok/search/keyword?query=${encodedQuery}&sort_by=relevance&trim=true`,
      apiKey,
      fetchImpl,
    ),
    searchPlatform(
      'instagram',
      `/v2/instagram/reels/search?query=${encodedQuery}&page=1`,
      apiKey,
      fetchImpl,
    ),
    searchPlatform(
      'youtube',
      `/v1/youtube/search?query=${encodedQuery}&sortBy=relevance&includeExtras=false`,
      apiKey,
      fetchImpl,
    ),
  ]);
  const successful = results.filter(({ ok }) => ok);
  const warnings = results.flatMap(({ warning }) => (warning === null ? [] : [warning]));
  const byPlatform = new Map(results.map((result) => [result.platform, result.data]));
  const leads = interleave([
    parseTikTok(byPlatform.get('tiktok')).slice(0, maximumLeadsPerPlatform),
    parseInstagram(byPlatform.get('instagram')).slice(0, maximumLeadsPerPlatform),
    parseYouTube(byPlatform.get('youtube')).slice(0, maximumLeadsPerPlatform),
  ]);

  return {
    provider: 'scrapecreators',
    status:
      successful.length === results.length
        ? 'complete'
        : successful.length === 0
          ? 'unavailable'
          : 'partial',
    query,
    searchedPlatforms: successful.map(({ platform }) => platform),
    warnings,
    leads: [...leads],
  };
}
