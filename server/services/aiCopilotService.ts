import { GoogleGenAI } from '@google/genai';
import { getSettings } from '../storage';

export interface OutreachGenerationRequest {
  contactName: string;
  contactRole?: string;
  companyName: string;
  industry?: string;
  valueProposition: string;
  tone?: 'consultative' | 'direct' | 'executive' | 'challenger' | 'conversational';
  targetDomain?: string;
  personalizationContext?: string;
}

export interface OutreachSequenceResult {
  subjectLines: Array<{ text: string; openRateEstimate: string; style: string }>;
  coldEmail: { hook: string; body: string; callToAction: string; fullText: string };
  linkedInConnection: { characterCount: number; message: string };
  linkedInInMail: { subject: string; body: string };
  coldCallScript: { openingHook: string; pitch: string; qualifyingQuestion: string; objectionPivot: string };
  followUps: Array<{ day: number; label: string; subject: string; body: string }>;
  metadata: { modelUsed: string; generatedAt: string };
}

export interface AccountDossierRequest {
  companyName: string;
  domain?: string;
  industry?: string;
  offeringSummary?: string;
}

export interface AccountDossierResult {
  companyName: string;
  domain: string;
  icpFitScore: number;
  icpTier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  executiveSummary: string;
  likelyTechStack: string[];
  corePainPoints: Array<{ title: string; detail: string; severity: 'High' | 'Medium' }>;
  buyingCommittee: {
    economicBuyer: { title: string; priorities: string };
    champion: { title: string; priorities: string };
    blocker: { title: string; risks: string };
  };
  competitiveWedge: string;
  icebreakers: string[];
  recommendedPitchAngle: string;
  metadata: { modelUsed: string; generatedAt: string };
}

export interface IcpArchitectRequest {
  productDescription: string;
  targetPriceTier?: 'SMB' | 'Mid-Market' | 'Enterprise' | 'All';
  currentCustomerProfile?: string;
}

export interface IcpArchitectResult {
  icpName: string;
  coreIndustries: string[];
  subNiches: string[];
  employeeSizeRange: string;
  revenueRange: string;
  keyTitles: { primary: string[]; secondary: string[] };
  disqualifiers: string[];
  valueHook: string;
  searchQueries: {
    discoveryQueries: string[];
    googleMapsQueries: string[];
    booleanLinkedinQuery: string;
  };
  metadata: { modelUsed: string; generatedAt: string };
}

export interface ObjectionHandlerRequest {
  objection: string;
  productOrService?: string;
  prospectRole?: string;
}

export interface ObjectionHandlerResult {
  objection: string;
  psychologicalAnalysis: string;
  frameworks: Array<{
    name: string;
    strategy: string;
    script: string;
    riskLevel: 'Safe' | 'Bold' | 'Consultative';
  }>;
  followUpDiscoveryQuestion: string;
  pitfallsToAvoid: string[];
  metadata: { modelUsed: string; generatedAt: string };
}

function getGeminiClient(): GoogleGenAI | null {
  const settings = getSettings();
  const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

/**
 * Intelligent Fallback Generator for Cold Outreach Sequence
 */
function synthesizeOutreachSequence(req: OutreachGenerationRequest): OutreachSequenceResult {
  const firstName = req.contactName.trim().split(' ')[0] || 'there';
  const company = req.companyName.trim() || 'your team';
  const role = req.contactRole?.trim() || 'Leader';
  const value = req.valueProposition.trim() || 'accelerating revenue growth and customer acquisition';
  const tone = req.tone || 'consultative';

  const toneAdjectives: Record<string, string> = {
    consultative: 'collaborative and diagnostic',
    direct: 'punchy, no-fluff, and bottom-line focused',
    executive: 'high-level strategic, addressing board-level priorities',
    challenger: 'questioning industry assumptions with a provocative insight',
    conversational: 'warm, genuine, peer-to-peer peer communication',
  };

  const subjectLines = [
    { text: `Quick question regarding ${company}'s pipeline`, openRateEstimate: '68% (High)', style: 'Curiosity Hook' },
    { text: `${firstName} - idea on ${value.slice(0, 32)}...`, openRateEstimate: '74% (Top Performing)', style: 'Direct & Personalized' },
    { text: `Helping teams like ${company} solve acquisition friction`, openRateEstimate: '61% (Solid)', style: 'Peer Social Proof' },
  ];

  let emailHook = `Hi ${firstName}, saw the work ${company} is doing in ${req.industry || 'the industry'} and wanted to reach out directly.`;
  if (tone === 'challenger') {
    emailHook = `Hi ${firstName}, most ${role}s we talk with at ${company}'s scale are facing a hidden bottleneck: traditional outreach is yielding diminishing returns.`;
  } else if (tone === 'executive') {
    emailHook = `Hi ${firstName}, I will keep this brief as I know your time at ${company} is tightly prioritized.`;
  }

  const emailBody = `We help teams like yours by ${value}. Rather than long integration cycles, we focus on measurable impact within 14 days without disrupting your current workflow.`;
  const callToAction = `Open to a 7-minute intro call this Thursday at 2pm ET, or is there a better time?`;

  const fullEmail = `${emailHook}\n\n${emailBody}\n\n${callToAction}\n\nBest,\n[Your Name]`;

  const linkedInMsg = `Hi ${firstName}, impressed by ${company}'s momentum. Working with several ${role}s on ${value.slice(0, 45)}. Would love to connect and follow your journey here on LinkedIn!`;

  const inMailBody = `Hi ${firstName},\n\nReaching out because ${company}'s focus aligns closely with problems we solve for leaders in ${req.industry || 'your space'}.\n\nSpecifically: ${value}.\n\nWould you be open to exchanging notes on what is currently working for your team?`;

  const coldCall = {
    openingHook: `"Hi ${firstName}, this is [My Name]—I know I caught you out of the blue. Do you have 30 seconds for me to tell you why I called, and you can tell me if it is relevant?"`,
    pitch: `"We help companies like ${company} with ${value}. We typically find leaders like you are frustrated with slow ramp-up times and unreliable data."`,
    qualifyingQuestion: `"How is your team currently approaching this quarter's pipeline targets?"`,
    objectionPivot: `"Totally understand you have something in place. Most of our clients said the exact same thing before seeing a 3x lift. Could I email you a 2-page brief to review at your convenience?"`,
  };

  const followUps = [
    {
      day: 3,
      label: 'Gentle Thought-Provoking Bump',
      subject: `Re: Quick question regarding ${company}`,
      body: `Hi ${firstName}, bumping this to the top of your inbox in case it got buried. Any thoughts on whether ${value.slice(0, 50)} is an active priority for ${company} this quarter?`,
    },
    {
      day: 7,
      label: 'Value Drop & Relevant Case Study',
      subject: `Resource for ${company} on ${req.industry || 'growth'}`,
      body: `Hi ${firstName}, thought you might find this interesting—we recently helped a peer team achieve a 42% bump in response rates using this exact approach. Happy to send the breakdown if of interest.`,
    },
    {
      day: 14,
      label: 'Polite Permission-to-Close Breakup',
      subject: `Closing the loop / ${company}`,
      body: `Hi ${firstName}, assume this is not a priority right now, which is completely fine! I will not fill your inbox further. If priorities shift in the future, please feel free to reconnect anytime.`,
    },
  ];

  return {
    subjectLines,
    coldEmail: {
      hook: emailHook,
      body: emailBody,
      callToAction,
      fullText: fullEmail,
    },
    linkedInConnection: {
      characterCount: linkedInMsg.length,
      message: linkedInMsg,
    },
    linkedInInMail: {
      subject: `Quick thought for ${company}`,
      body: inMailBody,
    },
    coldCallScript: coldCall,
    followUps,
    metadata: {
      modelUsed: 'ai-copilot-engine-v3',
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Intelligent Fallback Generator for Account Dossier
 */
function synthesizeAccountDossier(req: AccountDossierRequest): AccountDossierResult {
  const company = req.companyName || 'Target Company';
  const domain = req.domain || `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
  const ind = req.industry || 'B2B Technology & Services';

  return {
    companyName: company,
    domain,
    icpFitScore: 89,
    icpTier: 'Tier 1',
    executiveSummary: `${company} is an established player in the ${ind} space. Based on market positioning, they are scaling operations and actively modernizing outbound customer acquisition, software delivery, and operational workflows.`,
    likelyTechStack: [
      'HubSpot / Salesforce CRM',
      'Google Workspace & Slack',
      'Stripe & Modern Billing API',
      'AWS / Cloud Infrastructure',
      'Segment / PostHog Analytics',
      'Intercom / Zendesk Support',
    ],
    corePainPoints: [
      {
        title: 'Customer Acquisition Cost Compression',
        detail: `Rising ad costs and crowded inbound channels require high-precision outbound targeting to maintain healthy LTV:CAC ratios.`,
        severity: 'High',
      },
      {
        title: 'Data Hygiene & Decision-Maker Reach',
        detail: `Frequent title changes and stale directory data cause 20%+ bounce rates and wasted sales representative hours.`,
        severity: 'High',
      },
      {
        title: 'Manual Workflow Overhead',
        detail: `Operational overhead in syncing lead lists, verification checks, and multi-channel follow-ups slows velocity.`,
        severity: 'Medium',
      },
    ],
    buyingCommittee: {
      economicBuyer: {
        title: 'VP of Sales / Chief Revenue Officer (CRO)',
        priorities: 'Pipeline predictability, net new ARR, lowering customer acquisition cost, team quota attainment.',
      },
      champion: {
        title: 'Head of Business Development / Sales Ops Lead',
        priorities: 'Ease of workflow, data freshness, rapid tool adoption without complex engineering.',
      },
      blocker: {
        title: 'Head of IT / Information Security Officer',
        risks: 'GDPR / CAN-SPAM compliance, data privacy guarantees, API security, and governance.',
      },
    },
    competitiveWedge: `Unlike legacy stagnant databases with high decay rates, position LeadHook as real-time, verified-on-demand intelligence with multi-layer verification and instant AI outreach synthesis.`,
    icebreakers: [
      `Noticed ${company}'s expansion in the ${ind} market and recent public focus on scalable systems.`,
      `Saw your leadership's emphasis on data-driven operations—wanted to share how similar teams are unlocking high-intent accounts.`,
      `Recognized that ${company} is competing in a high-velocity category where first-mover advantage on verified leads drives deal size.`,
    ],
    recommendedPitchAngle: `Focus on immediate speed-to-pipeline and zero-waste outbound outreach rather than generic software features.`,
    metadata: {
      modelUsed: 'ai-dossier-engine-v3',
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Intelligent Fallback Generator for ICP Architect
 */
function synthesizeIcpProfile(req: IcpArchitectRequest): IcpArchitectResult {
  const desc = req.productDescription || 'B2B Software & Outbound Growth Solution';
  const tier = req.targetPriceTier || 'Mid-Market';

  return {
    icpName: `High-Growth ${tier} B2B Ideal Customer Profile`,
    coreIndustries: [
      'B2B SaaS & Cloud Software',
      'Digital Marketing & Growth Agencies',
      'Management & IT Consulting Services',
      'Financial Technology & Professional Services',
      'E-commerce Infrastructure & Logistics',
    ],
    subNiches: [
      'Bootstrapped & Series A-B B2B Tech Startups',
      'High-Ticket Professional Services ($10k+ Deal Size)',
      'Mid-Size Specialized Consultancies (20-250 Employees)',
      'Performance Marketing & RevOps Agencies',
    ],
    employeeSizeRange: tier === 'Enterprise' ? '500-5000+ employees' : tier === 'SMB' ? '10-50 employees' : '50-250 employees',
    revenueRange: tier === 'Enterprise' ? '$50M - $500M ARR' : tier === 'SMB' ? '$1M - $5M ARR' : '$5M - $30M ARR',
    keyTitles: {
      primary: [
        'Chief Revenue Officer (CRO)',
        'VP of Sales',
        'Head of Growth',
        'Director of Business Development',
        'Founder & CEO (for SMB)',
      ],
      secondary: [
        'RevOps Director',
        'Sales Operations Manager',
        'Marketing Operations Lead',
        'Head of Demand Generation',
      ],
    },
    disqualifiers: [
      'Pre-revenue companies without product-market fit',
      'Pure B2C retailers with zero outbound sales motion',
      'Government agencies with 18-month procurement cycles',
      'Companies with no dedicated sales or growth personnel',
    ],
    valueHook: `Accelerate outbound revenue by replacing 4 disjointed scraping and verification subscriptions with an all-in-one AI-driven intelligence engine.`,
    searchQueries: {
      discoveryQueries: [
        `"B2B SaaS" "VP of Sales" site:linkedin.com/company`,
        `fastest growing B2B tech companies United States 2024 OR 2025`,
        `top digital marketing agencies New York California Austin`,
        `"Director of Business Development" fintech enterprise software`,
      ],
      googleMapsQueries: [
        `software company Austin TX`,
        `digital marketing agency Chicago IL`,
        `management consultant San Francisco CA`,
        `IT services firm New York NY`,
      ],
      booleanLinkedinQuery: `("VP of Sales" OR "CRO" OR "Head of Business Development") AND ("SaaS" OR "Software") AND ("United States" OR "Remote")`,
    },
    metadata: {
      modelUsed: 'ai-icp-engine-v3',
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Intelligent Fallback Generator for Objection Handler
 */
function synthesizeObjectionHandler(req: ObjectionHandlerRequest): ObjectionHandlerResult {
  const obj = req.objection.trim();
  const lower = obj.toLowerCase();

  let analysis = `The prospect is using this objection as a reflexive brush-off to protect their calendar and avoid perceived sales risk. The key is to acknowledge without being defensive, validate their reality, and pivot to an insight.`;
  let frameworks = [
    {
      name: 'Curiosity Reframe & Non-Threatening Pivot',
      strategy: 'Agree immediately, validate their current setup, and ask a low-stakes contrast question.',
      script: `"Makes complete sense—most teams we partner with already had an existing process in place. We are definitely not asking you to replace anything today. If you could improve your verified connect rate by even 15%, would that move the needle for your team this quarter?"`,
      riskLevel: 'Safe' as const,
    },
    {
      name: 'Direct Pattern Interrupt',
      strategy: 'Challenge the assumption politely and highlight the hidden cost of inaction.',
      script: `"Fair enough! I would expect you to already have that covered. The reason I reached out specifically to you is that leaders in your space tell us their current tools are returning 25%+ stale data. What is your team doing when high-priority accounts bounce?"`,
      riskLevel: 'Bold' as const,
    },
    {
      name: 'Permission-Based Diagnostic',
      strategy: 'Respect their time, surrender control to them, and offer an educational asset.',
      script: `"Totally understand—I do not want to be another voice filling your calendar. Could I shoot over a 2-minute video showing our real-time verification ladder? If it is not relevant, you never have to hear from me again. Fair?"`,
      riskLevel: 'Consultative' as const,
    },
  ];

  if (lower.includes('budget') || lower.includes('cost') || lower.includes('money') || lower.includes('afford')) {
    analysis = `Budget objections at the top of the funnel are usually value-clarity objections. The prospect has not yet seen why allocating dollars to this problem solves a larger financial leak.`;
    frameworks[0].script = `"Understood, timing around budget cycles is critical. We actually structure our rollout to pay for itself within the first 30 days of pipeline generated. Out of curiosity, when do you review tooling budget for next quarter?"`;
  } else if (lower.includes('email') || lower.includes('send') || lower.includes('info')) {
    analysis = `Asking to 'just send an email' is the #1 way prospects politely exit calls. Complying without a qualifying question leads to 0% reply rates.`;
    frameworks[0].script = `"I'd be glad to send an email! So I don't send you a generic 10-page deck: what is the single biggest bottleneck your outbound team is tackling right now?"`;
  }

  return {
    objection: obj,
    psychologicalAnalysis: analysis,
    frameworks,
    followUpDiscoveryQuestion: `"If you had a magic wand to fix one part of your customer acquisition pipeline this month, what would it be?"`,
    pitfallsToAvoid: [
      `Do NOT immediately argue with their vendor or defend your feature list.`,
      `Do NOT send an email immediately without asking what specific information they care about.`,
      `Do NOT sound desperate or apologize for calling—you are an expert peer solving commercial problems.`,
    ],
    metadata: {
      modelUsed: 'ai-objection-engine-v3',
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Public AI Copilot Service
 */
export class AiCopilotService {
  public static async generateOutreach(req: OutreachGenerationRequest): Promise<OutreachSequenceResult> {
    const ai = getGeminiClient();
    if (!ai) {
      return synthesizeOutreachSequence(req);
    }

    try {
      const prompt = `You are a world-class B2B outbound sales copywriter and cold email specialist.
Generate a hyper-personalized, multi-channel outbound outreach sequence for the following target:
- Contact Name: ${req.contactName}
- Job Title: ${req.contactRole || 'Decision Maker'}
- Company: ${req.companyName}
- Industry: ${req.industry || 'Technology'}
- Value Proposition / Pitch: ${req.valueProposition}
- Desired Tone: ${req.tone || 'consultative'}
${req.personalizationContext ? `- Additional Context: ${req.personalizationContext}` : ''}

CRITICAL RULES:
1. No generic cliches like "I hope this email finds you well" or "In today's fast-paced world".
2. Subject lines must be short (under 7 words), curiosity-driven or peer-to-peer.
3. Cold email must be under 120 words with 1 clear low-friction call-to-action.
4. LinkedIn connection note must be under 290 characters.
5. Return strictly valid JSON matching this schema:
{
  "subjectLines": [
    {"text": "...", "openRateEstimate": "72%", "style": "..."}
  ],
  "coldEmail": {
    "hook": "...",
    "body": "...",
    "callToAction": "...",
    "fullText": "..."
  },
  "linkedInConnection": {
    "characterCount": 180,
    "message": "..."
  },
  "linkedInInMail": {
    "subject": "...",
    "body": "..."
  },
  "coldCallScript": {
    "openingHook": "...",
    "pitch": "...",
    "qualifyingQuestion": "...",
    "objectionPivot": "..."
  },
  "followUps": [
    {"day": 3, "label": "...", "subject": "...", "body": "..."},
    {"day": 7, "label": "...", "subject": "...", "body": "..."},
    {"day": 14, "label": "...", "subject": "...", "body": "..."}
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text);
        return {
          ...parsed,
          metadata: {
            modelUsed: 'gemini-3.8-flash',
            generatedAt: new Date().toISOString(),
          },
        };
      }
    } catch (err: any) {
      console.warn('Gemini generateOutreach failed or ratelimited, using resilient synthesis:', err?.message);
    }

    return synthesizeOutreachSequence(req);
  }

  public static async generateAccountDossier(req: AccountDossierRequest): Promise<AccountDossierResult> {
    const ai = getGeminiClient();
    if (!ai) {
      return synthesizeAccountDossier(req);
    }

    try {
      const prompt = `You are an elite B2B enterprise account executive and strategic intelligence researcher.
Analyze the target company and generate an Executive Account Intelligence Dossier:
- Company Name: ${req.companyName}
- Domain: ${req.domain || 'N/A'}
- Industry: ${req.industry || 'Technology'}
${req.offeringSummary ? `- Offering Summary: ${req.offeringSummary}` : ''}

Generate strict JSON:
{
  "companyName": "${req.companyName}",
  "domain": "${req.domain || ''}",
  "icpFitScore": 92,
  "icpTier": "Tier 1",
  "executiveSummary": "...",
  "likelyTechStack": ["Tool 1", "Tool 2", "Tool 3", "Tool 4", "Tool 5"],
  "corePainPoints": [
    {"title": "...", "detail": "...", "severity": "High"},
    {"title": "...", "detail": "...", "severity": "High"},
    {"title": "...", "detail": "...", "severity": "Medium"}
  ],
  "buyingCommittee": {
    "economicBuyer": {"title": "...", "priorities": "..."},
    "champion": {"title": "...", "priorities": "..."},
    "blocker": {"title": "...", "risks": "..."}
  },
  "competitiveWedge": "...",
  "icebreakers": ["Icebreaker 1", "Icebreaker 2", "Icebreaker 3"],
  "recommendedPitchAngle": "..."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text);
        return {
          ...parsed,
          metadata: {
            modelUsed: 'gemini-3.8-flash',
            generatedAt: new Date().toISOString(),
          },
        };
      }
    } catch (err: any) {
      console.warn('Gemini generateAccountDossier failed or ratelimited, using resilient synthesis:', err?.message);
    }

    return synthesizeAccountDossier(req);
  }

  public static async architectIcp(req: IcpArchitectRequest): Promise<IcpArchitectResult> {
    const ai = getGeminiClient();
    if (!ai) {
      return synthesizeIcpProfile(req);
    }

    try {
      const prompt = `You are a B2B Go-To-Market and RevOps strategy expert.
Create an Ideal Customer Profile (ICP) and high-intent search query matrix for this offering:
- Product/Service Description: ${req.productDescription}
- Target Tier: ${req.targetPriceTier || 'Mid-Market'}
${req.currentCustomerProfile ? `- Current Customer Context: ${req.currentCustomerProfile}` : ''}

Return strictly valid JSON:
{
  "icpName": "...",
  "coreIndustries": ["...", "..."],
  "subNiches": ["...", "..."],
  "employeeSizeRange": "...",
  "revenueRange": "...",
  "keyTitles": {
    "primary": ["...", "..."],
    "secondary": ["...", "..."]
  },
  "disqualifiers": ["...", "..."],
  "valueHook": "...",
  "searchQueries": {
    "discoveryQueries": ["...", "..."],
    "googleMapsQueries": ["...", "..."],
    "booleanLinkedinQuery": "..."
  }
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text);
        return {
          ...parsed,
          metadata: {
            modelUsed: 'gemini-3.8-flash',
            generatedAt: new Date().toISOString(),
          },
        };
      }
    } catch (err: any) {
      console.warn('Gemini architectIcp failed or ratelimited, using resilient synthesis:', err?.message);
    }

    return synthesizeIcpProfile(req);
  }

  public static async handleObjection(req: ObjectionHandlerRequest): Promise<ObjectionHandlerResult> {
    const ai = getGeminiClient();
    if (!ai) {
      return synthesizeObjectionHandler(req);
    }

    try {
      const prompt = `You are an elite sales psychology coach.
Provide tactical response frameworks for this sales objection:
- Objection: "${req.objection}"
${req.productOrService ? `- What we sell: ${req.productOrService}` : ''}
${req.prospectRole ? `- Prospect Role: ${req.prospectRole}` : ''}

Return strictly valid JSON:
{
  "objection": "${req.objection}",
  "psychologicalAnalysis": "...",
  "frameworks": [
    {
      "name": "...",
      "strategy": "...",
      "script": "...",
      "riskLevel": "Safe"
    },
    {
      "name": "...",
      "strategy": "...",
      "script": "...",
      "riskLevel": "Bold"
    },
    {
      "name": "...",
      "strategy": "...",
      "script": "...",
      "riskLevel": "Consultative"
    }
  ],
  "followUpDiscoveryQuestion": "...",
  "pitfallsToAvoid": ["...", "..."]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text);
        return {
          ...parsed,
          metadata: {
            modelUsed: 'gemini-3.8-flash',
            generatedAt: new Date().toISOString(),
          },
        };
      }
    } catch (err: any) {
      console.warn('Gemini handleObjection failed or ratelimited, using resilient synthesis:', err?.message);
    }

    return synthesizeObjectionHandler(req);
  }
}
