import { Router, Request, Response } from 'express';
import { db } from '../db';

export const aiServicesRouter = Router();

// List all AI services
aiServicesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const services = await db('ai_services').select('*').orderBy('name');
    // Mask API keys in response
    const masked = services.map((s) => ({
      ...s,
      api_key: s.api_key ? '***' + s.api_key.slice(-4) : '',
    }));
    res.json(masked);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create or update an AI service
aiServicesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, api_url, api_key, model } = req.body;

    if (!name || !api_url || !api_key) {
      res.status(400).json({ error: 'name, api_url, and api_key are required' });
      return;
    }

    const existing = await db('ai_services').where('id', id).first();
    if (existing) {
      await db('ai_services').where('id', id).update({
        name,
        api_url,
        api_key,
        model: model || '',
        updated_at: db.fn.now(),
      });
    } else {
      await db('ai_services').insert({
        id,
        name,
        api_url,
        api_key,
        model: model || '',
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete an AI service
aiServicesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db('ai_services').where('id', id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get/set the default AI prompt template
aiServicesRouter.get('/prompt', async (_req: Request, res: Response) => {
  try {
    const row = await db('app_settings').where('key', 'ai_default_prompt').first();
    res.json({ prompt: row?.value || '' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

aiServicesRouter.put('/prompt', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt must be a string' });
      return;
    }

    const existing = await db('app_settings').where('key', 'ai_default_prompt').first();
    if (existing) {
      await db('app_settings').where('key', 'ai_default_prompt').update({
        value: prompt,
        updated_at: db.fn.now(),
      });
    } else {
      await db('app_settings').insert({
        key: 'ai_default_prompt',
        value: prompt,
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Generate text using a selected AI service
aiServicesRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const { service_id, prompt } = req.body;

    if (!service_id || !prompt) {
      res.status(400).json({ error: 'service_id and prompt are required' });
      return;
    }

    const service = await db('ai_services').where('id', service_id).first();
    if (!service) {
      res.status(404).json({ error: 'AI service not found' });
      return;
    }

    // Call the AI service using OpenAI-compatible chat completions API
    const body: Record<string, unknown> = {
      messages: [{ role: 'user', content: prompt }],
    };
    if (service.model) {
      body.model = service.model;
    }

    const response = await fetch(service.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${service.api_key}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      res.status(502).json({ error: `AI service returned ${response.status}: ${errBody}` });
      return;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = data.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
