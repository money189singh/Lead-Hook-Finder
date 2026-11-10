import { Router } from 'express';
import { globalAlgoSearchEngine } from './algoSearchEngine';

export const algoSearchRouter = Router();

// Start a new Algo Search job (replicates Apollo & Lusha)
algoSearchRouter.post('/search', async (req, res) => {
  try {
    const { companyName, domain, targetRole, personName, targetCount } = req.body;
    if (!companyName && !domain) {
      return res.status(400).json({ error: 'Please provide either a company name or domain.' });
    }

    const job = await globalAlgoSearchEngine.createAndStartJob({
      companyName,
      domain,
      targetRole,
      personName,
      targetCount: targetCount ? Number(targetCount) : 10,
    });

    res.json({ success: true, job });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to start Algo Search job.' });
  }
});

// Get all Algo Search jobs
algoSearchRouter.get(['/jobs', '/'], (req, res) => {
  try {
    const jobs = globalAlgoSearchEngine.getAllJobs();
    res.json({ success: true, jobs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single job details & live progress
algoSearchRouter.get(['/job/:id', '/jobs/:id'], (req, res) => {
  try {
    const job = globalAlgoSearchEngine.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Algo Search job not found.' });
    }
    res.json({ success: true, job });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stop a running job
algoSearchRouter.post(['/stop/:id', '/job/:id/stop'], (req, res) => {
  try {
    const stopped = globalAlgoSearchEngine.stopJob(req.params.id);
    res.json({ success: stopped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a job
algoSearchRouter.delete(['/job/:id', '/jobs/:id'], (req, res) => {
  try {
    const ok = globalAlgoSearchEngine.deleteJob(req.params.id);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Generate permutation matrix for a given name and domain without a full job
algoSearchRouter.post('/permutations', (req, res) => {
  try {
    const { firstName, lastName, domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required.' });
    }
    const permutations = globalAlgoSearchEngine.generatePermutations(firstName || '', lastName || '', domain);
    res.json({ success: true, permutations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
