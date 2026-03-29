import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use getServerSession for server-side session access
    const session = await getServerSession(req, res, authOptions);

    if (!session?.accessToken) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'No access token in session'
      });
    }

    // Send GitHub credentials to Flask to establish session
    const flaskUrl = process.env.NEXT_PUBLIC_FLASK_URL || 'http://127.0.0.1:5000';
    
    const flaskRes = await fetch(`${flaskUrl}/auth/sync`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        github_token: session.accessToken,
        user: session.user,
      }),
    });

    if (!flaskRes.ok) {
      const errorText = await flaskRes.text();
      console.error('Flask sync failed:', flaskRes.status, errorText);
      return res.status(flaskRes.status).json({ 
        error: 'Flask sync failed',
        details: errorText 
      });
    }

    const data = await flaskRes.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Flask sync error:', error);
    return res.status(500).json({ 
      error: 'Failed to sync with Flask backend',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
