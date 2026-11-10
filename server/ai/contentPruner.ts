import * as cheerio from 'cheerio';
import { ContentPruningConfig, PruningStats, Contact, CompanyFirmographics } from '../../src/types';

export const DEFAULT_PRUNING_CONFIG: ContentPruningConfig = {
  enabled: true,
  stripNavAndFooter: true,
  stripCookieBanners: true,
  stripMarketingModals: true,
  prioritizeSemanticSelectors: true,
  extractSchemaOrgMicrodata: true,
  extractContextualMailtoSnippets: true,
  maxTokenBudgetPerPage: 2200, // ~8,800 characters
  compactWhitespace: true,
};

export interface PrunedPageResult {
  prunedText: string;
  schemaContacts: Array<{
    name: string;
    role?: string;
    email?: string;
    phone?: string;
    source: string;
  }>;
  schemaFirmographics?: Partial<CompanyFirmographics>;
  contextualSnippets: string[];
  rawBytes: number;
  prunedBytes: number;
  tokensSavedEstimate: number;
  reductionPercentage: number;
}

export class ContentPruningEngine {
  private config: ContentPruningConfig;

  constructor(config: Partial<ContentPruningConfig> = {}) {
    this.config = { ...DEFAULT_PRUNING_CONFIG, ...config };
  }

  public getConfig(): ContentPruningConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<ContentPruningConfig>): ContentPruningConfig {
    this.config = { ...this.config, ...newConfig };
    return this.getConfig();
  }

  /**
   * Intelligently prunes and extracts high-density semantic text from HTML for AI prompting
   */
  public prunePage(html: string, pageUrl: string): PrunedPageResult {
    const rawBytes = Buffer.byteLength(html, 'utf-8');

    if (!this.config.enabled) {
      // Basic fallback without smart pruning
      const $ = cheerio.load(html);
      $('script, style, noscript, svg').remove();
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      const prunedBytes = Buffer.byteLength(text, 'utf-8');
      return {
        prunedText: text.slice(0, 12000),
        schemaContacts: [],
        contextualSnippets: [],
        rawBytes,
        prunedBytes,
        tokensSavedEstimate: Math.max(0, Math.round((rawBytes - prunedBytes) / 4)),
        reductionPercentage: Math.max(0, Math.round(((rawBytes - prunedBytes) / rawBytes) * 100)),
      };
    }

    const $ = cheerio.load(html);

    // 1. Extract Schema.org JSON-LD structured data BEFORE stripping scripts
    const schemaContacts: Array<{ name: string; role?: string; email?: string; phone?: string; source: string }> = [];
    const schemaFirmo: Partial<CompanyFirmographics> = {};

    if (this.config.extractSchemaOrgMicrodata) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const content = $(el).html();
          if (!content) return;
          const parsed = JSON.parse(content);
          this.parseJsonLdItem(parsed, schemaContacts, schemaFirmo, pageUrl);
        } catch {
          // ignore malformed JSON-LD
        }
      });
    }

    // 2. Extract Contextual Mailto and Phone Snippets before removing DOM
    const contextualSnippets: string[] = [];
    if (this.config.extractContextualMailtoSnippets) {
      $('a[href^="mailto:"], a[href^="tel:"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        // Look up parent container (card, bio, row, li)
        let container = $(el).closest('.card, .team-member, .member, .person, .profile, .contact-item, li, tr, div');
        if (!container.length) {
          container = $(el).parent();
        }
        const snippet = container.text().replace(/\s+/g, ' ').trim();
        if (snippet && snippet.length > 10 && snippet.length < 500) {
          if (!contextualSnippets.includes(snippet)) {
            contextualSnippets.push(`[Contact Context (${href})]: ${snippet}`);
          }
        }
      });
    }

    // 2.1 Extract structured Person Cards (attorneys, team members, leadership) to preserve card proximity
    const personCardBlocks: string[] = [];
    const personCardSelectors = [
      '.attorney-card', '.lawyer-card', '.team-member', '.team-card', '.member-card',
      '.bio-card', '.person-card', '.staff-card', '.profile-card', '.vcard',
      '[class*="attorney-item"]', '[class*="team-item"]', '[class*="member-item"]',
      '[class*="leadership-item"]', '[class*="staff-item"]', '[class*="person-item"]',
      '.itemPreview', '[class*="itemPreview"]', '.item.hasImg', '.itemContent',
      '.blockContent', 'article', '.card', '.elementor-person', '.et_pb_team_member'
    ];

    $(personCardSelectors.join(', ')).each((_, el) => {
      const $el = $(el);
      const nameEl = $el.find('h1, h2, h3, h4, h5, strong, .name, [class*="name"], .contentTitle, [class*="title"]').first();
      const rawName = nameEl.text().trim();
      if (!rawName || rawName.length < 3 || rawName.length > 50) return;
      if (/^(our\s+team|meet\s+the|leadership|attorneys|lawyers|contact|about|practice\s+areas)$/i.test(rawName)) return;

      const roleEl = $el.find('.role, .title, [class*="role"], [class*="title"], [class*="position"], p').first();
      const roleText = roleEl.text().trim();

      let email = '';
      const mailto = $el.find('a[href^="mailto:"]').first().attr('href');
      if (mailto) {
        email = mailto.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
      } else {
        const emMatch = $el.text().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emMatch) email = emMatch[0].toLowerCase();
      }

      let phone = '';
      const tel = $el.find('a[href^="tel:"]').first().attr('href');
      if (tel) phone = tel.replace(/^tel:/i, '').trim();

      const profileUrl = $el.find('a[href*="linkedin.com/in/"]').first().attr('href') ||
        $el.find('a[href*="/attorney/"], a[href*="/team/"], a[href*="/people/"]').first().attr('href') || '';

      personCardBlocks.push(
        `[PERSON CARD] Name: ${rawName} | Title: ${roleText || 'Professional'} | Professional Email: ${email || 'None'} | Phone: ${phone || 'None'} | Profile: ${profileUrl || 'None'}`
      );
    });

    // 2.2 Capture Footer info before stripping (contains founded year, copyright, headquarters, general inboxes)
    let footerInfo = '';
    const footerEl = $('footer, [role="contentinfo"], .site-footer, .global-footer');
    if (footerEl.length > 0) {
      footerInfo = footerEl.text().replace(/\s+/g, ' ').trim();
    }

    // 3. Remove heavy assets, styling, and script tags
    $('script, style, noscript, svg, canvas, iframe, video, audio, picture, object, embed, form').remove();

    // 4. Strip Cookie Banners, GDPR notices & Modals
    if (this.config.stripCookieBanners) {
      $(
        '#cookie-banner, .cookie-banner, .cookie-notice, .cc-window, .onetrust-pc-dark, #onetrust-consent-sdk, ' +
          '#CybotCookiebotDialog, .cky-consent-container, div[aria-modal="true"], .modal, [class*="cookie"], [id*="cookie"], ' +
          '[class*="consent"], [id*="consent"], [class*="gdpr"], [id*="gdpr"]'
      ).remove();
    }

    // 5. Strip Marketing modals, popups, and newsletters
    if (this.config.stripMarketingModals) {
      $(
        '[class*="newsletter"], [id*="newsletter"], [class*="subscribe"], [id*="subscribe"], ' +
          '[class*="popup"], [id*="popup"], .lead-capture, .promo-banner, [class*="announcement"]'
      ).remove();
    }

    // 6. Strip repetitive Navigation and Footers if configured
    if (this.config.stripNavAndFooter) {
      $('nav, footer, header, [role="navigation"], [role="banner"], [role="contentinfo"], .site-footer, .global-footer, .nav-menu').remove();
    }

    // 7. Prioritize Semantic Blocks (main, article, contact, about, team, leadership, directory)
    let extractedContent = '';

    if (this.config.prioritizeSemanticSelectors) {
      const priorityBlocks: string[] = [];

      // High-priority contact and leadership sections
      const highPrioritySelectors = [
        '#contact',
        '.contact',
        '#team',
        '.team',
        '#about',
        '.about',
        '#leadership',
        '.leadership',
        '#management',
        '.management',
        '#people',
        '.people',
        '#attorneys',
        '.attorneys',
        '#lawyers',
        '.lawyers',
        '#partners',
        '.partners',
        '#professionals',
        '.professionals',
        '#executives',
        '.executives',
        '#board',
        '.board',
        '.directory',
        'address',
        '.vcard',
        '.h-card',
      ];

      $(highPrioritySelectors.join(', ')).each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text && text.length > 20) {
          priorityBlocks.push(text);
        }
      });

      // Main content
      $('main, article, #content, .main-content, section').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text && text.length > 30 && !priorityBlocks.some((pb) => pb.includes(text) || text.includes(pb))) {
          priorityBlocks.push(text);
        }
      });

      if (priorityBlocks.length > 0) {
        extractedContent = priorityBlocks.join('\n\n');
      } else {
        extractedContent = $('body').text().replace(/\s+/g, ' ').trim();
      }
    } else {
      extractedContent = $('body').text().replace(/\s+/g, ' ').trim();
    }

    // Append Contextual snippets and Person Cards if present
    if (contextualSnippets.length > 0) {
      extractedContent = `=== HIGH-CONFIDENCE CONTACT SNIPPETS ===\n${contextualSnippets.slice(0, 10).join('\n')}\n\n=== MAIN CONTENT ===\n${extractedContent}`;
    }

    if (personCardBlocks.length > 0) {
      extractedContent = `=== STRUCTURED TEAM & PERSON CARDS ===\n${personCardBlocks.join('\n')}\n\n${extractedContent}`;
    }

    if (footerInfo && footerInfo.length > 15) {
      extractedContent += `\n\n=== CORPORATE FOOTER & LEGAL NOTICE (FOUNDED YEAR / ADDRESS / COPYRIGHT) ===\n${footerInfo.slice(0, 1200)}`;
    }

    // Compact whitespace
    if (this.config.compactWhitespace) {
      extractedContent = extractedContent
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    }

    // Enforce Token Budget
    // 1 token ≈ 4 characters
    const maxChars = (this.config.maxTokenBudgetPerPage || 2200) * 4;
    if (extractedContent.length > maxChars) {
      extractedContent = extractedContent.slice(0, maxChars) + '... [Content pruned to stay within token budget]';
    }

    const prunedBytes = Buffer.byteLength(extractedContent, 'utf-8');
    const tokensSaved = Math.max(0, Math.round((rawBytes - prunedBytes) / 4));
    const reductionPercentage = rawBytes > 0 ? Math.max(0, Math.round(((rawBytes - prunedBytes) / rawBytes) * 100)) : 0;

    return {
      prunedText: extractedContent,
      schemaContacts,
      schemaFirmographics: Object.keys(schemaFirmo).length > 0 ? schemaFirmo : undefined,
      contextualSnippets,
      rawBytes,
      prunedBytes,
      tokensSavedEstimate: tokensSaved,
      reductionPercentage,
    };
  }

  private parseJsonLdItem(
    item: any,
    results: Array<{ name: string; role?: string; email?: string; phone?: string; source: string }>,
    schemaFirmo: Partial<CompanyFirmographics>,
    pageUrl: string
  ): void {
    if (!item) return;

    if (Array.isArray(item)) {
      item.forEach((sub) => this.parseJsonLdItem(sub, results, schemaFirmo, pageUrl));
      return;
    }

    if (item['@graph'] && Array.isArray(item['@graph'])) {
      item['@graph'].forEach((sub: any) => this.parseJsonLdItem(sub, results, schemaFirmo, pageUrl));
      return;
    }

    const type = item['@type'];
    if (type === 'Person') {
      const name = item.name || `${item.givenName || ''} ${item.familyName || ''}`.trim();
      if (name) {
        results.push({
          name,
          role: item.jobTitle || item.role || 'Executive',
          email: item.email ? String(item.email).replace('mailto:', '') : undefined,
          phone: item.telephone ? String(item.telephone).replace('tel:', '') : undefined,
          source: pageUrl,
        });
      }
    } else if (
      type === 'Organization' ||
      type === 'Corporation' ||
      type === 'LegalService' ||
      type === 'LocalBusiness' ||
      type === 'Attorney' ||
      type === 'LawFirm' ||
      type === 'MedicalOrganization'
    ) {
      // Extract employee count from Schema.org numberOfEmployees
      if (item.numberOfEmployees && !schemaFirmo.employee_count) {
        const empVal = typeof item.numberOfEmployees === 'object'
          ? (item.numberOfEmployees.value || item.numberOfEmployees.minValue || '')
          : item.numberOfEmployees;
        const numMatch = String(empVal).match(/\d{1,6}/);
        if (numMatch && parseInt(numMatch[0], 10) > 0) {
          schemaFirmo.employee_count = numMatch[0];
          schemaFirmo.employee_count_source_url = pageUrl;
          schemaFirmo.employee_count_confidence = 'schema_org';
          schemaFirmo.confidence = 'verified';
          schemaFirmo.last_checked_date = new Date().toISOString();
        }
      }

      // Extract founding year from Schema.org foundingDate
      const rawDate = item.foundingDate || item.foundDate || item.startDate;
      if (rawDate && !schemaFirmo.founded_year) {
        const yrMatch = String(rawDate).match(/\b(1[789]\d{2}|20[0-2]\d)\b/);
        if (yrMatch) {
          schemaFirmo.founded_year = yrMatch[1];
          schemaFirmo.founded_year_source_url = pageUrl;
          schemaFirmo.founded_year_confidence = 'schema_org';
          schemaFirmo.confidence = 'verified';
          schemaFirmo.last_checked_date = new Date().toISOString();
        }
      }

      // Extract address/location
      if (item.address && !schemaFirmo.location) {
        if (typeof item.address === 'string') {
          schemaFirmo.location = item.address.trim();
        } else if (typeof item.address === 'object') {
          const parts = [
            item.address.streetAddress,
            item.address.addressLocality,
            item.address.addressRegion,
            item.address.postalCode,
            item.address.addressCountry,
          ].filter(Boolean);
          if (parts.length > 0) schemaFirmo.location = parts.join(', ');
        }
      }

      // Check employee, founder, contactPoint
      const founders = Array.isArray(item.founder) ? item.founder : item.founder ? [item.founder] : [];
      founders.forEach((f: any) => {
        const fname = typeof f === 'string' ? f : f?.name;
        if (fname) {
          results.push({
            name: fname,
            role: 'Founder',
            email: f?.email ? String(f.email).replace('mailto:', '') : undefined,
            phone: f?.telephone ? String(f.telephone).replace('tel:', '') : undefined,
            source: pageUrl,
          });
        }
      });

      const employees = Array.isArray(item.employee) ? item.employee : item.employee ? [item.employee] : [];
      employees.forEach((e: any) => {
        const ename = typeof e === 'string' ? e : e?.name;
        if (ename) {
          results.push({
            name: ename,
            role: e?.jobTitle || 'Executive',
            email: e?.email ? String(e.email).replace('mailto:', '') : undefined,
            phone: e?.telephone ? String(e.telephone).replace('tel:', '') : undefined,
            source: pageUrl,
          });
        }
      });

      const contacts = Array.isArray(item.contactPoint) ? item.contactPoint : item.contactPoint ? [item.contactPoint] : [];
      contacts.forEach((cp: any) => {
        if (cp.email || cp.telephone) {
          results.push({
            name: cp.contactType || 'General Inquiries',
            role: cp.contactType || 'Contact Point',
            email: cp.email ? String(cp.email).replace('mailto:', '') : undefined,
            phone: cp.telephone ? String(cp.telephone).replace('tel:', '') : undefined,
            source: pageUrl,
          });
        }
      });
    }
  }
}

export const globalContentPruner = new ContentPruningEngine();
