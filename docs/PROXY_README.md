# Vercel API Proxy Implementation

## Overview
This implementation creates Vercel API proxy endpoints to solve CORS issues when making requests from the frontend to n8n webhooks.

## Problem Solved
- **CORS Errors**: The n8n webhook at `https://aigentinc.app.n8n.cloud/webhook/get-coordinates` was returning 500 errors for OPTIONS preflight requests
- **Cross-Origin Blocking**: Browser was blocking requests from `https://geografic-agent.vercel.app` to the n8n domain

## Solution
Created Vercel API proxy endpoints that:
1. Handle CORS headers properly
2. Process OPTIONS preflight requests correctly
3. Forward POST requests to n8n webhooks
4. Return proper JSON responses with CORS headers

## Files Created/Modified

### New API Endpoints
- `api/get-coordinates.js` - Proxy for coordinates webhook
- `api/get-SOP-selection.js` - Proxy for SOP selection webhook
- `api/get-KIT-selection.js` - Proxy for KIT selection webhook
- `vercel.json` - Vercel configuration for API routing and CORS headers

### Modified Files
- `js/script.js` - Updated webhook URLs to use proxy endpoints

## API Endpoints

### `/api/get-coordinates`
- **Method**: POST
- **Purpose**: Proxy for `https://aigentinc.app.n8n.cloud/webhook/get-coordinates`
- **Request Body**: `{ "clientAddress": "25.6637847,-100.3848902" }`
- **Response**: Same as n8n webhook with CORS headers

### `/api/get-SOP-selection`
- **Method**: POST
- **Purpose**: Proxy for `https://aigentinc.app.n8n.cloud/webhook/get-SOP-selection`
- **Request Body**: `{ "selectedResultId": "SOP-00008" }`
- **Response**: Same as n8n webhook with CORS headers

### `/api/get-KIT-selection`
- **Method**: POST
- **Purpose**: Proxy for `https://aigentinc.app.n8n.cloud/webhook/get-KIT-selection`
- **Request Body**: `{ "selectedKit": {...}, "AigentID": "..." }`
- **Response**: Same as n8n webhook with CORS headers

## CORS Headers
All proxy responses include:
```
Access-Control-Allow-Origin: https://geografic-agent.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Max-Age: 86400
```

## Testing
Use `test-proxy.html` to test the proxy endpoints locally before deployment.

## Deployment
1. Deploy to Vercel
2. The API endpoints will be available at:
   - `https://geografic-agent.vercel.app/api/get-coordinates`
   - `https://geografic-agent.vercel.app/api/get-SOP-selection`
   - `https://geografic-agent.vercel.app/api/get-KIT-selection`

## Error Handling
- OPTIONS requests return 200 with CORS headers
- Invalid methods return 405 with error message
- Proxy failures return 500 with error details
- Network errors are caught and returned as JSON

## Security
- Only POST requests are allowed
- CORS origin is restricted to the specific Vercel domain
- Request validation ensures proper endpoint usage 