import * as cheerio from 'cheerio';
import { SocialProfiles, Contact } from '../../src/types';

export interface PageSocials {
  companySocials: SocialProfiles;
  personalProfiles: {
    fullName?: string;
    linkedin?: string;
    twitter?: string;
    contextText?: string;
  }[];
}

const EXCLUDED_TWITTER_PATHS = new Set([
  'intent',
  'share',
  'search',
  'hashtag',
  'home',
  'explore',
  'login',
  'signup',
  'tos',
  'privacy',
  'i',
  'help',
  'about',
]);

const EXCLUDED_FACEBOOK_PATHS = new Set([
  'sharer',
  'share',
  'dialog',
  'tr',
  'policy',
  'privacy',
  'login',
  'help',
  'pages',
]);

const EXCLUDED_YOUTUBE_PATHS = new Set([
  'watch',
  'results',
  'feed',
  'embed',
  'channel_switcher',
  'playlist',
]);

const EXCLUDED_INSTAGRAM_PATHS = new Set([
  'p',
  'reel',
  'reels',
  'explore',
  'accounts',
  'direct',
  'stories',
]);

export class SocialDiscoveryEngine {
  /**
   * Discovers and normalizes both company-level and individual professional profiles from raw HTML.
   */
  public discoverFromHtml(html: string, pageUrl: string): PageSocials {
    const companySocials: SocialProfiles = {};
    const personalProfiles: PageSocials['personalProfiles'] = [];

    if (!html || typeof html !== 'string') {
      return { companySocials, personalProfiles };
    }

    try {
      const $ = cheerio.load(html);

      // 1. Scan <a> links
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href')?.trim();
        if (!href) return;

        const anchorText = $(el).text().trim();
        const parentCard = $(el).closest('.team, .member, .author, .card, .profile, .person, li, article, div');
        const cardText = parentCard.length ? parentCard.text().replace(/\s+/g, ' ').trim().slice(0, 300) : '';

        // LinkedIn Personal: /in/
        const personalLinkedinMatch = href.match(/https?:\/\/(?:[a-z0-9-]+\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-\.%]+)/i);
        if (personalLinkedinMatch) {
          const cleanUrl = `https://www.linkedin.com/in/${personalLinkedinMatch[1].replace(/\/$/, '')}`;
          personalProfiles.push({
            fullName: anchorText && !anchorText.toLowerCase().includes('linkedin') ? anchorText : undefined,
            linkedin: cleanUrl,
            contextText: cardText,
          });
          return;
        }

        // LinkedIn Company: /company/ or /school/
        const companyLinkedinMatch = href.match(/https?:\/\/(?:[a-z0-9-]+\.)?linkedin\.com\/(?:company|school)\/([a-zA-Z0-9_\-\.%]+)/i);
        if (companyLinkedinMatch && !companySocials.linkedin) {
          companySocials.linkedin = `https://www.linkedin.com/company/${companyLinkedinMatch[1].replace(/\/$/, '')}`;
          return;
        }

        // Twitter / X
        const twitterMatch = href.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,35})/i);
        if (twitterMatch) {
          const handle = twitterMatch[1].toLowerCase();
          if (!EXCLUDED_TWITTER_PATHS.has(handle)) {
            const cleanUrl = `https://x.com/${twitterMatch[1]}`;
            if (!companySocials.twitter) {
              companySocials.twitter = cleanUrl;
            }
            if (cardText && cardText.length > 10) {
              personalProfiles.push({
                fullName: anchorText && !anchorText.toLowerCase().includes('twitter') ? anchorText : undefined,
                twitter: cleanUrl,
                contextText: cardText,
              });
            }
          }
          return;
        }

        // Facebook
        const facebookMatch = href.match(/https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9_\-\.]{3,50})/i);
        if (facebookMatch && !companySocials.facebook) {
          const path = facebookMatch[1].toLowerCase();
          if (!EXCLUDED_FACEBOOK_PATHS.has(path) && !path.startsWith('profile.php')) {
            companySocials.facebook = `https://www.facebook.com/${facebookMatch[1].replace(/\/$/, '')}`;
          }
          return;
        }

        // YouTube
        const youtubeMatch = href.match(/https?:\/\/(?:www\.)?youtube\.com\/(@[a-zA-Z0-9_\-\.]+|c\/[a-zA-Z0-9_\-\.]+|channel\/[a-zA-Z0-9_\-]+|user\/[a-zA-Z0-9_\-]+)/i);
        if (youtubeMatch && !companySocials.youtube) {
          companySocials.youtube = `https://www.youtube.com/${youtubeMatch[1]}`;
          return;
        }

        // Instagram
        const instagramMatch = href.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_\-\.]{3,35})/i);
        if (instagramMatch && !companySocials.instagram) {
          const handle = instagramMatch[1].toLowerCase();
          if (!EXCLUDED_INSTAGRAM_PATHS.has(handle)) {
            companySocials.instagram = `https://www.instagram.com/${instagramMatch[1].replace(/\/$/, '')}`;
          }
          return;
        }

        // GitHub
        const githubMatch = href.match(/https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_\-]{2,40})/i);
        if (githubMatch && !companySocials.github) {
          companySocials.github = `https://github.com/${githubMatch[1]}`;
          return;
        }
      });

      // 2. Scan meta tags and Schema.org for social references
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const jsonText = $(el).html()?.trim();
          if (!jsonText) return;
          const parsed = JSON.parse(jsonText);
          this.extractFromSchema(parsed, companySocials, personalProfiles);
        } catch {
          // Ignore JSON-LD parse errors
        }
      });
    } catch (err) {
      console.warn(`Error discovering social profiles on ${pageUrl}:`, err);
    }

    return { companySocials, personalProfiles };
  }

  /**
   * Recursively extracts social links from Schema.org sameAs arrays
   */
  private extractFromSchema(node: any, companySocials: SocialProfiles, personalProfiles: any[]): void {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) {
        this.extractFromSchema(item, companySocials, personalProfiles);
      }
      return;
    }

    const type = String(node['@type'] || '');
    const isOrg = /Organization|Corporation|LocalBusiness|Company/i.test(type);
    const isPerson = /Person/i.test(type);

    const sameAsList: string[] = [];
    if (typeof node.sameAs === 'string') sameAsList.push(node.sameAs);
    else if (Array.isArray(node.sameAs)) {
      for (const s of node.sameAs) {
        if (typeof s === 'string') sameAsList.push(s);
      }
    }

    for (const url of sameAsList) {
      if (isOrg) {
        if (url.includes('linkedin.com/company') && !companySocials.linkedin) companySocials.linkedin = url;
        if ((url.includes('twitter.com') || url.includes('x.com')) && !companySocials.twitter) companySocials.twitter = url;
        if (url.includes('facebook.com') && !companySocials.facebook) companySocials.facebook = url;
        if (url.includes('youtube.com') && !companySocials.youtube) companySocials.youtube = url;
        if (url.includes('instagram.com') && !companySocials.instagram) companySocials.instagram = url;
        if (url.includes('github.com') && !companySocials.github) companySocials.github = url;
      } else if (isPerson) {
        if (url.includes('linkedin.com/in/')) {
          personalProfiles.push({
            fullName: node.name,
            linkedin: url,
            contextText: node.jobTitle || node.description,
          });
        }
      }
    }

    // Check nested entities
    if (node.department) this.extractFromSchema(node.department, companySocials, personalProfiles);
    if (node.member) this.extractFromSchema(node.member, companySocials, personalProfiles);
    if (node.employee) this.extractFromSchema(node.employee, companySocials, personalProfiles);
  }

  /**
   * Matches personal profiles discovered on the page to extracted contacts using fuzzy name and card text matching.
   */
  public matchProfilesToContacts(
    contacts: Contact[],
    personalProfiles: PageSocials['personalProfiles']
  ): void {
    if (!contacts.length || !personalProfiles.length) return;

    for (const contact of contacts) {
      if (contact.linkedin_url) continue;

      const contactName = (contact.full_name || `${contact.first_name} ${contact.last_name}`).trim().toLowerCase();
      const parts = contactName.split(/\s+/).filter(Boolean);

      for (const prof of personalProfiles) {
        if (!prof.linkedin) continue;

        let matched = false;

        // Direct name match
        if (prof.fullName) {
          const profName = prof.fullName.trim().toLowerCase();
          if (profName.includes(contactName) || contactName.includes(profName)) {
            matched = true;
          }
        }

        // Slug / URL match (e.g. linkedin.com/in/sarah-connor matches Sarah Connor)
        if (!matched && parts.length >= 2) {
          const slug = prof.linkedin.toLowerCase().split('/in/')[1] || '';
          if (slug.includes(parts[0]) && slug.includes(parts[parts.length - 1])) {
            matched = true;
          }
        }

        // Context text match
        if (!matched && prof.contextText && parts.length >= 2) {
          const contextLower = prof.contextText.toLowerCase();
          if (contextLower.includes(parts[0]) && contextLower.includes(parts[parts.length - 1])) {
            matched = true;
          }
        }

        if (matched) {
          contact.linkedin_url = prof.linkedin;
          if (!contact.social_profiles) contact.social_profiles = {};
          contact.social_profiles.linkedin = prof.linkedin;
          if (prof.twitter && !contact.twitter_url) {
            contact.twitter_url = prof.twitter;
            contact.social_profiles.twitter = prof.twitter;
          }
          break;
        }
      }
    }
  }
}

export const globalSocialDiscovery = new SocialDiscoveryEngine();
