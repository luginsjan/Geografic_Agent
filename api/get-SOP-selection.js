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

// Handle OPTIONS preflight requests
function handleOptions(request) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}

// Forward request to n8n webhook
async function forwardToN8n(request) {
  try {
    // Get the request body
    const body = await request.text();
    
    // Prepare headers for the n8n request
    const n8nHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Geografic-Agent-Proxy/1.0'
    };
    
    // Forward the request to n8n
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: n8nHeaders,
      body: body
    });
    
    // Get the response data
    const responseData = await n8nResponse.text();
    
    // Try to parse as JSON, fallback to text if it fails
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch (e) {
      // If it's not JSON, return as text
      return new Response(responseData, {
        status: n8nResponse.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain'
        }
      });
    }
    
    // Return the response with CORS headers
    return new Response(JSON.stringify(parsedData), {
      status: n8nResponse.status,
      headers: corsHeaders
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    return new Response(JSON.stringify({
      error: 'Proxy request failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Main request handler
export default async function handler(request, context) {
  // Handle OPTIONS preflight requests
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }
  
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    }), {
      status: 405,
      headers: corsHeaders
    });
  }
  
  // Forward the request to n8n
  return await forwardToN8n(request);
} 