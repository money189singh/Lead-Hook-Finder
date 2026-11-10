/**
 * Domain and Website Detection Utility for AI Prospect Discovery
 * Isolates official company websites from aggregators, social platforms, and directories.
 */

const BLOCKED_DOMAINS = new Set([
  // Social media & Video
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'youtube.com',
  'pinterest.com',
  'tiktok.com',
  'reddit.com',
  'quora.com',

  // Directory / review / aggregator sites
  'g2.com',
  'capterra.com',
  'trustradius.com',
  'yelp.com',
  'yellowpages.com',
  'crunchbase.com',
  'zoominfo.com',
  'apollo.io',
  'pitchbook.com',
  'owler.com',
  'glassdoor.com',
  'indeed.com',
  'builtin.com',
  'craft.co',
  'clutch.co',
  'upcity.com',
  'goodfirms.co',
  'softwareadvice.com',
  'getapp.com',
  'saashub.com',
  'growthlist.co',
  'failory.com',
  'latka.com',
  'getlatka.com',
  'tracxn.com',
  'dealroom.co',
  'seedtable.com',
  'producthunt.com',
  'betalist.com',
  'topstartups.io',
  'saasworthy.com',
  'saasgenius.com',
  'sourceforge.net',
  'softwareworld.co',
  'welcometothejungle.com',
  'ycombinator.com',

  // General content / news / media / publications
  'wikipedia.org',
  'medium.com',
  'github.com',
  'gitlab.com',
  'substack.com',
  'wordpress.com',
  'wix.com',
  'squarespace.com',
  'google.com',
  'bing.com',
  'yahoo.com',
  'duckduckgo.com',
  'microsoft.com',
  'apple.com',
  'amazon.com',
  'forbes.com',
  'bloomberg.com',
  'techcrunch.com',
  'businesswire.com',
  'prnewswire.com',
  'globenewswire.com',
  'reuters.com',
  'wsj.com',
  'nytimes.com',
  'cnbc.com',
  'venturebeat.com',
  'slashdot.org',
  'hackernoon.com',
  'indiehackers.com',
  'inc.com',
  'entrepreneur.com',
  'fastcompany.com',
  'hubspot.com',
  'zapier.com',
  'salesforce.com',

  // Dictionaries, Encyclopedias, General Reference & K-12 Educational
  'cambridge.org',
  'dictionary.cambridge.org',
  'merriam-webster.com',
  'dictionary.com',
  'thefreedictionary.com',
  'collinsdictionary.com',
  'wiktionary.org',
  'britannica.com',
  'vocabulary.com',
  'urbandictionary.com',
  'splashlearn.com',
  'khanacademy.org',
  'quizlet.com',
  'brainly.com',
  'chegg.com',
  'mathisfun.com',
  'ixl.com',
  'coursera.org',
  'edx.org',
  'udemy.com',
  'byjus.com',
  'vedantu.com',
  'cuemath.com',

  // Government & Global Statistical Repositories
  'statista.com',
  'tradingeconomics.com',
  'singstat.gov.sg',
  'worldbank.org',
  'census.gov',
  'bls.gov',
  'sec.gov',
  'gov.uk',
  'data.gov',
]);

/**
 * Regex matching listicle and article titles or slugs
 */
export const LISTICLE_PATTERNS = [
  /\b(top\s*\d+|\d+\s*top|\d+\s*best|best\s*\d+)\b/i,
  /\b(\d+\s*(fastest|growing|promising|hottest|leading|successful|innovative|funded|popular)\b)/i,
  /\b(\d+\s*(saas|startups|companies|tools|apps|platforms|businesses))\b/i,
  /\b(list\s+of|directory\s+of|overview\s+of|guide\s+to|roundup|ranking|rankings|market\s+map|ecosystem|cheat\s*sheet|cheat-sheet|cheat\s+sheet)\b/i,
  /\b(alternatives\s+to|vs\b|review\b|reviews\b|landscape\b|annual\s+report|index\b|database\b|report\b)\b/i,
  /\b(companies\s+in|startups\s+in|saas\s+in|software\s+in)\b/i,
  /\b(must[\s\-]have|best[\s\-]in[\s\-]class|to\s+watch|who\s+are\s+the)\b/i,
];

/**
 * Checks if a string (title or potential name) is an article/listicle headline rather than a company name
 */
export function isArticleOrListicleTitle(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  for (const pattern of LISTICLE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

/**
 * Validates that an extracted string is an actual candidate company name
 * Rejects headlines, slogans, sentences, generic categories, and article phrases
 */
export function isInvalidCompanyName(rawName: string, directorySourceDomain?: string): boolean {
  if (!rawName) return true;
  const name = rawName.trim();

  // Too short or unreasonably long for a company name
  if (name.length < 2 || name.length > 50) return true;

  // Rejection of purely numeric or measurement tokens (e.g. "59", "492", "102", "23%", "$10M")
  if (/^[\d\s,.\-#%$/]+$/.test(name)) return true;

  // Must have at least two alphabetic characters
  const letters = name.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 2) return true;

  // Single common dictionary or generic words that are never stand-alone company names
  const singleGenericWords = new Set([
    'top', 'best', 'more', 'base', 'data', 'key', 'overview', 'summary', 'introduction',
    'conclusion', 'meaning', 'definition', 'pronunciation', 'synonyms', 'examples', 'english',
    'grammar', 'dictionary', 'thesaurus', 'translate', 'indicators', 'statistics', 'economy',
    'index', 'report', 'archive', 'update', 'status', 'news', 'press', 'media', 'privacy',
    'terms', 'cookie', 'legal', 'home', 'back', 'next', 'previous', 'all', 'menu', 'search'
  ]);
  if (singleGenericWords.has(name.toLowerCase())) return true;

  // Ends with sentence punctuation (e.g. "The story behind the progress.") -> Slogan or sentence, NOT a company
  if (/[.!?]$/.test(name)) return true;

  // More than 4 words without corporate designation is almost certainly an article headline, slogan, or sentence
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 4) {
    const hasCorpSuffix = /\b(Inc|LLC|Ltd|Corp|Corporation|Co|GmbH|Technologies|Software|Solutions|Systems|Labs|Platform|AI|Tech)\b/i.test(name);
    if (!hasCorpSuffix) {
      return true;
    }
  }

  // Check against listicle / article patterns
  if (isArticleOrListicleTitle(name)) return true;

  // Media, video streaming, and download phrases
  if (/\b(trending|video|videos|popular|watch|trailer|stream|playlist|episodes?|season|subscribe|channel|download)\b/i.test(name)) return true;

  // Adult, spam, gambling, or piracy terms
  if (/\b(bokep|porn|xxx|adult|escort|casino|slot|betting|gambling|torrent|warez)\b/i.test(name)) return true;

  const lower = name.toLowerCase();

  // Rejection of sentence / slogan starters and phrases
  const sentenceStarters = [
    'the story behind',
    'how to',
    'why we',
    'what is',
    'read the',
    'read about',
    'go inside',
    'inside the',
    'a future defined',
    'carrying five decades',
    'turn your data',
    'learn how',
    'discover the',
    'our mission',
    'empowering',
    'transforming',
    'building the',
    'unlocking the',
    'accelerating',
    'delivering',
    'find out',
    'see how',
    'join us',
    'welcome to',
  ];

  for (const starter of sentenceStarters) {
    if (lower.startsWith(starter)) {
      return true;
    }
  }

  // Common sentence grammatical constructs that never appear in company names
  if (/\b(behind the|into a|defined by|for real|of the|on how|part of|help you|helps you|turning data)\b/i.test(lower)) {
    return true;
  }

  // Rejection of common navigational / article sections
  const rejectedKeywords = [
    'conclusion',
    'summary',
    'introduction',
    'table of contents',
    'frequently asked',
    'methodology',
    'criteria',
    'key takeaway',
    'takeaways',
    'sponsored',
    'advertisement',
    'about us',
    'contact us',
    'privacy policy',
    'terms of service',
    'pricing',
    'features',
    'product',
    'home',
    'overview',
    'read more',
    'learn more',
    'click here',
    'visit website',
    'sign up',
    'get started',
    'login',
    'blog',
    'articles',
    'directory',
    'resources',
    'all companies',
    'saas startups',
    'b2b saas',
    'software companies',
    'tech companies',
    'cloud companies',
  ];

  for (const kw of rejectedKeywords) {
    if (lower === kw || lower.startsWith(`${kw} `) || lower.endsWith(` ${kw}`)) {
      return true;
    }
  }

  // If candidate name matches a known publisher / directory (e.g. Forbes, Medium, Built In, Crunchbase)
  if (directorySourceDomain && isAggregatorOrSocial(directorySourceDomain)) {
    const domainPart = directorySourceDomain.split('.')[0].toLowerCase();
    if (lower.replace(/[^a-z0-9]/g, '') === domainPart) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a URL points to an article, blog post, or directory page rather than a root company website
 */
export function isArticleUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();

    // Clean homepage or root
    if (pathname === '/' || pathname === '' || pathname === '/index.html') {
      return false;
    }

    const articlePathRegex =
      /\/(blog|blogs|article|articles|news|posts|post|top-|best-|list-|companies-|startups-|ranking|directory|roundup|guides|guide|alternatives|reviews|review|reports|report|insights|stories|collection|tag|category|p)\b/i;

    if (articlePathRegex.test(pathname)) {
      return true;
    }

    // Path segments with listicle slugs (e.g. /2024/05/top-100-saas)
    if (isArticleOrListicleTitle(pathname)) {
      return true;
    }

    // Path segments with date stamps (e.g. /2024/05/top-startups)
    if (/\/(19|20)\d{2}\/\d{2}\//.test(pathname)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Normalizes URL into clean domain (e.g. "https://www.example.com/about?x=1" -> "example.com")
 */
export function extractCleanDomain(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    return host;
  } catch {
    // Regex fallback
    const match = rawUrl.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return match ? match[1].toLowerCase() : '';
  }
}

/**
 * Checks if a domain is a non-company aggregator, directory, or social media site
 */
export function isAggregatorOrSocial(domainOrUrl: string): boolean {
  const domain = extractCleanDomain(domainOrUrl);
  if (!domain) return true;

  // Filter out adult, spam, betting, and piracy domains
  const SPAM_ADULT_PATTERN = /(bokep|porn|xxx|adult|escort|camgirl|casino|poker|slot88|slot777|betting|gambling|warez|torrent|pirate|apkpure|mp3download)/i;
  if (SPAM_ADULT_PATTERN.test(domain) || SPAM_ADULT_PATTERN.test(domainOrUrl)) {
    return true;
  }

  // Direct check
  if (BLOCKED_DOMAINS.has(domain)) return true;

  // Subdomain check (e.g. uk.linkedin.com)
  for (const blocked of BLOCKED_DOMAINS) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Cleans extracted company name by stripping common noise words and corporate designations
 */
export function cleanCompanyName(rawName: string, domain?: string): string {
  if (!rawName) {
    if (domain) {
      const parts = domain.split('.');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return '';
  }

  let cleaned = rawName.trim();

  // Strip page title suffixes like "| Home", "- Official Website", " - Pricing"
  cleaned = cleaned.split(/[\-\|–—:•]/)[0].trim();

  // Strip unclosed parenthesis or trailing bracket (e.g. "Company (CPUs" -> "Company")
  cleaned = cleaned.replace(/\([^\)]*$/, '').replace(/\[[^\]]*$/, '').trim();

  // Strip common corporate suffixes cleanly (with or without trailing dot)
  cleaned = cleaned.replace(/\b(Inc|LLC|Ltd|Corp|Corporation|Co|GmbH|Pvt|Limited)\b\.?/gi, '').trim();

  // Remove leading/trailing quotes and punctuation (like trailing periods or dashes)
  cleaned = cleaned.replace(/^[^\w]+|[^\w]+$/g, '').trim();

  if (!cleaned && domain) {
    const parts = domain.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }

  return cleaned;
}

/**
 * Generates deduplication key for companies (primary: normalized domain; secondary: sanitized name)
 */
export function getCompanyDedupKey(companyName: string, domain: string): string {
  const cleanDom = extractCleanDomain(domain);
  if (cleanDom) {
    return `dom:${cleanDom}`;
  }
  const cleanName = cleanCompanyName(companyName).toLowerCase().replace(/[^a-z0-9]/g, '');
  return `name:${cleanName}`;
}
