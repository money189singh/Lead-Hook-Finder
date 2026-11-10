"""
Gemini Extraction Module for Python Backend
Calls gemini-3.8-flash with structured JSON output and AI Agent Rules
"""

import os
import json
from typing import Dict, Any, List

async def test_api_key(api_key: str) -> Dict[str, Any]:
    if not api_key or len(api_key.strip()) < 10:
        return {"success": False, "message": "API key is too short or empty."}
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents="Respond with OK",
        )
        if response and response.text:
            return {"success": True, "message": "Connected to Gemini API successfully!"}
        return {"success": False, "message": "Empty response from Gemini."}
    except Exception as e:
        return {"success": False, "message": str(e)}

async def extract_with_gemini(data: Dict[str, Any], api_key: str) -> Dict[str, Any]:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    
    prompt = f"""Target Website: {data.get('url')}
Content:
{data.get('content', '')[:10000]}

Pre-detected emails: {data.get('emails', [])}
Pre-detected phones: {data.get('phones', [])}

Extract official company name and business contacts strictly according to rules."""

    system_instruction = data.get("ai_agent_rules") or (
        "Extract only publicly available business contact information from the supplied website content.\n"
        "Never hallucinate. Never invent emails or people. Keep generic emails unassigned unless tied to a person."
    )

    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )

    return json.loads(response.text)
