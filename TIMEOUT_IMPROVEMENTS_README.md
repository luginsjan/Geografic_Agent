# Timeout Improvements for Geografic Agent

This document describes the improvements made to handle timeout issues with the SOP selection API in the Geografic Agent application.

## Problem Description

The application was experiencing issues where:
- SOP selection requests could take 40+ seconds to complete
- The website would show "Error sending selection: Server responded with error: 500"
- The agent would still return successful responses after long delays
- Users had no indication of progress during long requests
- No timeout handling existed in the frontend

## Root Cause Analysis

The issue was caused by a mismatch between timeout configurations:

1. **Vercel Serverless Functions**: 30-second `maxDuration` limit
2. **API Proxy Timeout**: 25-second AbortController timeout
3. **Frontend Fetch Requests**: No timeout configuration (infinite wait)

When the n8n webhook took longer than 25 seconds:
- The API proxy would timeout and return a 504 error
- The frontend would continue waiting indefinitely
- Users would see error messages but the system would appear unresponsive

## Solution Implementation

### 1. Increased API Proxy Timeouts

**Files Modified:**
- `api/get-SOP-selection.js`
- `api/get-coordinates.js`
- `api/get-KIT-selection.js`

**Changes:**
- Increased timeout from 25 seconds to 28 seconds
- This provides more time for n8n webhook responses while staying under the Vercel 30-second limit

```javascript
// Before
const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

// After
const timeoutId = setTimeout(() => controller.abort(), 28000); // 28 second timeout
```

### 2. Added Frontend Timeout Handling

**File Modified:** `js/script.js`

**New Function:**
```javascript
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Start progress indicator for long requests
    let progressInterval;
    if (timeoutMs > 10000) { // Only show progress for requests longer than 10 seconds
        let elapsed = 0;
        progressInterval = setInterval(() => {
            elapsed += 2;
            const progress = Math.min((elapsed / (timeoutMs / 1000)) * 100, 95);
            showStatusMessage(`Procesando... (${Math.round(progress)}%)`, 'info', 'recommendations');
        }, 2000); // Update every 2 seconds
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
        }
        throw error;
    }
}
```

**Updated Fetch Calls:**
- All SOP selection requests now use `fetchWithTimeout` with 30-second timeout
- Kit selection requests use `fetchWithTimeout` with 30-second timeout
- Coordinate requests use `fetchWithTimeout` with 30-second timeout

### 3. Enhanced Error Handling

**Improved Error Messages:**
- Timeout errors now show user-friendly messages in Spanish
- 500 errors are handled with appropriate messaging
- 504 errors (gateway timeout) are clearly identified

```javascript
// Check if this is a timeout error and provide more helpful message
let displayMessage = errorMessage;
if (errorMessage.includes('timed out') || errorMessage.includes('timeout') || errorMessage.includes('504')) {
    displayMessage = 'La solicitud tardó demasiado tiempo en completarse. El servidor puede estar ocupado. Por favor, inténtelo de nuevo.';
} else if (errorMessage.includes('500')) {
    displayMessage = 'Error interno del servidor. El sistema puede estar experimentando problemas temporales. Por favor, inténtelo de nuevo.';
}
```

### 4. Progress Indicators

**Features:**
- Progress updates every 2 seconds for requests longer than 10 seconds
- Progress percentage shown to users
- Capped at 95% to indicate the system is still working
- Automatically cleared when request completes or fails

## Configuration Summary

| Component | Timeout | Purpose |
|-----------|---------|---------|
| Vercel Function | 30 seconds | Serverless function limit |
| API Proxy | 28 seconds | Proxy timeout (2s buffer) |
| Frontend | 30 seconds | Client-side timeout |
| Progress Updates | Every 2s | User feedback |

## Testing

A test file `test-timeout-handling.html` has been created to verify:
- Timeout handling works correctly
- Progress indicators function properly
- Error messages are displayed appropriately
- Short timeout tests work as expected

## Benefits

1. **Better User Experience**: Users now see progress during long requests
2. **Proper Error Handling**: Clear, user-friendly error messages
3. **No More Hanging**: Requests will timeout gracefully instead of hanging indefinitely
4. **Consistent Timeouts**: All components have aligned timeout configurations
5. **Retry Functionality**: Users can retry failed requests easily

## Monitoring

To monitor timeout issues:
1. Check browser console for timeout error messages
2. Monitor Vercel function logs for 504 errors
3. Track user retry attempts in the application
4. Monitor n8n webhook response times

## Future Improvements

1. **Adaptive Timeouts**: Adjust timeout based on request complexity
2. **Retry Logic**: Automatic retry with exponential backoff
3. **Queue Management**: Implement request queuing for high-load scenarios
4. **Performance Monitoring**: Track and alert on slow responses

## Files Modified

- `api/get-SOP-selection.js` - Increased timeout to 28 seconds
- `api/get-coordinates.js` - Increased timeout to 28 seconds  
- `api/get-KIT-selection.js` - Increased timeout to 28 seconds
- `js/script.js` - Added timeout handling and progress indicators
- `test-timeout-handling.html` - New test file for timeout functionality

## Deployment Notes

These changes are backward compatible and can be deployed immediately. The timeout improvements will:
- Prevent hanging requests
- Provide better user feedback
- Handle long-running n8n webhook responses more gracefully
- Maintain the existing retry functionality 