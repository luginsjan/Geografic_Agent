// Next.js API route: /api/get-SOP-selection.js
// Vercel API Proxy for n8n get-SOP-selection webhook
// Handles CORS and forwards requests to n8n webhook

const { extractAigentID, isValidAigentID, generateAigentID } = require('./utils.js');

const N8N_WEBHOOK_URL = 'https://aigentinc.app.n8n.cloud/webhook/get-SOP-selection';

// CORS headers configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://geografic-agent.vercel.app',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

module.exports = async function handler(req, res) {
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
    // Ensure request body is properly parsed
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch (parseError) {
        console.error('Error parsing request body:', parseError);
        return res.status(400).json({
          error: 'Invalid JSON in request body',
          message: parseError.message
        });
      }
    }

    // Extract or generate AigentID
    let aigentID = extractAigentID(req);
    
    // If no valid AigentID found, generate a new one (fallback)
    if (!aigentID || !isValidAigentID(aigentID)) {
      aigentID = generateAigentID();
      console.log('Generated new AigentID for SOP selection:', aigentID);
    } else {
      console.log('Using existing AigentID for SOP selection:', aigentID);
    }
    
    console.log('SOP Selection Request body received:', req.body);
    console.log('SOP Selection Bandwidth data:', req.body.bandwidth);
    
    // Ensure AigentID is in the request body and bandwidth is included
    const requestBodyWithID = {
      ...req.body,
      AigentID: aigentID,
      bandwidth: req.body.bandwidth || null // Ensure bandwidth is forwarded
    };
    
    // Get the request body with AigentID
    const body = JSON.stringify(requestBodyWithID);
    
    // Prepare headers for the n8n request
    const n8nHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Geografic-Agent-Proxy/1.0',
      'X-Aigent-ID': aigentID
    };
    
    // Add robust timeout to prevent hanging - using longer timeout to override Vercel's internal limits
    const controller = new AbortController();
    const startTime = new Date();
    console.log('Starting n8n request at:', startTime.toISOString());
    
    const timeoutId = setTimeout(() => {
      const elapsed = (new Date() - startTime) / 1000;
      console.log(`Manual timeout triggered after ${elapsed} seconds`);
      controller.abort();
    }, 280000); // 280 seconds (4.67 minutes) - much longer than Vercel's internal timeout
    
    // Forward the request to n8n with explicit timeout handling
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        ...n8nHeaders,
        'User-Agent': 'Vercel-Function/1.0' // Sometimes helps with proxy timeouts
      },
      body: body,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const endTime = new Date();
    const elapsed = (endTime - startTime) / 1000;
    console.log(`n8n request completed successfully after ${elapsed} seconds`);
    
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
    
    // Normalize various possible response formats into a stable shape
    // Target normalized shape consumed by frontend: { output: { ... }, AigentID }
    let normalized;
    try {
      // Case 1: New n8n format example: [ { response: { body: [ { recommendedKits, summary, ... } ], statusCode } } ]
      if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0] && parsedData[0].response) {
        const bodyArray = parsedData[0].response.body;
        if (Array.isArray(bodyArray) && bodyArray.length > 0 && bodyArray[0]) {
          const bodyObj = bodyArray[0];
          normalized = { output: bodyObj, AigentID: aigentID };
        }
      }
      // Case 2: Already normalized with output
      else if (parsedData && typeof parsedData === 'object' && parsedData.output) {
        normalized = { ...parsedData, AigentID: aigentID };
      }
      // Case 3: Legacy array with first element having output
      else if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0] && parsedData[0].output) {
        normalized = { output: parsedData[0].output, AigentID: aigentID };
      }
      // Case 4: Direct object with viable kit properties (legacy)
      else if (parsedData && (parsedData.viable_kits || parsedData.high_reliability_recommendation || parsedData.best_value_recommendation)) {
        normalized = { output: parsedData, AigentID: aigentID };
      }
      // Fallback: pass through as output payload
      else {
        normalized = { output: parsedData, AigentID: aigentID };
      }
    } catch (normErr) {
      console.error('Normalization error:', normErr);
      normalized = { output: parsedData, AigentID: aigentID };
    }
    
    // Set AigentID in response headers as well
    res.setHeader('X-Aigent-ID', aigentID);
    
    // Return the normalized response
    return res.status(n8nResponse.status).json(normalized);
    
  } catch (error) {
    console.error('Proxy error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      requestBody: req.body,
      requestHeaders: req.headers,
      timestamp: new Date().toISOString()
    });
    
    // Define aigentID variable in catch block scope
    let aigentID = null;
    try {
      aigentID = extractAigentID(req) || generateAigentID();
    } catch (idError) {
      console.error('Error handling AigentID:', idError);
      aigentID = 'UNKNOWN';
    }
    
    // Handle timeout specifically with better error detection
    if (error.name === 'AbortError') {
      const elapsed = startTime ? (new Date() - startTime) / 1000 : 'unknown';
      console.log(`Request was aborted after ${elapsed} seconds - likely due to timeout`);
      console.log('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      return res.status(504).json({
        error: 'Gateway timeout',
        message: `Request to n8n webhook timed out after ${elapsed} seconds`,
        timestamp: new Date().toISOString(),
        AigentID: aigentID,
        details: 'This may be due to Vercel\'s internal timeout limits'
      });
    }
    
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      AigentID: aigentID
    });
  }
} 