import {
  extractCleanDomain,
  isAggregatorOrSocial,
  cleanCompanyName,
  isInvalidCompanyName,
  isArticleUrl,
} from './domainDetector';
import { globalDiscoveryProvider } from './provider';
import { VerificationStatus } from './types';

export interface WebsiteVerificationResult {
  officialWebsite: string;
  domain: string;
  verificationStatus: VerificationStatus;
  confidence: 'High' | 'Medium' | 'Low';
  evidence: string;
}

/**
 * Searches and validates the official company website for a given company name.
 * Strictly prevents directory, aggregator, or blog domains from being assigned as official websites.
 */
export async function verifyCompanyOfficialWebsite(
  companyName: string,
  candidateWebsite?: string,
  industry?: string,
  country?: string,
  directorySourceDomain?: string
): Promise<WebsiteVerificationResult> {
  const cleanName = cleanCompanyName(companyName);

  // 1. Company-level Validation: Is this actually a company name or an article/noise?
  if (isInvalidCompanyName(cleanName, directorySourceDomain)) {
    return {
      officialWebsite: '',
      domain: '',
      verificationStatus: 'Rejected: not a company',
      confidence: 'Low',
      evidence: `Rejected: "${companyName}" is an article headline, listicle, or non-company phrase.`,
    };
  }

  const nameNorm = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!nameNorm || nameNorm.length < 2) {
    return {
      officialWebsite: '',
      domain: '',
      verificationStatus: 'Rejected: not a company',
      confidence: 'Low',
      evidence: 'Rejected: company name is empty or unidentifiable.',
    };
  }

  // 2. If candidate website already provided (e.g. from direct search result or directory outbound link)
  if (candidateWebsite && !isArticleUrl(candidateWebsite)) {
    const domain = extractCleanDomain(candidateWebsite);
    // Ensure domain is not social/aggregator, and if extracted from a directory, not the directory host
    const isDirectoryHost =
      directorySourceDomain && isAggregatorOrSocial(directorySourceDomain) && domain === directorySourceDomain;

    if (domain && !isAggregatorOrSocial(domain) && !isDirectoryHost) {
      const domainNamePart = domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const words = cleanName.toLowerCase().split(/[\s-]+/).filter((w) => w.length >= 3);
      const strippedDomainPart = domainNamePart.replace(/^(get|try|go|use|weare|my|the|join|app)/, '');

      // Strong lexical correlation between company name and domain
      // e.g. "Datadog" -> datadoghq.com, "Slack" -> slack.com, "Teleport" -> goteleport.com, "Karat" -> trykarat.com
      const wordMatch = words.some(
        (w) =>
          domainNamePart.includes(w) ||
          w.includes(domainNamePart) ||
          (strippedDomainPart && (strippedDomainPart.includes(w) || w.includes(strippedDomainPart)))
      );

      // Check if domain has lexical connection or strong identity match
      const hasIdentityMatch =
        nameNorm.includes(domainNamePart) ||
        domainNamePart.includes(nameNorm) ||
        domainNamePart.startsWith(nameNorm.slice(0, 3)) ||
        nameNorm.startsWith(domainNamePart.slice(0, 3)) ||
        wordMatch;

      // Crucial: Domain MUST be actively reachable on the internet to be verified
      let isLive = false;
      try {
        const probeController = new AbortController();
        const probeTimeout = setTimeout(() => probeController.abort(), 3500);
        const probeRes = await fetch(`https://${domain}`, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: probeController.signal,
          redirect: 'follow',
        });
        clearTimeout(probeTimeout);
        if (probeRes.status < 500) {
          isLive = true;
        }
      } catch {
        try {
          const probeController = new AbortController();
          const probeTimeout = setTimeout(() => probeController.abort(), 2500);
          const probeRes = await fetch(`http://${domain}`, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: probeController.signal,
            redirect: 'follow',
          });
          clearTimeout(probeTimeout);
          if (probeRes.status < 500) {
            isLive = true;
          }
        } catch {}
      }

      if (isLive) {
        return {
          officialWebsite: `https://${domain}`,
          domain,
          verificationStatus: 'Verified company',
          confidence: hasIdentityMatch ? 'High' : 'Medium',
          evidence: `Verified active web domain via live probe (${domain})`,
        };
      }

      return {
        officialWebsite: '',
        domain: '',
        verificationStatus: 'Rejected: not a company',
        confidence: 'Low',
        evidence: `Domain "${domain}" is unreachable or inactive.`,
      };
    }
  }

  // 3. Perform targeted search for company's official domain ONLY if candidate website was not provided
  if (candidateWebsite) {
    return {
      officialWebsite: '',
      domain: '',
      verificationStatus: 'Company found, website unverified',
      confidence: 'Low',
      evidence: `Could not verify candidate website for ${cleanName}.`,
    };
  }
  const locationQualifier = country ? ` ${country}` : '';
  const industryQualifier = industry ? ` ${industry}` : '';
  const searchQuery = `"${cleanName}" official website${industryQualifier}${locationQualifier}`;

  try {
    const searchResults = await globalDiscoveryProvider.searchWeb(searchQuery, { maxResults: 8 });

    for (const res of searchResults) {
      const url = res.url;
      if (!url) continue;

      const domain = extractCleanDomain(url);
      if (!domain) continue;

      // Reject all aggregators, directories, social platforms, and source publication
      if (isAggregatorOrSocial(domain) || (directorySourceDomain && domain === directorySourceDomain)) {
        continue;
      }

      // Reject URLs with deep blog or article paths
      if (isArticleUrl(url)) {
        continue;
      }

      const domainNamePart = domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const titleLower = res.title.toLowerCase();

      // Strict domain-to-company verification:
      // The domain itself MUST match the company name!
      // (e.g., "Datadog" -> datadoghq.com, "Slack" -> slack.com, "SAS" -> sas.com)
      const nameInDomain =
        (nameNorm.length >= 2 && domainNamePart.includes(nameNorm)) ||
        (domainNamePart.length >= 2 && nameNorm.includes(domainNamePart));

      if (nameInDomain) {
        return {
          officialWebsite: `https://${domain}`,
          domain,
          verificationStatus: 'Verified company',
          confidence: 'High',
          evidence: `Official web presence verified: "${res.title}" (${domain})`,
        };
      }
    }
  } catch (err: any) {
    console.warn(`[WebsiteVerifier] Targeted search failed for ${cleanName}:`, err.message);
  }

  // 4. Fallback: If no official website can be established with evidence, mark unverified
  // CRITICAL: NEVER put the directory/source domain in officialWebsite!
  return {
    officialWebsite: '',
    domain: '',
    verificationStatus: 'Company found, website unverified',
    confidence: 'Low',
    evidence: 'Company identified from source, but official domain could not be independently verified.',
  };
}
