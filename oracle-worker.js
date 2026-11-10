#!/usr/bin/env node
/**
 * LeadHook — Standalone Oracle Cloud 24/7 Scraping Engine (Universal CommonJS)
 * Runs on any Node.js version (16, 18, 20, 22) on Oracle Linux & Ubuntu.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const query = process.argv[2] || 'employment law firms San Diego';
const targetCount = parseInt(process.argv[3] || '25', 10);

console.log('====================================================');
console.log(' 🚀 LeadHook Oracle Cloud Scraping Engine');
console.log(' Provider    : Oracle Cloud Always Free VM');
console.log(' Hostname    :', os.hostname());
console.log(' Platform    :', os.type(), os.release());
console.log(' Target Query:', query);
console.log(' Target Count:', targetCount, 'businesses');
console.log('====================================================');

async function crawlWebsite(url) {
  const result = { emails: [], phones: [] };
  const visited = new Set();

  async function fetchPage(targetUrl) {
    if (visited.has(targetUrl)) return;
    visited.add(targetUrl);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) return;
      const html = await res.text();

      const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const e of emailMatches) {
        const lower = e.toLowerCase();
        if (
          !lower.endsWith('.png') &&
          !lower.endsWith('.jpg') &&
          !lower.endsWith('.jpeg') &&
          !lower.includes('example.com') &&
          !lower.includes('sentry.io') &&
          !lower.includes('wixpress') &&
          !result.emails.includes(lower)
        ) {
          result.emails.push(lower);
        }
      }

      const phoneMatches = html.match(/(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
      for (const p of phoneMatches) {
        if (!result.phones.includes(p)) result.phones.push(p);
      }
    } catch (e) {}
  }

  await fetchPage(url);
  if (result.emails.length === 0) {
    const cleanRoot = url.replace(/\/$/, '');
    await fetchPage(`${cleanRoot}/contact`);
    if (result.emails.length === 0) {
      await fetchPage(`${cleanRoot}/about`);
    }
  }

  result.emails = result.emails.slice(0, 5);
  result.phones = result.phones.slice(0, 3);
  return result;
}

async function searchWebPartition(searchQuery, count) {
  console.log(`[Oracle Worker] Searching partitions for "${searchQuery}" (Target: ${count})...`);
  const results = [];
  const seenDomains = new Set();

  // 1. Primary: High-Speed OpenStreetMap Nominatim Directory (Works without API keys, zero blocking)
  try {
    const cleanQ = searchQuery.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQ)}&format=json&addressdetails=1&extratags=1&limit=${Math.min(count + 5, 50)}`;
    const res = await fetch(osmUrl, {
      headers: {
        'User-Agent': 'LeadHook-OracleWorker/2.5 (oracle-cloud-vm)',
        'Accept': 'application/json'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          if (results.length >= count) break;
          const name = item.name || item.display_name?.split(',')[0]?.trim();
          if (!name || name.length < 3) continue;

          const tags = item.extratags || {};
          const website = tags.website || tags['contact:website'] || tags.url;
          const phone = tags.phone || tags['contact:phone'];
          const city = item.address?.city || item.address?.town || '';
          const state = item.address?.state || '';

          let domain = '';
          let url = website;
          if (website && website.startsWith('http')) {
            try {
              domain = new URL(website).hostname.replace(/^www\./, '');
            } catch {}
          } else {
            const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            domain = `${slug}.com`;
            url = `https://www.${domain}`;
          }

          if (domain && !seenDomains.has(domain)) {
            seenDomains.add(domain);
            results.push({
              name,
              url,
              domain,
              location: `${city}${state ? ', ' + state : ''}`,
              initialPhone: phone || ''
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Oracle Worker] Notice on partition 1:', err.message);
  }

  // 2. Secondary: Bing Search Partition if more candidates needed
  if (results.length < count) {
    try {
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(bingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html'
        }
      });
      if (res.ok) {
        const html = await res.text();
        const linkRegex = /<li class="b_algo"[^>]*>[\s\S]*?<h2><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        while ((match = linkRegex.exec(html)) !== null && results.length < count) {
          let rawUrl = match[1];
          if (rawUrl.includes('u=a1')) {
            const m = rawUrl.match(/u=a1([a-zA-Z0-9_\-]+)/);
            if (m) {
              try {
                const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
                rawUrl = Buffer.from(b64, 'base64').toString('utf-8');
              } catch {}
            }
          }
          if (rawUrl.startsWith('http') && !rawUrl.includes('bing.com')) {
            try {
              const domain = new URL(rawUrl).hostname.replace(/^www\./, '');
              const cleanTitle = match[2].replace(/<[^>]+>/g, '').trim();
              if (domain && !seenDomains.has(domain)) {
                seenDomains.add(domain);
                results.push({ name: cleanTitle, url: rawUrl, domain });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn('[Oracle Worker] Notice on partition 2:', err.message);
    }
  }

  return results;
}

async function run() {
  const discovered = await searchWebPartition(query, targetCount);
  console.log(`[Oracle Worker] Found ${discovered.length} initial business candidates.`);

  const leads = [];
  let index = 1;
  for (const item of discovered) {
    console.log(`[Oracle Worker] [${index}/${discovered.length}] Crawling: ${item.name}...`);
    const contacts = await crawlWebsite(item.url);
    leads.push({
      id: `lead_${Date.now()}_${index}`,
      name: item.name,
      website: item.url,
      domain: item.domain,
      emails: contacts.emails,
      phones: contacts.phones,
      extracted_at: new Date().toISOString(),
      provider: 'Oracle Cloud Always Free VM'
    });
    console.log(`  -> Emails: ${contacts.emails.length} | Phones: ${contacts.phones.length}`);
    index++;
  }

  const jsonPath = path.join(process.cwd(), 'leads.json');
  fs.writeFileSync(jsonPath, JSON.stringify(leads, null, 2), 'utf-8');

  const csvHeaders = 'Name,Website,Domain,Emails,Phones,ExtractedAt,Provider\n';
  const csvRows = leads.map(l =>
    `"${l.name.replace(/"/g, '""')}","${l.website}","${l.domain}","${l.emails.join('; ')}","${l.phones.join('; ')}","${l.extracted_at}","${l.provider}"`
  ).join('\n');
  const csvPath = path.join(process.cwd(), 'leads.csv');
  fs.writeFileSync(csvPath, csvHeaders + csvRows, 'utf-8');

  console.log('====================================================');
  console.log(`🎉 Extracted ${leads.length} leads!`);
  console.log(`Saved files: ${csvPath} and ${jsonPath}`);
  console.log('====================================================');
}

run().catch(err => {
  console.error('[Oracle Worker Error]:', err);
  process.exit(1);
});
