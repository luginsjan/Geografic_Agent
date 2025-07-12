// Next.js API route: /api/get-SOP-selection.js
// Vercel API Proxy for n8n get-SOP-selection webhook
// Handles CORS and forwards requests to n8n webhook

const N8N_WEBHOOK_URL = 'https://aigentinc.app.n8n.cloud/webhook/get-SOP-selection';

// CORS headers configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://geografic-agent.vercel.app',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    // Get the request body (Next.js automatically parses JSON)
    const body = JSON.stringify(req.body);
    
    // Prepare headers for the n8n request
    const n8nHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Geografic-Agent-Proxy/1.0'
    };
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    // Forward the request to n8n
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: n8nHeaders,
      body: body,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Get the response data
    const responseData = await n8nResponse.text();
    
    // Try to parse as JSON, fallback to text if it fails
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch (e) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(n8nResponse.status).send(responseData);
    }
    
    // Return the response
    return res.status(n8nResponse.status).json(parsedData);
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Gateway timeout',
        message: 'Request to n8n webhook timed out',
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 