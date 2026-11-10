import { GoogleGenAI, Type } from '@google/genai';
import { getSettings } from './storage';
import { CompanyFirmographics, RoleTier, EmailType, RuleEvaluationItem } from '../src/types';
import { globalEmailClassifier } from './enrichment/emailClassifier';

export interface ExtractedContact {
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  email: string;
  professional_email?: string;
  email_type: EmailType;
  phone: string;
  source_url: string;
  role_tier?: RoleTier;
  linkedin_url?: string;
  association_status?: 'explicit' | 'inferred' | 'none';
  confidence_score?: number;
  email_classification_reason?: string;
  identity_verified?: boolean;
  identity_verification_evidence?: string;
  rule_evaluations?: RuleEvaluationItem[];
}

export interface ExtractionResult {
  company_name: string;
  firmographics?: CompanyFirmographics;
  generic_emails?: string[];
  departmental_emails?: string[];
  contacts: ExtractedContact[];
  rule_evaluations?: RuleEvaluationItem[];
}

function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const settings = getSettings();
  const apiKey = customApiKey || settings.gemini_api_key || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please enter your API key in Settings.');
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function testGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!apiKey || apiKey.trim().length < 10) {
      return { success: false, message: 'API key appears too short or empty.' };
    }
    const ai = getGeminiClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Respond with only the word OK if you can read this.',
    });

    if (response && response.text) {
      return { success: true, message: 'API key is valid and connected successfully!' };
    }
    return { success: false, message: 'Received empty response from Gemini API.' };
  } catch (err: any) {
    console.error('Test API key error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to authenticate with Gemini API. Check your key.',
    };
  }
}

export async function extractContactsWithGemini(params: {
  websiteUrl: string;
  titleCandidate: string;
  rawTextSnippets: { url: string; text: string; pageTitle?: string }[];
  detectedEmails: string[];
  detectedPhones: string[];
  priorityRoles: string[];
  genericPatterns: string[];
  maxContacts: number;
  customRules?: string;
}): Promise<ExtractionResult> {
  const {
    websiteUrl,
    titleCandidate,
    rawTextSnippets,
    detectedEmails,
    detectedPhones,
    priorityRoles,
    genericPatterns,
    maxContacts,
    customRules,
  } = params;

  const ai = getGeminiClient();

  const formattedContext = rawTextSnippets
    .map((s, idx) => `--- PAGE ${idx + 1} (${s.url}) [Title: ${s.pageTitle || 'N/A'}] ---\n${s.text.slice(0, 3500)}`)
    .join('\n\n');

  const systemInstruction = `${customRules || 'Extract only publicly available business contact information from the supplied website content.'}

CRITICAL ACCURACY & GROUNDING RULES:
1. NEVER hallucinate or invent a person, name, email address, or phone number.
2. NEVER guess roles or infer seniority (e.g. do not assume someone is CEO unless explicitly titled as such on the page).
3. NEVER generate an email address from a person's name (e.g. do not construct john.doe@company.com if only John Doe is mentioned).
4. Only associate an email with a person when the website explicitly connects them or the layout clearly associates them.
5. If a general email (info@, sales@, contact@) is found without being assigned to a named person, you may include it as a generic contact with full_name: "" and role: "Company General" and email_type: "Generic".
6. If any data field is missing or uncertain, return an empty string "".
7. Always provide the source_url where the person or contact was found.
8. Email types: "Personal" (direct person's email), "Role-based" (e.g. editor@, director@, press@), or "Generic" (info@, contact@, sales@, etc.).
9. Priority Roles to look for (if explicitly stated): ${priorityRoles.join(', ')}.
10. Maximum contacts to return: ${maxContacts > 0 ? maxContacts : 'all verified contacts found'}.
11. Return strict JSON matching the schema.`;

  const userPrompt = `Target Website: ${websiteUrl}
Possible Company Name: ${titleCandidate || 'Unknown'}

Pre-detected emails on site: ${detectedEmails.length > 0 ? detectedEmails.join(', ') : 'None'}
Pre-detected phone numbers: ${detectedPhones.length > 0 ? detectedPhones.join(', ') : 'None'}

Here is the extracted textual content from the company's public website pages:
${formattedContext}

Identify the official Company Name and extract all explicitly verified business contacts according to the rules.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            company_name: {
              type: Type.STRING,
              description: 'Official company name found on the website',
            },
            firmographics: {
              type: Type.OBJECT,
              properties: {
                industry: { type: Type.STRING, description: 'Primary industry / commercial vertical' },
                employee_tier: { type: Type.STRING, description: 'Company size: 1-10, 11-50, 51-200, 201-500, 501-1000, or 1000+' },
                employee_count: { type: Type.STRING, description: 'Exact number of employees if explicitly stated, otherwise empty' },
                founded_year: { type: Type.STRING, description: 'Exact 4-digit founding year, otherwise empty' },
                location: { type: Type.STRING, description: 'Headquarters street, city, state, and country' },
                headquarters: { type: Type.STRING, description: 'Headquarters city and state/country' },
                country_code: { type: Type.STRING, description: 'International country calling code (e.g. +1, +44)' },
                offering_summary: { type: Type.STRING, description: 'Summary of core products or service offerings' },
              },
            },
            generic_emails: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Company-level generic inboxes (e.g. info@, contact@, hello@)',
            },
            departmental_emails: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Departmental inboxes (e.g. sales@, press@, careers@, billing@)',
            },
            contacts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  first_name: { type: Type.STRING },
                  last_name: { type: Type.STRING },
                  full_name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  role_tier: {
                    type: Type.STRING,
                    description: 'C-Suite / Executive, Sales & Marketing, Procurement & Operations, Technical / Engineering, Finance & Legal, General Management, or Other Staff',
                  },
                  professional_email: { type: Type.STRING, description: 'Direct professional email associated with this person, or empty' },
                  email: { type: Type.STRING },
                  email_type: {
                    type: Type.STRING,
                    description: 'Personal, Role-based, or Generic',
                  },
                  association_status: { type: Type.STRING, description: 'explicit, inferred, or none' },
                  confidence_score: { type: Type.INTEGER, description: '0 to 100 confidence score' },
                  phone: { type: Type.STRING },
                  linkedin_url: { type: Type.STRING, description: 'Personal LinkedIn profile URL if explicitly found' },
                  source_url: { type: Type.STRING },
                },
                required: ['first_name', 'last_name', 'full_name', 'role', 'email', 'email_type', 'phone', 'source_url'],
              },
            },
          },
          required: ['company_name', 'contacts'],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);

    const validContacts: ExtractedContact[] = (parsed.contacts || []).map((c: any) => {
      const email = String(c.email || c.professional_email || '').trim().toLowerCase();
      const fullName = String(c.full_name || `${c.first_name || ''} ${c.last_name || ''}`).trim();
      const role = String(c.role || '').trim();
      const sourceUrl = String(c.source_url || websiteUrl).trim();

      // Deterministic classification
      const classification = globalEmailClassifier.classify(
        email,
        {
          fullName,
          firstName: c.first_name,
          lastName: c.last_name,
          role,
          sourceUrl,
        },
        genericPatterns
      );

      const isGeneric = classification.isGeneric;
      const profEmail = String(c.professional_email || '').trim().toLowerCase();
      const finalProfEmail = (!isGeneric && (profEmail || email)) ? (profEmail || email) : undefined;

      return {
        first_name: String(c.first_name || '').trim(),
        last_name: String(c.last_name || '').trim(),
        full_name: fullName,
        role: role || (classification.isGeneric ? 'Company General' : 'Business Contact'),
        role_tier: c.role_tier,
        email: isGeneric ? '' : (finalProfEmail || email),
        professional_email: finalProfEmail,
        association_status: (c.association_status as any) || (finalProfEmail ? 'explicit' : 'none'),
        confidence_score: typeof c.confidence_score === 'number' ? c.confidence_score : (finalProfEmail ? 90 : 50),
        email_type: classification.classification,
        email_classification_reason: classification.reason,
        identity_verified: classification.identityVerified,
        identity_verification_evidence: classification.reason,
        phone: String(c.phone || '').trim(),
        linkedin_url: c.linkedin_url ? String(c.linkedin_url).trim() : undefined,
        source_url: sourceUrl,
      };
    });

    return {
      company_name: String(parsed.company_name || titleCandidate || '').trim(),
      firmographics: parsed.firmographics ? {
        industry: parsed.firmographics.industry || undefined,
        employee_tier: parsed.firmographics.employee_tier || undefined,
        employee_count: parsed.firmographics.employee_count || undefined,
        founded_year: parsed.firmographics.founded_year || undefined,
        location: parsed.firmographics.location || undefined,
        headquarters: parsed.firmographics.headquarters || undefined,
        country_code: parsed.firmographics.country_code || undefined,
        offering_summary: parsed.firmographics.offering_summary || undefined,
      } : undefined,
      generic_emails: Array.isArray(parsed.generic_emails) ? parsed.generic_emails.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean) : undefined,
      departmental_emails: Array.isArray(parsed.departmental_emails) ? parsed.departmental_emails.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean) : undefined,
      contacts: validContacts,
    };
  } catch (err: any) {
    console.error('Gemini extraction error:', err);
    throw new Error(`Gemini extraction failed: ${err.message}`);
  }
}

export async function executeAiPrompt(prompt: string): Promise<string> {
  const settings = getSettings();
  const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }
  const ai = getGeminiClient(apiKey);
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
    });
    return response.text || '';
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      return response.text || '';
    }
    throw err;
  }
}

