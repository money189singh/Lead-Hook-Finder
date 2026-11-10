import { CompanyActivityItem } from '../../src/types';

export interface RawActivityCandidate {
  title: string;
  snippet: string;
  url: string;
  publishedDate?: string;
}

export type ActivityCategory =
  | 'hiring'
  | 'expansion'
  | 'partnership'
  | 'leadership_change'
  | 'announcement'
  | 'funding'
  | 'general_news';

/**
 * Parses publication dates from search snippet texts or metadata.
 * Detects patterns like:
 * - "2 days ago", "3 hours ago", "yesterday", "5 weeks ago"
 * - "Jan 15, 2026", "September 2026", "2026-08-12", "15 Mar 2026"
 */
export function extractPublicationDate(snippet: string, explicitDate?: string): string | undefined {
  if (explicitDate && explicitDate.trim()) {
    return explicitDate.trim();
  }

  const text = snippet.trim();

  // Pattern 1: Relative dates e.g. "2 days ago", "3 hours ago", "yesterday"
  const relativeMatch = text.match(/\b(\d+)\s+(day|days|hour|hours|week|weeks|month|months)\s+ago\b/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const d = new Date();
    if (unit.startsWith('hour')) {
      d.setHours(d.getHours() - amount);
    } else if (unit.startsWith('day')) {
      d.setDate(d.getDate() - amount);
    } else if (unit.startsWith('week')) {
      d.setDate(d.getDate() - amount * 7);
    } else if (unit.startsWith('month')) {
      d.setMonth(d.getMonth() - amount);
    }
    return d.toISOString().split('T')[0];
  }

  if (/\byesterday\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  // Pattern 2: ISO dates: 2025-10-14, 2026-01-20
  const isoMatch = text.match(/\b(202[3-7])[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Pattern 3: Month Day, Year: "Jan 12, 2026", "September 15, 2025"
  const monthNames = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
  const monthDayYearMatch = text.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2}),?\\s+(202[3-7])\\b`, 'i'));
  if (monthDayYearMatch) {
    try {
      const parsed = new Date(`${monthDayYearMatch[1]} ${monthDayYearMatch[2]}, ${monthDayYearMatch[3]}`);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {}
  }

  // Pattern 4: Month Year: "August 2026"
  const monthYearMatch = text.match(new RegExp(`\\b(${monthNames})\\s+(202[3-7])\\b`, 'i'));
  if (monthYearMatch) {
    return `${monthYearMatch[1]} ${monthYearMatch[2]}`;
  }

  return undefined;
}

/**
 * Classifies candidate text into a distinct business activity category
 */
export function classifyActivityCategory(title: string, snippet: string): ActivityCategory {
  const combined = `${title} ${snippet}`.toLowerCase();

  // Leadership Changes
  if (
    combined.includes('named ceo') ||
    combined.includes('appointed ceo') ||
    combined.includes('new ceo') ||
    combined.includes('appoints') ||
    combined.includes('names new') ||
    combined.includes('promoted to') ||
    combined.includes('joins as') ||
    combined.includes('leadership team') ||
    combined.includes('board of directors') ||
    combined.includes('executive director') ||
    combined.includes('chief executive') ||
    combined.includes('chief revenue') ||
    combined.includes('chief marketing') ||
    combined.includes('chief technology') ||
    combined.includes('vp of') ||
    combined.includes('vice president')
  ) {
    return 'leadership_change';
  }

  // Funding & Investment
  if (
    combined.includes('raises') ||
    combined.includes('raised') ||
    combined.includes('funding round') ||
    combined.includes('series a') ||
    combined.includes('series b') ||
    combined.includes('series c') ||
    combined.includes('seed round') ||
    combined.includes('secures $') ||
    combined.includes('closes $') ||
    combined.includes('million in funding') ||
    combined.includes('capital raise') ||
    combined.includes('growth investment') ||
    combined.includes('venture capital')
  ) {
    return 'funding';
  }

  // Hiring & Team Growth
  if (
    combined.includes('hiring') ||
    combined.includes('we are hiring') ||
    combined.includes('expanding team') ||
    combined.includes('open positions') ||
    combined.includes('job openings') ||
    combined.includes('careers at') ||
    combined.includes('doubling headcount') ||
    combined.includes('new hires') ||
    combined.includes('growing headcount')
  ) {
    return 'hiring';
  }

  // Partnerships & Alliances
  if (
    combined.includes('partners with') ||
    combined.includes('partnership with') ||
    combined.includes('teams up with') ||
    combined.includes('collaborates with') ||
    combined.includes('strategic alliance') ||
    combined.includes('announces partnership') ||
    combined.includes('joins forces with') ||
    combined.includes('integrates with')
  ) {
    return 'partnership';
  }

  // Expansion & Growth
  if (
    combined.includes('expands into') ||
    combined.includes('opens new office') ||
    combined.includes('new location') ||
    combined.includes('global expansion') ||
    combined.includes('market expansion') ||
    combined.includes('expanding footprint') ||
    combined.includes('new headquarters') ||
    combined.includes('relocates to')
  ) {
    return 'expansion';
  }

  // Product Announcements & Launches
  if (
    combined.includes('announces') ||
    combined.includes('launches') ||
    combined.includes('launched') ||
    combined.includes('unveils') ||
    combined.includes('introduces') ||
    combined.includes('releases new') ||
    combined.includes('platform launch') ||
    combined.includes('feature release') ||
    combined.includes('new product')
  ) {
    return 'announcement';
  }

  return 'general_news';
}

/**
 * Extracts and normalizes structured company activities from search results
 */
export function extractActivitiesFromSearchResults(
  companyName: string,
  results: { title: string; snippet: string; url: string; date?: string }[]
): CompanyActivityItem[] {
  const activities: CompanyActivityItem[] = [];
  const seenTitles = new Set<string>();

  for (const res of results) {
    if (!res.title || !res.url) continue;

    // Filter out generic company homepages or policy pages
    const lowerTitle = res.title.toLowerCase();
    if (
      lowerTitle === 'home' ||
      lowerTitle.includes('terms of') ||
      lowerTitle.includes('privacy policy') ||
      lowerTitle.includes('login')
    ) {
      continue;
    }

    const titleClean = res.title.trim();
    if (seenTitles.has(titleClean.toLowerCase())) continue;
    seenTitles.add(titleClean.toLowerCase());

    const pubDate = extractPublicationDate(res.snippet, res.date);
    const category = classifyActivityCategory(res.title, res.snippet);

    activities.push({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category,
      title: titleClean,
      snippet: res.snippet.trim().slice(0, 300),
      source_url: res.url,
      publication_date: pubDate,
      detected_at: new Date().toISOString(),
    });

    if (activities.length >= 8) break;
  }

  return activities;
}
