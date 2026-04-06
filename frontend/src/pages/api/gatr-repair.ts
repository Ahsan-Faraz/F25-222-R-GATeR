import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
    // Increase timeout to 5 minutes for long-running GATR repairs
    externalResolver: true,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

    // Forward the request to Flask backend
    const response = await fetch('http://127.0.0.1:5000/gatr/repair', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      console.error('Non-JSON response from backend:', text);
      return res.status(response.status).json({ 
        error: 'Backend returned non-JSON response',
        details: text.substring(0, 500)
      });
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ 
        error: 'Request timeout - GATR repair took longer than 5 minutes' 
      });
    }
    console.error('GATR repair proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to proxy request to backend',
      details: error.message 
    });
  }
}
