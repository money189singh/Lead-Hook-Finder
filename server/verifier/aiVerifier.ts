import { executeAiPrompt } from '../gemini';
import { BusinessStatus, StatusConfidence } from '../../src/types';

export interface AiVerificationInput {
  business_name: string;
  domain: string;
  address?: string;
  google_status?: string;
  google_match?: string;
  website_status?: string;
  website_http_status?: number;
  recent_content_date?: string;
  closure_signals?: string[];
  latest_review_date?: string;
  government_status?: string;
  search_evidence?: string;
  user_rules?: string;
}

export interface AiVerificationOutput {
  status: BusinessStatus;
  confidence: StatusConfidence;
  reasoning: string;
  evidence_summary: string;
}

export class AiEvidenceVerifier {
  /**
   * Interprets conflicting or ambiguous verification evidence via AI router with strict token-budget optimization
   */
  public async interpretEvidence(input: AiVerificationInput): Promise<AiVerificationOutput> {
    const structuredEvidence = {
      business_name: input.business_name,
      domain: input.domain,
      address: input.address || 'Not provided',
      google_maps_status: input.google_status || 'Not checked / Not found',
      google_maps_match: input.google_match || 'None',
      website_status: input.website_status || 'Unknown',
      website_http_code: input.website_http_status || 'None',
      latest_website_content_date: input.recent_content_date || 'UNKNOWN',
      closure_signals_detected_on_page: input.closure_signals?.length ? input.closure_signals : 'None',
      government_registry_status: input.government_status || 'Not checked',
      search_engine_evidence: input.search_evidence || 'None',
    };

    const prompt = `You are an expert business operational status auditor.
Analyze the following structured evidence to determine if the business is currently OPERATING, TEMPORARILY CLOSED, PERMANENTLY CLOSED, or UNCERTAIN.

CORE AUDITING RULES:
1. Never guess. If evidence is conflicting, too old, or insufficient to prove current operations, return "UNCERTAIN".
2. "OPEN" requires credible evidence of active current operations (e.g. working website, positive reviews, Google operational, active listings).
3. "PERMANENTLY CLOSED" requires explicit authoritative confirmation of closure.
4. "TEMPORARILY CLOSED" requires verified temporary shutdown notice.
5. Confidence must be "HIGH", "MEDIUM", or "LOW".

USER CUSTOM RULES:
${input.user_rules || 'Standard rules apply.'}

STRUCTURED EVIDENCE COLLECTED:
${JSON.stringify(structuredEvidence, null, 2)}

Respond with a JSON object strictly adhering to this schema:
{
  "status": "OPEN" | "TEMPORARILY CLOSED" | "PERMANENTLY CLOSED" | "UNCERTAIN",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "Concise explanation of the rationale",
  "evidence_summary": "One sentence summary of decisive evidence points"
}`;

    try {
      const rawText = await executeAiPrompt(prompt);
      const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      let finalStatus: BusinessStatus = 'UNCERTAIN';
      if (['OPEN', 'TEMPORARILY CLOSED', 'PERMANENTLY CLOSED', 'UNCERTAIN'].includes(parsed.status)) {
        finalStatus = parsed.status as BusinessStatus;
      }

      let confidence: StatusConfidence = 'MEDIUM';
      if (['HIGH', 'MEDIUM', 'LOW'].includes(parsed.confidence)) {
        confidence = parsed.confidence as StatusConfidence;
      }

      return {
        status: finalStatus,
        confidence,
        reasoning: parsed.reasoning || 'AI evidence synthesis completed.',
        evidence_summary: parsed.evidence_summary || `AI synthesis concluded ${finalStatus} with ${confidence} confidence.`,
      };
    } catch (err: any) {
      // Graceful fallback to deterministic analysis if AI call fails
      return {
        status: 'UNCERTAIN',
        confidence: 'LOW',
        reasoning: `AI synthesis failed or timed out: ${err.message}. Defaulting safely to UNCERTAIN.`,
        evidence_summary: 'AI interpreter unavailable. Marked UNCERTAIN per zero-guesswork policy.',
      };
    }
  }
}

export const globalAiVerifier = new AiEvidenceVerifier();
