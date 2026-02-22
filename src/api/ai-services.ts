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

// Get/set the default AI prompt template
// NOTE: These must be registered before the /:id routes so that
// "/prompt" matches literally instead of being captured as :id.
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

// Fetch available models from an AI service
aiServicesRouter.post('/models', async (req: Request, res: Response) => {
  try {
    let apiUrl: string;
    let apiKey: string;
    let serviceType: string;
    const { service_id } = req.body;

    if (service_id) {
      const service = await db('ai_services').where('id', service_id).first();
      if (!service) {
        res.status(404).json({ error: 'AI service not found' });
        return;
      }
      apiUrl = service.api_url;
      apiKey = service.api_key;
      serviceType = service.type || 'openai';
    } else {
      apiUrl = req.body.api_url;
      apiKey = req.body.api_key;
      serviceType = req.body.type || 'openai';
    }

    if (!apiUrl || !apiKey) {
      res.status(400).json({ error: 'api_url and api_key are required (or provide service_id)' });
      return;
    }

    let models: string[];

    if (serviceType === 'gemini') {
      // Gemini models endpoint: GET {base_url}/models?key={api_key}
      const modelsUrl = `${apiUrl.replace(/\/$/, '')}/models?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(modelsUrl);
      if (!response.ok) {
        const errBody = await response.text();
        res.status(502).json({ error: `Gemini API returned ${response.status}: ${errBody}` });
        return;
      }
      const data = await response.json() as {
        models?: Array<{ name: string; [key: string]: unknown }>;
      };
      // Gemini model names are like "models/gemini-1.5-pro" — strip the prefix
      models = (data.models || [])
        .map((m) => m.name.replace(/^models\//, ''))
        .filter((id) => id.startsWith('gemini'))
        .sort();
    } else {
      // OpenAI-compatible: derive models URL from chat completions URL
      let modelsUrl: string;
      if (apiUrl.includes('/chat/completions')) {
        modelsUrl = apiUrl.replace('/chat/completions', '/models');
      } else {
        const url = new URL(apiUrl);
        const parts = url.pathname.split('/').filter(Boolean);
        parts.pop();
        url.pathname = '/' + parts.join('/') + '/models';
        modelsUrl = url.toString();
      }
      const response = await fetch(modelsUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        const errBody = await response.text();
        res.status(502).json({ error: `AI service returned ${response.status}: ${errBody}` });
        return;
      }
      const data = await response.json() as {
        data?: Array<{ id: string; [key: string]: unknown }>;
      };
      models = (data.data || []).map((m) => m.id).sort();
    }

    res.json({ models });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create or update an AI service
aiServicesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, api_url, api_key, model, type } = req.body;

    if (!name || !api_url || !api_key) {
      res.status(400).json({ error: 'name, api_url, and api_key are required' });
      return;
    }

    const serviceType = type || 'openai';

    const existing = await db('ai_services').where('id', id).first();
    if (existing) {
      await db('ai_services').where('id', id).update({
        name,
        api_url,
        api_key,
        model: model || '',
        type: serviceType,
        updated_at: db.fn.now(),
      });
    } else {
      await db('ai_services').insert({
        id,
        name,
        api_url,
        api_key,
        model: model || '',
        type: serviceType,
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

    const serviceType = service.type || 'openai';
    let text: string;

    if (serviceType === 'gemini') {
      if (!service.model) {
        res.status(400).json({ error: 'A model must be set for Gemini services' });
        return;
      }
      const generateUrl = `${service.api_url.replace(/\/$/, '')}/models/${service.model}:generateContent?key=${encodeURIComponent(service.api_key)}`;
      const response = await fetch(generateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        res.status(502).json({ error: `Gemini API returned ${response.status}: ${errBody}` });
        return;
      }

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // OpenAI-compatible chat completions
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
      text = data.choices?.[0]?.message?.content || '';
    }

    res.json({ text });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
