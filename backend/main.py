"""
Website Contact Scraper - Python Local Backend
Runs locally with Crawl4AI + Playwright, Gemini API, and openpyxl
"""

import os
import sys
import json
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from crawler.playwright_crawler import PythonCrawler
from extraction.gemini_extractor import extract_with_gemini, test_api_key
from exporters.excel_exporter import create_excel_report

app = FastAPI(title="Website Contact Scraper Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")

crawler = PythonCrawler()

class SettingsModel(BaseModel):
    gemini_api_key: Optional[str] = ""
    max_pages: Optional[int] = 10
    max_contacts: Optional[int] = 2
    smart_discovery: Optional[bool] = True
    concurrency: Optional[int] = 3
    request_delay_ms: Optional[int] = 1000
    timeout_ms: Optional[int] = 15000
    retry_count: Optional[int] = 2
    priority_roles: Optional[List[str]] = []
    generic_email_patterns: Optional[List[str]] = []
    ai_agent_rules: Optional[str] = ""
    theme: Optional[str] = "dark"

class StartScrapeRequest(BaseModel):
    urls: List[str]
    settings: Optional[Dict[str, Any]] = None

def load_settings() -> Dict[str, Any]:
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
        "max_pages": 10,
        "max_contacts": 2,
        "smart_discovery": True,
        "concurrency": 3,
        "request_delay_ms": 1000,
        "timeout_ms": 15000,
        "retry_count": 2,
        "theme": "dark",
    }

def save_settings(settings: Dict[str, Any]):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)

@app.get("/api/health")
async def health():
    return {"status": "ok", "backend": "python", "version": "1.0.0"}

@app.get("/api/settings")
async def get_settings():
    s = load_settings()
    key = s.get("gemini_api_key", "")
    masked = f"{key[:6]}...{key[-4:]}" if len(key) > 10 else ""
    return {**s, "gemini_api_key_masked": masked, "has_key": bool(key and len(key) > 5)}

@app.post("/api/settings")
async def update_settings(payload: SettingsModel):
    current = load_settings()
    updated = {**current, **payload.dict(exclude_unset=True)}
    save_settings(updated)
    key = updated.get("gemini_api_key", "")
    masked = f"{key[:6]}...{key[-4:]}" if len(key) > 10 else ""
    return {**updated, "gemini_api_key_masked": masked, "has_key": bool(key and len(key) > 5)}

@app.post("/api/test-key")
async def test_key(payload: Dict[str, str]):
    key = payload.get("apiKey") or load_settings().get("gemini_api_key", "")
    res = await test_api_key(key)
    return res

@app.post("/api/scrape/start")
async def start_scrape(payload: StartScrapeRequest):
    if not payload.urls:
        raise HTTPException(status_code=400, detail="No URLs provided")
    settings = load_settings()
    if payload.settings:
        settings.update(payload.settings)
    job = crawler.start_job(payload.urls, settings)
    return {"success": True, "job": job}

@app.post("/api/scrape/pause")
async def pause_scrape():
    crawler.pause()
    return {"success": True}

@app.post("/api/scrape/resume")
async def resume_scrape():
    crawler.resume()
    return {"success": True}

@app.post("/api/scrape/stop")
async def stop_scrape():
    crawler.stop()
    return {"success": True}

@app.get("/api/scrape/status")
async def scrape_status():
    return {"job": crawler.get_current_job()}

@app.get("/api/export/xlsx")
async def export_xlsx(jobId: Optional[str] = Query(None)):
    job = crawler.get_current_job()
    if not job:
        raise HTTPException(status_code=404, detail="No job available")
    buffer = create_excel_report(job)
    return Response(
        content=buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=website_contacts.xlsx"},
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run("main:app", host="127.0.0.1", port=port, log_level="info")
