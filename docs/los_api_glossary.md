# Line of Sight API Response Glossary

## 📋 Overview
This document describes the complete structure of the Line of Sight (LoS) analysis response from the n8n workflow, including all possible values and their meanings.

---

## 🎯 Response Structure

```typescript
interface LoSResponse {
  // Original input data (preserved)
  row_number: number;
  SOP: string;
  Plaza: string;
  Coordenadas: string;
  Terreno: number;
  "Altura (mts)": number;
  distance_km: number;
  user_coordinates: string;
  status: string;
  results: ElevationPoint[];
  
  // New LoS analysis data
  lineOfSight: LineOfSightAnalysis;
}
```

---

## 🔍 LineOfSightAnalysis Object

### Top-Level Properties

```typescript
interface LineOfSightAnalysis {
  hasLineOfSight: boolean;           // true = clear, false = blocked
  firstPoint: PointDetails;          // USER coordinate details
  lastPoint: PointDetails;           // SOP coordinate details
  totalDistance: number;             // Distance in meters
  totalDistanceKm: number;           // Distance in kilometers
  elevationChange: number;           // Elevation difference in meters
  obstructions: Obstruction[];       // Array of blocking points
  obstructionCount: number;          // Total number of obstructions
  maxObstruction: number;            // Worst obstruction height in meters
  buildingsAnalyzed: number;         // Number of OSM buildings checked
  obstructionBreakdown: ObstructionBreakdown;
  minimumHeights: MinimumHeights;
  analysis: Analysis;
  context: Context;
  summary: Summary;
  visualizationData?: VisualizationData; // Only present if blocked
}
```

---

## 🏗️ Obstruction Types

### **obstructionType Field**

Only **TWO** possible values:

| Value | Description | Meaning |
|-------|-------------|---------|
| `"terrain"` | Natural ground elevation | The terrain/ground itself blocks the line of sight |
| `"building"` | Man-made structure from OSM | A building/structure blocks the line of sight |

### Example Obstruction Object

```typescript
interface Obstruction {
  index: number;                     // Point index in elevation profile
  location: {
    lat: number;
    lng: number;
  };
  terrainElevation: number;          // Ground elevation (meters above sea level)
  buildingHeight: number;            // Height of building at this point (0 if no building)
  totalObstructionHeight: number;    // terrainElevation + buildingHeight
  sightLineElevation: number;        // Required height for clear LoS
  earthBulgeClearance: number;       // Earth curvature adjustment in meters
  obstruction: number;               // How much it blocks (meters)
  obstructionType: "terrain" | "building";  // ⚠️ ONLY TWO VALUES
  blockingBuilding: BuildingDetails | null;  // null if obstructionType === "terrain"
  distanceFromStart: number;         // Meters from USER
  distanceFromEnd: number;           // Meters from SOP
  percentageOfPath: number;          // 0-100%
}
```

### Example Building Details (when obstructionType === "building")

```typescript
interface BuildingDetails {
  id: number;                        // OSM way ID
  height: number;                    // Building height in meters
  tags: {
    building?: string;               // "residential", "commercial", "yes", etc.
    "building:levels"?: string;      // Number of floors
    height?: string;                 // Original height tag from OSM
    name?: string;                   // Building name (if available)
    [key: string]: any;              // Other OSM tags
  };
}
```

---

## 📊 Obstruction Breakdown

```typescript
interface ObstructionBreakdown {
  terrain: number;    // Count of terrain obstructions
  building: number;   // Count of building obstructions
}
```

**Example:**
```json
{
  "terrain": 2,
  "building": 5
}
```
Means: 2 points blocked by terrain, 5 points blocked by buildings

---

## 📏 Minimum Heights

```typescript
interface MinimumHeights {
  startAntennaHeight: number;       // Min antenna needed at USER (always >= 0)
  endAntennaHeight: number;         // Min antenna needed at SOP (always >= 0)
  startTotalHeight: number;         // startAntennaHeight + startTerreno
  endTotalHeight: number;           // endAntennaHeight + endTerreno
  calculation: {
    method: string;                 // "Earth curvature compensated line-of-sight with k-factor"
    kFactor: number;                // 1.3333... (4/3)
    effectiveEarthRadius: number;   // 8494666.67 meters
    tolerance: number;              // 0.1 meters
    note: string;
  };
  details: {
    startPoint: HeightDetail[];     // Array of calculations for USER
    endPoint: HeightDetail[];       // Array of calculations for SOP
  };
}

interface HeightDetail {
  obstructionIndex: number;
  distanceFromStart?: number;       // km (for USER calculations)
  distanceFromEnd?: number;         // km (for SOP calculations)
  obstructionHeight: number;        // meters
  requiredStartHeight?: number;     // meters (for USER)
  requiredEndHeight?: number;       // meters (for SOP)
  clearanceNeeded: number;          // meters
}
```

---

## 📍 Point Details

```typescript
interface PointDetails {
  location: {
    lat: number;
    lng: number;
  };
  googleElevation: number;          // From Google Elevation API
  terrenoHeight: number;            // USER: always 0 | SOP: from input
  antennaHeight: number;            // USER: always 0 | SOP: from input
  adjustedElevation: number;        // Total absolute height
  heightBreakdown: string;          // Human-readable explanation
}
```

**Example:**
```json
{
  "location": { "lat": 19.109244, "lng": -98.17209 },
  "googleElevation": 2200.5,
  "terrenoHeight": 0,
  "antennaHeight": 0,
  "adjustedElevation": 2200.5,
  "heightBreakdown": "2200.50m (Google) + 0m (Terreno) + 0m (Antenna) = 2200.50m"
}
```

---

## 🎯 Summary Object

```typescript
interface Summary {
  canSee: boolean;                   // Same as hasLineOfSight
  blockedBy: number;                 // Total obstructions
  blockedByTerrain: number;          // Terrain obstructions
  blockedByBuildings: number;        // Building obstructions
  worstObstruction: string;          // "5.32m" or "None"
  
  currentHeights: {
    user: HeightInfo;                // USER current setup
    sop: HeightInfo;                 // SOP current setup
  };
  
  minimumHeights: {
    user: MinHeightInfo;             // USER requirements
    sop: MinHeightInfo;              // SOP requirements
  };
  
  recommendation: string;            // Human-readable recommendation
  quickSolution: string;             // "Increase SOP antenna by 5m" or "No changes needed"
}

interface HeightInfo {
  terreno: number;
  antenna: number;
  total: number;
  display: string;                   // "15m (3m Terreno + 12m Antenna)"
}

interface MinHeightInfo {
  antenna: number;                   // Minimum antenna height needed
  total: number;                     // Total height with terreno
  increase: number;                  // How much to increase from current
  display: string;                   // Human-readable
}
```

---

## 🗺️ Context Object

```typescript
interface Context {
  sop: string;                       // SOP identifier
  plaza: string;                     // Location name
  targetCoordinates: string;         // SOP coordinates
  userCoordinates: string;           // USER coordinates
  
  // SOP (end point) heights
  sopTerreno: number;
  sopAltura: number;
  sopTotalHeight: number;
  sopGoogleElevation: number;
  sopAbsoluteHeight: number;
  
  // USER (start point) heights - always 0
  userTerreno: number;               // ⚠️ Always 0
  userAltura: number;                // ⚠️ Always 0
  userTotalHeight: number;           // ⚠️ Always 0
  userGoogleElevation: number;
  userAbsoluteHeight: number;        // Same as googleElevation
  
  providedDistanceKm: number;        // From input
  calculatedDistanceKm: number;      // Actual calculated
  pointsAnalyzed: number;            // Elevation points checked
  buildingsInArea: number;           // Buildings from OSM
  itemIndex: number;                 // Batch processing index
}
```

---

## 📈 Visualization Data (Only if blocked)

```typescript
interface VisualizationData {
  worstObstructionLocation: {
    lat: number;
    lng: number;
  };
  worstObstructionType: "terrain" | "building";  // ⚠️ ONLY TWO VALUES
  worstObstructionDetails: BuildingDetails | null;
  obstructionPercentages: Array<{
    atDistance: string;              // "1.23km"
    blockage: string;                // "5.32m"
    type: "terrain" | "building";    // ⚠️ ONLY TWO VALUES
    percentOfPath: string;           // "58.5%"
  }>;
}
```

---

## 🎨 Frontend Display Examples

### Status Badge
```typescript
if (response.lineOfSight.hasLineOfSight) {
  return <Badge color="green">✅ Clear</Badge>;
} else {
  return <Badge color="red">❌ Blocked</Badge>;
}
```

### Obstruction Type Icon
```typescript
function getObstructionIcon(type: string) {
  switch(type) {
    case "terrain":
      return "🏔️"; // Mountain emoji
    case "building":
      return "🏢"; // Building emoji
    default:
      return "⚠️";
  }
}
```

### Obstruction Summary
```typescript
const { blockedByTerrain, blockedByBuildings } = response.lineOfSight.summary;

return (
  <div>
    <div>🏔️ Terrain: {blockedByTerrain} obstructions</div>
    <div>🏢 Buildings: {blockedByBuildings} obstructions</div>
  </div>
);
```

### Height Requirements
```typescript
const { user, sop } = response.lineOfSight.summary.minimumHeights;

return (
  <div>
    <h3>Options to get clear LoS:</h3>
    <div>
      📡 USER: Install {user.increase.toFixed(1)}m antenna
      (total: {user.antenna.toFixed(1)}m)
    </div>
    <div>
      📡 SOP: Increase antenna by {sop.increase.toFixed(1)}m
      (total: {sop.antenna.toFixed(1)}m)
    </div>
    <div className="recommendation">
      💡 {response.lineOfSight.summary.quickSolution}
    </div>
  </div>
);
```

---

## ⚠️ Important Constants

### Obstruction Types
```typescript
type ObstructionType = "terrain" | "building";  // ONLY these two values
```

### Status Values
```typescript
type LoSStatus = boolean;
// true  = Clear line of sight
// false = Blocked line of sight
```

### Height Fields
```typescript
// USER (start point) - ALWAYS 0
userTerreno: 0
userAltura: 0
userTotalHeight: 0

// SOP (end point) - From input data
sopTerreno: number >= 0
sopAltura: number >= 0
sopTotalHeight: sopTerreno + sopAltura
```

---

## 🧪 Example Complete Response

```json
{
  "row_number": 164,
  "SOP": "SOP-00187",
  "Plaza": "Puebla",
  "Coordenadas": "19.1092440,-98.1920900",
  "Terreno": 3,
  "Altura (mts)": 12,
  "distance_km": 2.101,
  "user_coordinates": "19.109244, -98.17209",
  "status": "OK",
  "lineOfSight": {
    "hasLineOfSight": false,
    "obstructionCount": 7,
    "maxObstruction": 5.32,
    "buildingsAnalyzed": 45,
    "obstructionBreakdown": {
      "terrain": 2,
      "building": 5
    },
    "minimumHeights": {
      "startAntennaHeight": 8.5,
      "endAntennaHeight": 15.2,
      "startTotalHeight": 8.5,
      "endTotalHeight": 18.2
    },
    "summary": {
      "canSee": false,
      "blockedBy": 7,
      "blockedByTerrain": 2,
      "blockedByBuildings": 5,
      "worstObstruction": "5.32m",
      "currentHeights": {
        "user": {
          "terreno": 0,
          "antenna": 0,
          "total": 0,
          "display": "0m (ground level - no antenna)"
        },
        "sop": {
          "terreno": 3,
          "antenna": 12,
          "total": 15,
          "display": "15m (3m Terreno + 12m Antenna)"
        }
      },
      "minimumHeights": {
        "user": {
          "antenna": 8.5,
          "total": 8.5,
          "increase": 8.5,
          "display": "8.50m antenna needed"
        },
        "sop": {
          "antenna": 15.2,
          "total": 18.2,
          "increase": 3.2,
          "display": "15.20m antenna needed"
        }
      },
      "recommendation": "❌ Line of sight blocked. Options:\n  • Increase USER antenna to 8.50m (8.50m increase)\n  • OR increase SOP antenna to 15.20m (3.20m increase)",
      "quickSolution": "Increase SOP antenna by 4m"
    },
    "obstructions": [
      {
        "index": 45,
        "location": { "lat": 19.1098, "lng": -98.185 },
        "terrainElevation": 2205.3,
        "buildingHeight": 15.0,
        "totalObstructionHeight": 2220.3,
        "sightLineElevation": 2215.0,
        "obstruction": 5.3,
        "obstructionType": "building",
        "blockingBuilding": {
          "id": 123456789,
          "height": 15.0,
          "tags": {
            "building": "residential",
            "building:levels": "5"
          }
        },
        "distanceFromStart": 1250.5,
        "percentageOfPath": 59.5
      }
    ],
    "visualizationData": {
      "worstObstructionType": "building",
      "worstObstructionLocation": { "lat": 19.1098, "lng": -98.185 },
      "obstructionPercentages": [
        {
          "atDistance": "1.25km",
          "blockage": "5.30m",
          "type": "building",
          "percentOfPath": "59.5%"
        }
      ]
    }
  }
}
```

---

## 🚀 Quick Reference for Frontend

### Key Fields to Display

1. **Status**: `lineOfSight.hasLineOfSight` (boolean)
2. **Obstruction Count**: `lineOfSight.summary.blockedBy` (number)
3. **Obstruction Types**: `lineOfSight.summary.blockedByTerrain` + `blockedByBuildings`
4. **Quick Fix**: `lineOfSight.summary.quickSolution` (string)
5. **Current Heights**: `lineOfSight.summary.currentHeights.sop.display`
6. **Required Heights**: `lineOfSight.summary.minimumHeights.sop.display`

### Conditional Rendering

```typescript
// Show if blocked
if (!response.lineOfSight.hasLineOfSight) {
  // Show obstruction details
  // Show minimum height requirements
  // Show visualizationData
}

// Obstruction type specific rendering
response.lineOfSight.obstructions.forEach(obs => {
  if (obs.obstructionType === "building") {
    // Show building icon and details
    console.log(obs.blockingBuilding);
  } else if (obs.obstructionType === "terrain") {
    // Show terrain icon
  }
});
```

---

## 📝 TypeScript Type Definitions

Complete TypeScript definitions for copy-paste:

```typescript
type ObstructionType = "terrain" | "building";

interface LoSResponse {
  lineOfSight: {
    hasLineOfSight: boolean;
    obstructionCount: number;
    maxObstruction: number;
    buildingsAnalyzed: number;
    obstructionBreakdown: {
      terrain: number;
      building: number;
    };
    summary: {
      canSee: boolean;
      blockedBy: number;
      blockedByTerrain: number;
      blockedByBuildings: number;
      worstObstruction: string;
      quickSolution: string;
      currentHeights: {
        user: { terreno: 0; antenna: 0; total: 0; display: string };
        sop: { terreno: number; antenna: number; total: number; display: string };
      };
      minimumHeights: {
        user: { antenna: number; total: number; increase: number; display: string };
        sop: { antenna: number; total: number; increase: number; display: string };
      };
    };
    obstructions: Array<{
      obstructionType: ObstructionType;
      obstruction: number;
      blockingBuilding: { id: number; height: number; tags: Record<string, any> } | null;
    }>;
  };
}
```