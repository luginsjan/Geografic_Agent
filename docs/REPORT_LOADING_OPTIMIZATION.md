# Report Loading Optimization

## Problem
The final report (`.final-report-block`) was being delayed by API calls to `/api/report-log` and `/api/equipment`. Users had to wait up to several seconds before seeing their completed report, even though the core data was already available.

### Root Cause
In `js/script.js`, the `handleKitConfirmation()` function was using `await prepareReportData()`, which blocked the UI from displaying the report until these API calls completed or failed:

```javascript
await prepareReportData();  // Blocking!
// ...
showFinalReport();  // Only called after API calls finished
```

## Solution
The workflow has been optimized to show the report immediately while loading additional data in the background.

### Changes Made

#### 1. Non-Blocking Report Display (lines 2720-2742)
- Removed `await` before `prepareReportData()`
- Show final report immediately after kit confirmation
- Load additional data in background using `.then()` instead of blocking
- Re-populate report when background data arrives

**Before:**
```javascript
await prepareReportData();  // Blocking!
showFinalReport();
```

**After:**
```javascript
showFinalReport();  // Immediate display
prepareReportData().then(() => {
    populateFinalReport();  // Update when data arrives
}).catch((err) => {
    console.warn('Error:', err);
});
```

#### 2. Added Timeout Handling to API Calls

**`fetchReportLogEntry()` (lines 911-969)**
- Added 5-second timeout per attempt
- Uses `AbortController` for proper cleanup
- Handles timeout errors gracefully

**`fetchEquipmentKitDetails()` (lines 971-1012)**  
- Added 5-second timeout
- Uses `AbortController` for proper cleanup
- Handles timeout errors gracefully

#### 3. Optimized Retry Strategy (line 2604)
Reduced retries from 3 to 1 and delay from 1200ms to 500ms since the data load is now non-blocking:
- Before: `{ retries: 3, delayMs: 1200 }` (up to 3.6s wait)
- After: `{ retries: 1, delayMs: 500 }` (up to 500ms wait)

## Benefits

1. **Faster User Experience**: Report shows immediately (< 100ms)
2. **No Blocking**: UI is responsive even if API calls are slow
3. **Graceful Degradation**: Report displays with available data, then updates when additional data arrives
4. **Better Error Handling**: Timeout prevents infinite waiting
5. **Robust**: Works even if API endpoints are down or slow

## Technical Details

### Timeout Mechanism
Both API fetch functions now use `AbortController`:
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const response = await fetch(url, { signal: controller.signal });
```

### Background Data Loading
The `prepareReportData()` function is called without blocking:
- Fetches log data from `/api/report-log`
- Fetches equipment details from `/api/equipment`
- Updates metrics and scores when data arrives
- Catches and logs errors without affecting the UI

### Data Flow
1. User confirms kit selection
2. Kit selection POST succeeds
3. Report displays immediately with available data
4. Background API calls fetch additional details
5. Report updates when additional data arrives
6. If API calls fail/timeout, report remains visible with current data

## Testing

To verify the fix works:
1. Check DevTools Network tab
2. Confirm `/api/report-log` and `/api/equipment` requests are made in background
3. Verify `.final-report-block` appears immediately
4. Verify report content updates when background data arrives

## Files Modified
- `js/script.js` - Lines 911-1012, 2604, 2720-2742

