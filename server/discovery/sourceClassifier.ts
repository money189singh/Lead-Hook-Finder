import {
  extractCleanDomain,
  isAggregatorOrSocial,
  isArticleOrListicleTitle,
  isArticleUrl,
} from './domainDetector';

export type SearchResultClassification =
  | 'directory_or_article'
  | 'official_company_website'
  | 'irrelevant';

const SOCIAL_AND_SEARCH_ENGINES = new Set([
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'yahoo.com',
  'search.yahoo.com',
  'baidu.com',
  'yandex.com',
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'youtube.com',
  'tiktok.com',
  'pinterest.com',
  'reddit.com',
  'quora.com',
  'wikipedia.org',
  'cambridge.org',
  'merriam-webster.com',
  'dictionary.com',
  'thefreedictionary.com',
  'collinsdictionary.com',
  'wiktionary.org',
  'britannica.com',
  'statista.com',
  'tradingeconomics.com',
  'singstat.gov.sg',
  'indeed.com',
  'glassdoor.com',
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
]);

/**
 * Classifies a search result into:
 * 1. directory_or_article (needs company extraction)
 * 2. official_company_website (candidate direct company)
 * 3. irrelevant (social media, search engine, job portal, etc.)
 */
export function classifySearchResult(url: string, title: string, snippet: string): SearchResultClassification {
  if (!url) return 'irrelevant';

  // Fast check: Educational, mathematical definitions, or academic curriculum pages
  if (/\/(math-vocabulary|algebra|geometry|grammar|curriculum|lesson-plan|worksheet|k12)\b/i.test(url)) {
    return 'irrelevant';
  }

  const domain = extractCleanDomain(url);
  if (!domain) return 'irrelevant';

  // 1. Social media & search engines are irrelevant targets
  for (const blocked of SOCIAL_AND_SEARCH_ENGINES) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) {
      return 'irrelevant';
    }
  }

  // 2. Known directories, aggregators, or tech media publications
  if (isAggregatorOrSocial(domain)) {
    return 'directory_or_article';
  }

  // 3. Check if URL path has article / blog / listicle slugs
  if (isArticleUrl(url)) {
    return 'directory_or_article';
  }

  // 4. Check Title for article / listicle phrases (e.g. "Top 100 SaaS Companies", "Best SaaS Startups")
  if (isArticleOrListicleTitle(title)) {
    return 'directory_or_article';
  }

  // 5. Check snippet if it indicates a list, directory, or article roundup
  if (isArticleOrListicleTitle(snippet)) {
    return 'directory_or_article';
  }

  if (
    /\b(here are the top|we compiled a list|our list of the best|explore our curated list|the complete list of|best startups to watch|ranking of the best|fastest growing saas)\b/i.test(
      snippet
    )
  ) {
    return 'directory_or_article';
  }

  // 6. Check if title contains plural markers ("Companies", "Startups", "Platforms", "Tools")
  // e.g. "SaaS Companies in USA" or "Cloud Software Tools"
  if (/\b(saas companies|tech startups|software companies|cloud startups|b2b platforms)\b/i.test(title)) {
    return 'directory_or_article';
  }

  // 7. Otherwise, if root domain or product landing page, candidate official company website
  return 'official_company_website';
}
