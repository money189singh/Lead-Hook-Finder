import fetch from 'node-fetch';
import { DetectedTechnology, TechStackResult } from '../../src/types';

interface TechSignature {
  name: string;
  category: DetectedTechnology['category'];
  icon: string;
  description: string;
  match: (html: string, headers: Record<string, string>, cookies: string) => boolean;
  confidence?: number;
}

const TECH_SIGNATURES: TechSignature[] = [
  // Analytics
  {
    name: 'Google Analytics 4',
    category: 'analytics',
    icon: 'BarChart3',
    description: 'Enterprise web traffic and user journey measurement platform',
    match: (html) => html.includes('googletagmanager.com/gtag/js') || html.includes('G-') || html.includes('GoogleAnalyticsObject'),
  },
  {
    name: 'Segment',
    category: 'analytics',
    icon: 'Layers',
    description: 'Customer data platform (CDP) for event streaming',
    match: (html) => html.includes('cdn.segment.com/analytics.js') || html.includes('analytics.load('),
  },
  {
    name: 'Mixpanel',
    category: 'analytics',
    icon: 'LineChart',
    description: 'Product analytics tracking user interactions & retention',
    match: (html) => html.includes('cdn.mxpnl.com') || html.includes('mixpanel.init'),
  },
  {
    name: 'Amplitude',
    category: 'analytics',
    icon: 'Activity',
    description: 'Digital analytics system tracking conversion funnels',
    match: (html) => html.includes('amplitude.com') || html.includes('amplitude.getInstance'),
  },
  {
    name: 'Hotjar',
    category: 'analytics',
    icon: 'Flame',
    description: 'Behavior analytics with heatmaps and session recordings',
    match: (html) => html.includes('static.hotjar.com') || html.includes('hjid'),
  },
  {
    name: 'PostHog',
    category: 'analytics',
    icon: 'Eye',
    description: 'Open-source product analytics and feature flags',
    match: (html) => html.includes('posthog.init') || html.includes('app.posthog.com'),
  },

  // CRM & Sales Engagement
  {
    name: 'HubSpot',
    category: 'crm',
    icon: 'Database',
    description: 'Inbound marketing, CRM, and sales automation platform',
    match: (html) => html.includes('js.hs-scripts.com') || html.includes('hbspt.forms') || html.includes('hs-analytics'),
  },
  {
    name: 'Salesforce',
    category: 'crm',
    icon: 'Cloud',
    description: 'Enterprise customer relationship management system',
    match: (html) => html.includes('salesforce.com') || html.includes('force.com') || html.includes('liveagent'),
  },
  {
    name: 'Marketo',
    category: 'marketing',
    icon: 'Send',
    description: 'Enterprise B2B lead management and email nurture automation',
    match: (html) => html.includes('munchkin.js') || html.includes('marketo.com'),
  },
  {
    name: 'Klaviyo',
    category: 'marketing',
    icon: 'Mail',
    description: 'E-commerce email and SMS marketing automation platform',
    match: (html) => html.includes('static.klaviyo.com') || html.includes('_learnq'),
  },
  {
    name: 'Intercom',
    category: 'crm',
    icon: 'MessageSquare',
    description: 'Live conversational customer support and onboarding bot',
    match: (html) => html.includes('widget.intercom.io') || html.includes('Intercom('),
  },
  {
    name: 'Drift',
    category: 'crm',
    icon: 'MessageCircle',
    description: 'Conversational marketing and B2B revenue acceleration bot',
    match: (html) => html.includes('js.driftt.com') || html.includes('drift.load'),
  },
  {
    name: 'Zendesk',
    category: 'crm',
    icon: 'HelpCircle',
    description: 'Customer service help desk and ticket management platform',
    match: (html) => html.includes('ekr.zdassets.com') || html.includes('zopim'),
  },

  // CMS & Frameworks
  {
    name: 'Shopify',
    category: 'cms',
    icon: 'ShoppingBag',
    description: 'E-commerce platform powering online storefronts and checkout',
    match: (html) => html.includes('cdn.shopify.com') || html.includes('Shopify.theme'),
  },
  {
    name: 'Webflow',
    category: 'cms',
    icon: 'Globe',
    description: 'No-code visual responsive web design CMS',
    match: (html) => html.includes('webflow.js') || html.includes('data-wf-page') || html.includes('w-layout-grid'),
  },
  {
    name: 'WordPress',
    category: 'cms',
    icon: 'FileText',
    description: 'Open-source content management system powering websites',
    match: (html) => html.includes('wp-content') || html.includes('wp-includes'),
  },
  {
    name: 'Next.js',
    category: 'cms',
    icon: 'Zap',
    description: 'React production framework with server-side rendering',
    match: (html) => html.includes('__NEXT_DATA__') || html.includes('/_next/'),
  },
  {
    name: 'Magento / Adobe Commerce',
    category: 'cms',
    icon: 'Package',
    description: 'Enterprise open-source e-commerce platform',
    match: (html) => html.includes('mage/cookies.js') || html.includes('Magento'),
  },
  {
    name: 'Squarespace',
    category: 'cms',
    icon: 'Layout',
    description: 'All-in-one website building and portfolio hosting platform',
    match: (html) => html.includes('squarespace.com') || html.includes('static1.squarespace.com'),
  },

  // Payments & Checkout
  {
    name: 'Stripe',
    category: 'payments',
    icon: 'CreditCard',
    description: 'Payment processing infrastructure and billing checkout',
    match: (html) => html.includes('js.stripe.com') || html.includes('Stripe('),
  },
  {
    name: 'PayPal',
    category: 'payments',
    icon: 'DollarSign',
    description: 'Global digital payment and merchant gateway',
    match: (html) => html.includes('paypal.com/sdk/js') || html.includes('paypal-button'),
  },
  {
    name: 'Chargebee',
    category: 'payments',
    icon: 'Repeat',
    description: 'SaaS subscription billing and revenue management system',
    match: (html) => html.includes('js.chargebee.com'),
  },

  // Cloud & CDN
  {
    name: 'Cloudflare',
    category: 'cloud',
    icon: 'Shield',
    description: 'Web security, DDoS mitigation, and global CDN acceleration',
    match: (html, headers) =>
      Boolean(headers['cf-ray'] || headers['server']?.toLowerCase().includes('cloudflare') || html.includes('cdnjs.cloudflare.com')),
  },
  {
    name: 'Vercel',
    category: 'cloud',
    icon: 'Triangle',
    description: 'Frontend cloud platform for serverless web applications',
    match: (html, headers) => Boolean(headers['x-vercel-id']),
  },
  {
    name: 'Amazon Web Services (AWS)',
    category: 'cloud',
    icon: 'Server',
    description: 'Cloud hosting, S3 asset delivery, and compute infrastructure',
    match: (html, headers) =>
      Boolean(headers['x-amz-cf-id'] || headers['x-amz-request-id'] || html.includes('.amazonaws.com/')),
  },

  // Advertising & Retargeting Pixels
  {
    name: 'Meta Pixel (Facebook)',
    category: 'advertising',
    icon: 'Share2',
    description: 'Social ad tracking, custom audience building, and conversion tracking',
    match: (html) => html.includes('connect.facebook.net') || html.includes('fbq('),
  },
  {
    name: 'LinkedIn Insight Tag',
    category: 'advertising',
    icon: 'Linkedin',
    description: 'B2B campaign attribution and website visitor firmographics',
    match: (html) => html.includes('snap.licdn.com') || html.includes('_linkedin_partner_id'),
  },
  {
    name: 'Google Tag Manager',
    category: 'advertising',
    icon: 'Tag',
    description: 'Centralized tag management for marketing and analytics scripts',
    match: (html) => html.includes('googletagmanager.com/gtm.js') || html.includes('GTM-'),
  },
];

export class TechDetectorEngine {
  private cache = new Map<string, TechStackResult>();

  public detectFromHtml(html: string, headers: Record<string, string> = {}): DetectedTechnology[] {
    const detected: DetectedTechnology[] = [];
    const normalizedHtml = html || '';

    for (const sig of TECH_SIGNATURES) {
      try {
        if (sig.match(normalizedHtml, headers, '')) {
          detected.push({
            name: sig.name,
            category: sig.category,
            icon: sig.icon,
            confidence: sig.confidence || 95,
            description: sig.description,
          });
        }
      } catch {}
    }

    return detected;
  }

  public async detectUrl(rawUrl: string): Promise<TechStackResult> {
    let cleanUrl = rawUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    let domain = '';
    try {
      domain = new URL(cleanUrl).hostname;
    } catch {
      domain = rawUrl;
    }

    if (this.cache.has(domain)) {
      return this.cache.get(domain)!;
    }

    try {
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), 8000);

      const res = await fetch(cleanUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: abortCtrl.signal,
      });

      clearTimeout(timeoutId);

      const html = await res.text();
      const headersRecord: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headersRecord[k.toLowerCase()] = v;
      });

      const technologies = this.detectFromHtml(html, headersRecord);

      const result: TechStackResult = {
        url: cleanUrl,
        domain,
        technologies,
        analyzedAt: new Date().toISOString(),
      };

      this.cache.set(domain, result);
      return result;
    } catch (err: any) {
      console.warn(`[TechDetector] Failed to fetch ${cleanUrl}:`, err.message);
      const fallbackResult: TechStackResult = {
        url: cleanUrl,
        domain,
        technologies: [],
        analyzedAt: new Date().toISOString(),
      };
      return fallbackResult;
    }
  }

  public getCached(domain: string): TechStackResult | undefined {
    return this.cache.get(domain);
  }
}

export const globalTechDetector = new TechDetectorEngine();
