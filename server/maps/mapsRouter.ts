import { Router } from 'express';
import * as XLSX from 'xlsx';
import { globalGoogleMapsScraper } from './mapsScraper';
import { GoogleMapsLead } from '../../src/types';

export const mapsRouter = Router();

// Start a new Google Maps lead scraping job
mapsRouter.post('/scrape', async (req, res) => {
  try {
    const { command, query, location, targetCount, autoScrapeWebsites, autoVerifyEmails, userId } = req.body;
    const searchCommand = (command || query || '').trim();
    if (!searchCommand) {
      return res.status(400).json({ error: 'Search command is required (e.g. "car repair shop in new york")' });
    }

    const job = await globalGoogleMapsScraper.createAndStartJob({
      command: searchCommand,
      location: location ? String(location).trim() : undefined,
      targetCount: targetCount ? parseInt(targetCount, 10) : 25,
      autoScrapeWebsites: autoScrapeWebsites !== false,
      autoVerifyEmails: autoVerifyEmails !== false,
      userId,
    });

    res.json(job);
  } catch (err: any) {
    console.error('Error starting Google Maps scraping job:', err);
    res.status(500).json({ error: err.message || 'Failed to start Google Maps scraping job' });
  }
});

// AI Recommendations for Google Maps queries & high-density targets
mapsRouter.post('/recommendations', async (req, res) => {
  try {
    const { command, location } = req.body;
    const recommendations = await globalGoogleMapsScraper.getAiRecommendations(
      command || 'law firms',
      location || undefined
    );
    res.json(recommendations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all jobs
mapsRouter.get('/jobs', (req, res) => {
  try {
    const jobs = globalGoogleMapsScraper.getAllJobs();
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get job details & live progress
mapsRouter.get(['/job/:id', '/jobs/:id'], (req, res) => {
  try {
    const job = globalGoogleMapsScraper.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Maps job not found' });
    }
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stop a running job
mapsRouter.post(['/job/:id/stop', '/jobs/:id/stop'], (req, res) => {
  try {
    const success = globalGoogleMapsScraper.stopJob(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a job
mapsRouter.delete('/job/:id', (req, res) => {
  try {
    const success = globalGoogleMapsScraper.deleteJob(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Deep crawl website for a single place on demand
mapsRouter.post('/crawl-website', async (req, res) => {
  try {
    const { websiteUrl, companyName, isLegal } = req.body;
    if (!websiteUrl) {
      return res.status(400).json({ error: 'websiteUrl is required' });
    }
    const result = await globalGoogleMapsScraper.scrapePlaceWebsiteContacts(
      websiteUrl,
      companyName || '',
      Boolean(isLegal)
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export to XLSX
mapsRouter.get('/export/:id/xlsx', async (req, res) => {
  try {
    const job = globalGoogleMapsScraper.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const rows = job.leads.map((lead) => {
      const emailList = (lead.extracted_emails || []).map((e) => e.email).join(', ');
      const contactList = (lead.contacts || []).map((c) => `${c.name} (${c.role})`).join(', ');
      const dmList = (lead.decision_makers || [])
        .map((dm) => `${dm.name} - ${dm.role}${dm.email ? ` [${dm.email}]` : ''}`)
        .join('; ');

      return {
        'Business Name': lead.name,
        'Category': lead.category || '',
        'Phone Number': lead.phone || '',
        'Direct Emails': emailList,
        'Decision Makers & Leadership': dmList || contactList,
        'Website': lead.website || '',
        'Full Address': lead.address || '',
        'Rating': lead.rating ? `${lead.rating} ★` : '',
        'Reviews Count': lead.reviews_count || '',
        'Lead Score': lead.lead_score || '',
        'Priority Tier': lead.priority_tier || '',
        'Google Maps Link': lead.maps_url,
        'Scraped At': lead.scraped_at || '',
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Google Maps Leads');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safeTitle = (job.command || 'google_maps_leads').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="leadhook_maps_${safeTitle}.xlsx"`);
    res.send(buf);
  } catch (err: any) {
    console.error('XLSX export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export to CSV
mapsRouter.get('/export/:id/csv', (req, res) => {
  try {
    const job = globalGoogleMapsScraper.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const headers = [
      'Business Name',
      'Category',
      'Phone Number',
      'Extracted Emails',
      'Decision Makers & Roles',
      'Key Contacts',
      'Website',
      'Address',
      'Rating',
      'Reviews Count',
      'Lead Score',
      'Priority Tier',
      'Google Maps URL',
    ];

    const rows = job.leads.map((lead) => {
      const dmList = (lead.decision_makers || [])
        .map((dm) => `${dm.name} (${dm.role})`)
        .join('; ');

      return [
        `"${(lead.name || '').replace(/"/g, '""')}"`,
        `"${(lead.category || '').replace(/"/g, '""')}"`,
        `"${(lead.phone || '').replace(/"/g, '""')}"`,
        `"${(lead.extracted_emails || []).map((e) => e.email).join('; ')}"`,
        `"${dmList.replace(/"/g, '""')}"`,
        `"${(lead.contacts || []).map((c) => `${c.name} (${c.role})`).join('; ')}"`,
        `"${(lead.website || '').replace(/"/g, '""')}"`,
        `"${(lead.address || '').replace(/"/g, '""')}"`,
        lead.rating || '',
        lead.reviews_count || '',
        lead.lead_score || '',
        lead.priority_tier || '',
        `"${(lead.maps_url || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const safeTitle = (job.command || 'google_maps_leads').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leadhook_maps_${safeTitle}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
