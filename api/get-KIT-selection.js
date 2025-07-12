// Next.js API route: /api/get-KIT-selection.js
// Vercel API Proxy for n8n get-KIT-selection webhook
// Handles CORS and forwards requests to n8n webhook

import { extractAigentID, isValidAigentID, generateAigentID } from './utils.js';

const N8N_WEBHOOK_URL = 'https://aigentinc.app.n8n.cloud/webhook/get-KIT-selection';

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
    // Extract or generate AigentID
    let aigentID = extractAigentID(req);
    
    // If no valid AigentID found, generate a new one (fallback)
    if (!aigentID || !isValidAigentID(aigentID)) {
      aigentID = generateAigentID();
      console.log('Generated new AigentID for KIT selection:', aigentID);
    } else {
      console.log('Using existing AigentID for KIT selection:', aigentID);
    }
    
    // Ensure AigentID is in the request body
    const requestBodyWithID = {
      ...req.body,
      AigentID: aigentID
    };
    
    // Get the request body with AigentID
    const body = JSON.stringify(requestBodyWithID);
    
    // Prepare headers for the n8n request
    const n8nHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Geografic-Agent-Proxy/1.0',
      'X-Aigent-ID': aigentID
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
      res.setHeader('X-Aigent-ID', aigentID);
      return res.status(n8nResponse.status).send(responseData);
    }
    
    // Add AigentID to the response
    const responseWithID = {
      ...parsedData,
      AigentID: aigentID
    };
    
    // Set AigentID in response headers as well
    res.setHeader('X-Aigent-ID', aigentID);
    
    // Return the response with AigentID
    return res.status(n8nResponse.status).json(responseWithID);
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Gateway timeout',
        message: 'Request to n8n webhook timed out',
        timestamp: new Date().toISOString(),
        AigentID: aigentID || 'UNKNOWN'
      });
    }
    
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      AigentID: aigentID || 'UNKNOWN'
    });
  }
} 