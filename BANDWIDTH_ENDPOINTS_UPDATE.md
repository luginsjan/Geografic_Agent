# Bandwidth Endpoints Update

## Overview
This document describes the changes made to ensure that bandwidth data is sent to all API endpoints in the Geografic Agent application.

## Changes Made

### 1. Frontend Script Updates (`js/script.js`)

#### Coordinates Request
- **Location**: Line ~1565
- **Change**: Added bandwidth data to the coordinates request
- **Before**: `const requestData = { clientAddress: clientAddress };`
- **After**: 
```javascript
const requestData = { 
    clientAddress: clientAddress,
    bandwidth: storedBandwidth // Include the stored bandwidth value
};
```
- **Added**: Console logging to track bandwidth data being sent

#### SOP Selection Request
- **Location**: Line ~565
- **Change**: Enhanced logging for bandwidth data
- **Added**: Console logging to track bandwidth data being sent to SOP selection endpoint

#### KIT Selection Request
- **Location**: Line ~1170
- **Change**: Added bandwidth data to the KIT selection request
- **Before**: 
```javascript
const requestData = {
    selectedKit: window.selectedKitData,
    AigentID: currentAigentID
};
```
- **After**:
```javascript
const requestData = {
    selectedKit: window.selectedKitData,
    AigentID: currentAigentID,
    bandwidth: storedBandwidth // Include the stored bandwidth value
};
```
- **Added**: Console logging to track bandwidth data being sent

### 2. API Endpoint Updates

#### get-coordinates.js
- **Change**: Enhanced request body handling to include bandwidth
- **Added**: 
  - Bandwidth forwarding to n8n webhook
  - Console logging for request body and bandwidth data
- **Updated**:
```javascript
const requestBodyWithID = {
  ...req.body,
  AigentID: aigentID,
  bandwidth: req.body.bandwidth || null // Ensure bandwidth is forwarded
};
```

#### get-SOP-selection.js
- **Change**: Enhanced request body handling to include bandwidth
- **Added**: 
  - Bandwidth forwarding to n8n webhook
  - Console logging for request body and bandwidth data
- **Updated**:
```javascript
const requestBodyWithID = {
  ...req.body,
  AigentID: aigentID,
  bandwidth: req.body.bandwidth || null // Ensure bandwidth is forwarded
};
```

#### get-KIT-selection.js
- **Change**: Enhanced request body handling to include bandwidth
- **Added**: 
  - Bandwidth forwarding to n8n webhook
  - Console logging for request body and bandwidth data
- **Updated**:
```javascript
const requestBodyWithID = {
  ...req.body,
  AigentID: aigentID,
  bandwidth: req.body.bandwidth || null // Ensure bandwidth is forwarded
};
```

### 3. Testing

#### New Test File: `test-bandwidth-endpoints.html`
- **Purpose**: Verify that all endpoints are receiving bandwidth data correctly
- **Features**:
  - Test get-coordinates endpoint with bandwidth
  - Test get-SOP-selection endpoint with bandwidth
  - Test get-KIT-selection endpoint with bandwidth
  - Real-time response display
  - Error handling and status reporting

## Data Flow

### Before Changes
1. **Coordinates Request**: Only sent `clientAddress`
2. **SOP Selection Request**: Sent `selectedResultId`, `completeSopData`, `bandwidth`, `AigentID`
3. **KIT Selection Request**: Sent `selectedKit`, `AigentID`

### After Changes
1. **Coordinates Request**: Sends `clientAddress`, `bandwidth`
2. **SOP Selection Request**: Sends `selectedResultId`, `completeSopData`, `bandwidth`, `AigentID`
3. **KIT Selection Request**: Sends `selectedKit`, `AigentID`, `bandwidth`

## Verification

### Console Logging
All endpoints now include console logging to track:
- Request body received
- Bandwidth data specifically
- AigentID handling

### Test File Usage
1. Open `test-bandwidth-endpoints.html` in a browser
2. Fill in the test data for each endpoint
3. Click the test buttons
4. Verify that bandwidth data is being sent and received correctly

## Endpoints Updated

1. **Frontend**: `js/script.js`
2. **API**: `api/get-coordinates.js`
3. **API**: `api/get-SOP-selection.js`
4. **API**: `api/get-KIT-selection.js`
5. **Test**: `test-bandwidth-endpoints.html`

## Notes

- All bandwidth data is stored in the `storedBandwidth` variable
- Bandwidth data is validated before being sent (non-empty check)
- All endpoints maintain backward compatibility
- Console logging helps with debugging and verification
- Test file provides easy way to verify functionality

## Deployment

After deploying these changes:
1. The coordinates endpoint will now receive bandwidth data
2. The SOP selection endpoint continues to receive bandwidth data
3. The KIT selection endpoint now also receives bandwidth data
4. All endpoints forward bandwidth data to their respective n8n webhooks 