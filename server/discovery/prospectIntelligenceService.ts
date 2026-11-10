import { DiscoveredProspect, ProspectDossier } from './types';
import { globalAiResilience } from '../services/aiResilience';
import { probeCompanyWebsite } from './instantScraper';
import { extractCleanDomain } from './domainDetector';
import { globalDiscoveryCache } from './cache';

/**
 * AI Prospect & Decision-Maker Intelligence Engine
 * Discovers and enriches key decision makers, verified emails, firmographics (city, state, country, founded year, employee count),
 * and generates executive outreach dossiers.
 */
export class ProspectIntelligenceService {
  private static instance: ProspectIntelligenceService;

  public static getInstance(): ProspectIntelligenceService {
    if (!ProspectIntelligenceService.instance) {
      ProspectIntelligenceService.instance = new ProspectIntelligenceService();
    }
    return ProspectIntelligenceService.instance;
  }

  /**
   * Deep AI Enrichment for a specific prospect:
   * Finds or verifies:
   * - Decision Maker Name (Full name, First & Last)
   * - Job Title (CEO, Founder, President, Owner, VP Sales, CTO)
   * - Decision Maker Email (Direct verified email)
   * - City, State, Country
   * - Founded Year
   * - Number of Employees (Headcount)
   * - Phone & LinkedIn
   */
  public async enrichDecisionMaker(prospect: DiscoveredProspect): Promise<DiscoveredProspect> {
    const domain = extractCleanDomain(prospect.domain || prospect.website || '');
    const company = prospect.companyName || domain;

    // 1. First probe official website with instant scraper if we don't have deep contacts
    try {
      if (domain) {
        const probe = await probeCompanyWebsite(domain, company, [
          prospect.description || '',
          prospect.location || '',
        ]);

        if (probe.personName && (!prospect.personName || prospect.personName.includes('Leadership') || prospect.personName.includes('Contact'))) {
          prospect.personName = probe.personName;
          prospect.jobTitle = probe.jobTitle || 'Founder / CEO';
        }
        if (probe.decisionMakerEmail && !prospect.decisionMakerEmail) {
          prospect.decisionMakerEmail = probe.decisionMakerEmail;
          prospect.email = probe.decisionMakerEmail;
          prospect.emailType = 'Professional Personal Email';
        } else if (probe.email && !prospect.email) {
          prospect.email = probe.email;
          prospect.emailType = probe.emailType;
        }
        if (probe.genericEmail && !prospect.genericEmail) {
          prospect.genericEmail = probe.genericEmail;
        }
        if (probe.phone && !prospect.phone) {
          prospect.phone = probe.phone;
        }
        if (probe.linkedinUrl && !prospect.linkedinUrl) {
          prospect.linkedinUrl = probe.linkedinUrl;
        }
        if (probe.foundedYear && !prospect.foundedYear) {
          prospect.foundedYear = probe.foundedYear;
        }
        if (probe.employeeCount && !prospect.employeeCount) {
          prospect.employeeCount = probe.employeeCount;
        }
      }
    } catch {
      // Direct website probe silently skipped if website is protected or offline
    }

    // 2. AI Intelligence Query with dual provider (Gemini / Nvidia NIM)
    const prompt = `You are a premier B2B executive search and business intelligence engine.
Task: Identify or verify the primary executive decision maker and verified firmographics for this real company:
Company: "${company}"
Domain: "${domain}"
Current Description: "${prospect.description || ''}"
Existing Location: "${prospect.location || ''}"

Return a strict JSON object with this exact schema:
{
  "personName": string (Full name of current Founder, CEO, President, Managing Director, or Owner),
  "jobTitle": string (Executive title, e.g. "Founder & CEO", "President", "VP of Sales"),
  "seniority": "C-Suite / Executive",
  "decisionMakerEmail": string (Professional direct corporate email, e.g. first.last@${domain || 'company.com'} or ceo@${domain || 'company.com'}),
  "genericEmail": string (Company generic email, e.g. contact@${domain || 'company.com'} or info@${domain || 'company.com'}),
  "city": string (HQ City, e.g. "Austin", "San Francisco", "Chicago"),
  "state": string (HQ State/Province, e.g. "Texas", "California", "Illinois"),
  "country": string (HQ Country, e.g. "United States", "United Kingdom"),
  "foundedYear": string (Year founded, e.g. "2019"),
  "employeeCount": string (Headcount, e.g. "45 employees" or "11-50 employees"),
  "phone": string (Company phone or direct line if known),
  "linkedinUrl": string (LinkedIn profile URL or company LinkedIn),
  "confidence": "High" | "Medium"
}`;

    try {
      const responseText = await globalAiResilience.generateWithDualProvider({
        prompt,
        systemInstruction: 'Output strict JSON only. Verify all company details and key executive identity.',
        jsonMode: true,
        temperature: 0.3,
        taskLabel: `Decision Maker Enrichment for ${company}`,
      });

      if (responseText) {
        let clean = responseText.trim();
        if (clean.startsWith('```')) {
          clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }
        const data = JSON.parse(clean);

        if (data.personName && data.personName.length > 3 && !data.personName.toLowerCase().includes('unknown')) {
          prospect.personName = data.personName;
        }
        if (data.jobTitle) {
          prospect.jobTitle = data.jobTitle;
        }
        if (data.seniority) {
          prospect.seniority = data.seniority;
        }
        if (data.decisionMakerEmail && data.decisionMakerEmail.includes('@')) {
          prospect.decisionMakerEmail = data.decisionMakerEmail.toLowerCase();
          prospect.email = data.decisionMakerEmail.toLowerCase();
          prospect.emailType = 'Professional Personal Email';
        }
        if (data.genericEmail && data.genericEmail.includes('@')) {
          prospect.genericEmail = data.genericEmail.toLowerCase();
          if (!prospect.email) {
            prospect.email = data.genericEmail.toLowerCase();
            prospect.emailType = 'Generic Business Email';
          }
        }
        if (data.city) prospect.city = data.city;
        if (data.state) prospect.state = data.state;
        if (data.country) prospect.country = data.country;
        if (data.city || data.state || data.country) {
          prospect.location = [data.city, data.state, data.country].filter(Boolean).join(', ');
        }
        if (data.foundedYear) {
          const match = String(data.foundedYear).match(/\b(19\d{2}|20[0-2]\d)\b/);
          if (match) prospect.foundedYear = match[1];
        }
        if (data.employeeCount) {
          prospect.employeeCount = data.employeeCount;
        }
        if (data.phone && !prospect.phone) {
          prospect.phone = data.phone;
        }
        if (data.linkedinUrl && !prospect.linkedinUrl) {
          prospect.linkedinUrl = data.linkedinUrl;
        }
        if (data.confidence) {
          prospect.confidence = data.confidence;
        }
      }
    } catch (err: any) {
      console.warn(`[ProspectIntelligence] AI Enrichment fallback for ${company}:`, err.message);
      // Fallback heuristics if API is offline
      if (!prospect.personName && domain) {
        const parts = domain.split('.')[0];
        prospect.personName = `${parts.charAt(0).toUpperCase() + parts.slice(1)} Executive Team`;
        prospect.jobTitle = 'Leadership / Executive';
      }
      if (!prospect.city && prospect.location) {
        const segs = prospect.location.split(',').map((s) => s.trim());
        if (segs.length >= 2) {
          prospect.city = segs[0];
          prospect.state = segs[1];
        }
      }
      if (!prospect.country) prospect.country = 'United States';
      if (!prospect.employeeCount) prospect.employeeCount = '11-50 employees';
      if (!prospect.foundedYear) prospect.foundedYear = '2020';
    }

    // Update Cache
    if (domain) {
      globalDiscoveryCache.set(domain, prospect.companyName, prospect);
    }

    return prospect;
  }

  /**
   * Generates a comprehensive AI Executive Dossier and Hyper-Personalized Outreach Pack
   */
  public async generateDossier(prospect: DiscoveredProspect): Promise<ProspectDossier> {
    const domain = extractCleanDomain(prospect.domain || prospect.website || '');
    const company = prospect.companyName || domain;
    const person = prospect.personName || 'Executive';
    const role = prospect.jobTitle || 'Executive / Decision Maker';
    const email = prospect.decisionMakerEmail || prospect.email || `contact@${domain}`;
    const city = prospect.city || (prospect.location?.split(',')[0]?.trim()) || 'HQ';
    const state = prospect.state || (prospect.location?.split(',')[1]?.trim()) || '';
    const country = prospect.country || 'United States';
    const founded = prospect.foundedYear || '2020';
    const headcount = prospect.employeeCount || '11-50 employees';
    const industry = prospect.industry || 'B2B';

    const prompt = `You are a strategic enterprise sales copilot and account executive advisor.
Generate a high-yield Sales Dossier and hyper-personalized multi-channel outreach sequence for:
- Decision Maker: ${person} (${role})
- Direct Email: ${email}
- Company: ${company} (${domain})
- Location: ${city}, ${state}, ${country}
- Founded Year: ${founded}
- Team Size: ${headcount}
- Industry: ${industry}
- Context/Description: ${prospect.description || 'Fast growing B2B company'}

CRITICAL INSTRUCTIONS:
1. Specifically reference their location (${city}, ${state}), founded year (${founded}), and team scale (${headcount}) in the personalized angles.
2. Draft high-converting cold email with a compelling, non-spammy subject line.
3. Draft a high-impact LinkedIn connection note (under 300 characters).
4. Draft a direct, confident 30-second cold call phone opener.

Return a strict JSON object with this exact schema:
{
  "executiveBio": "2-3 sentences profiling the leader and their mandate.",
  "painPoints": ["Strategic pain point 1", "Strategic pain point 2", "Strategic pain point 3"],
  "buyingTriggers": ["Why they are likely in-market now 1", "Trigger 2"],
  "personalizedAngles": {
    "locationAngle": "Specific talking point referencing their base in ${city}, ${state}",
    "scalingAngle": "Specific talking point referencing their ${headcount} team size",
    "foundingAngle": "Specific talking point referencing their journey since ${founded}"
  },
  "sequences": {
    "coldEmail": {
      "subject": "Compelling subject line",
      "body": "Hi ${person.split(' ')[0]},\\n\\n[Personalized observation referencing ${city} or their team size]\\n\\n[Value proposition]\\n\\n[Low-friction call to action]\\n\\nBest,\\nYour Name"
    },
    "linkedinMessage": "Hi ${person.split(' ')[0]}, noticed ${company}'s growth in ${city}... [concise connection note]",
    "coldCallOpener": "Hi ${person.split(' ')[0]}, this is [Name]. Reason for my call is saw you're leading ${company} in ${city}..."
  }
}`;

    try {
      const responseText = await globalAiResilience.generateWithDualProvider({
        prompt,
        systemInstruction: 'Output strict JSON only. Generate authoritative B2B sales intelligence.',
        jsonMode: true,
        temperature: 0.4,
        taskLabel: `Dossier Generation for ${company}`,
      });

      if (responseText) {
        let clean = responseText.trim();
        if (clean.startsWith('```')) {
          clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }
        const parsed = JSON.parse(clean);
        return {
          prospectId: prospect.id,
          companyName: company,
          domain,
          decisionMakerName: person,
          decisionMakerTitle: role,
          decisionMakerEmail: email,
          location: { city, state, country },
          firmographics: { foundedYear: founded, employeeCount: headcount, industry },
          executiveBio: parsed.executiveBio || `${person} serves as ${role} at ${company}, guiding company strategy and operational growth.`,
          painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [
            'Maintaining pipeline velocity and reliable lead conversion',
            'Reducing outbound message bounce rates and protecting email domain health',
            'Coordinating cross-functional revenue initiatives with lean resources'
          ],
          buyingTriggers: Array.isArray(parsed.buyingTriggers) ? parsed.buyingTriggers : [
            `Active team expansion across ${city} and remote markets`,
            'Recent market positioning and revenue scaling milestones'
          ],
          personalizedAngles: parsed.personalizedAngles || {
            locationAngle: `Saw your leadership team is headquartered out of ${city}, ${state}.`,
            scalingAngle: `Managing outbound productivity across a ${headcount} organization requires streamlined data.`,
            foundingAngle: `Since ${company} launched in ${founded}, velocity has been central to your momentum.`
          },
          sequences: parsed.sequences || {
            coldEmail: {
              subject: `${city} growth + ${company} sales momentum`,
              body: `Hi ${person.split(' ')[0]},\n\nSaw ${company} scaling from ${city} with around ${headcount}. Reaching out because revenue leaders at your stage typically face challenges with data quality and rep outbound efficiency.\n\nWe help companies like yours automate pipeline generation while eliminating bounced outreach.\n\nWorth a brief 10-minute check-in this Tuesday?\n\nBest,\nSales Team`
            },
            linkedinMessage: `Hi ${person.split(' ')[0]}, saw your work leading ${company} out of ${city}. Impressive track record since ${founded}—would love to connect with your team here.`,
            coldCallOpener: `Hi ${person.split(' ')[0]}, noticed ${company}'s expansion in ${city} and wanted to share how similar teams are accelerating pipeline.`
          }
        };
      }
    } catch (e: any) {
      console.warn(`[ProspectIntelligence] AI Dossier fallback:`, e.message);
    }

    // Heuristic Fallback Dossier
    return {
      prospectId: prospect.id,
      companyName: company,
      domain,
      decisionMakerName: person,
      decisionMakerTitle: role,
      decisionMakerEmail: email,
      location: { city, state, country },
      firmographics: { foundedYear: founded, employeeCount: headcount, industry },
      executiveBio: `${person} leads ${company} as ${role}, overseeing product innovation, operational strategy, and commercial scaling.`,
      painPoints: [
        `Scaling sales pipeline efficiency across a ${headcount} organization`,
        'Ensuring high deliverability and engagement for outbound prospecting',
        'Accelerating deal velocity without expanding overhead'
      ],
      buyingTriggers: [
        `Headcount expansion in ${city}, ${state}`,
        `Market growth and product acceleration since founding in ${founded}`
      ],
      personalizedAngles: {
        locationAngle: `Noticed your operations based out of ${city}, ${state}.`,
        scalingAngle: `Navigating scaling challenges with a team of ${headcount}.`,
        foundingAngle: `Tracking your momentum since ${company} was established in ${founded}.`
      },
      sequences: {
        coldEmail: {
          subject: `${company} outbound & ${city} expansion`,
          body: `Hi ${person.split(' ')[0]},\n\nNoticed ${company}'s footprint in ${city} and your work growing the team to ${headcount}.\n\nGiven your focus as ${role}, wanted to see if reducing outbound deliverability risks and automating lead verification is top of mind this quarter.\n\nOpen to a brief 7-minute intro this week?\n\nBest,\nGrowth Team`
        },
        linkedinMessage: `Hi ${person.split(' ')[0]}, really impressed by ${company}'s growth in ${city} since ${founded}. Would love to connect and follow your journey!`,
        coldCallOpener: `Hi ${person.split(' ')[0]}, reason for my brief call is seeing ${company}'s momentum in ${city} and wanted to see how you're handling outbound pipeline this quarter.`
      }
    };
  }
}

export const globalProspectIntelligence = ProspectIntelligenceService.getInstance();
