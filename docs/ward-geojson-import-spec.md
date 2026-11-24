# CivicFix AI — Municipal Ward GeoJSON Import Specification
## Phase 28: Spatial Boundary Data Standards & Ingestion Pipeline

### 1. Overview
CivicFix AI uses spatial geofencing (point-in-polygon raycasting) to automatically map incoming citizen complaint GPS coordinates to the correct municipal ward and administrative zone.

To ensure high-precision boundary mapping, municipal GIS departments must supply ward boundary definitions compliant with this specification.

---

### 2. GeoJSON Standard Requirements

1. **Standard:** RFC-7946 GeoJSON format.
2. **Coordinate Reference System (CRS):** WGS 84 (EPSG:4326). Coordinates must be decimal degrees in `[longitude, latitude]` order.
   - Longitude: between `-180.0` and `+180.0`
   - Latitude: between `-90.0` and `+90.0`
3. **Supported Geometry Types:**
   - `Polygon`: A single contiguous ward boundary. Outer ring followed by zero or more inner rings (exclusion zones / holes).
   - `MultiPolygon`: An administrative ward comprising non-contiguous geographic polygons (e.g., river islands, detached enclaves).
4. **Ring Winding Rules:**
   - Exterior ring coordinates must follow right-hand / counter-clockwise winding.
   - Interior rings (holes/exclusions) must follow clockwise winding.
   - The first and last coordinate in each linear ring must be identical to close the boundary.

---

### 3. Required Feature Properties
Each GeoJSON `Feature` in the `FeatureCollection` must define the following properties in its `properties` dictionary:

| Property | Type | Mandatory? | Description | Example |
| :--- | :---: | :---: | :--- | :--- |
| `name` | String | **Yes** | Official municipal ward name | `"Shivajinagar Ward 1"` |
| `code` / `wardCode` | String | **Yes** | Unique municipal ward identifier | `"WARD-01"` or `"SHIV_01"` |
| `number` | Number | **Yes** | Ward number | `1` |
| `zone` | String | Optional | Administrative zone | `"Central Zone"` |
| `population` | Number | Optional | Resident population count | `45000` |
| `areaKm2` | Number | Optional | Total area in square kilometers | `8.5` |
| `description` | String | Optional | Administrative boundaries description | `"Covers civic square and railway station"` |

---

### 4. Sample GeoJSON Template
```json
{
  "type": "FeatureCollection",
  "name": "Municipal_Wards_Boundary_Layer",
  "crs": {
    "type": "name",
    "properties": {
      "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
    }
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Shivajinagar Ward 1",
        "code": "SHIV_01",
        "number": 1,
        "zone": "Central Zone",
        "population": 48000,
        "areaKm2": 7.2
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [73.8350, 18.5200],
            [73.8650, 18.5200],
            [73.8650, 18.5450],
            [73.8350, 18.5450],
            [73.8350, 18.5200]
          ]
        ]
      }
    }
  ]
}
```

---

### 5. Ingestion CLI Tool
Municipal engineers can import GIS boundaries directly into the database:

```powershell
node backend/scripts/importWardGeoJSON.js --file "path/to/official_wards.geojson"
```

The importer validates:
- Geometry validity (rejects invalid coordinate ranges, unclosed rings).
- Boundary point intersections.
- Updates existing ward records idempotently without dropping active complaints or assigned officers.

---

### 6. Current Pilot Status Notice
> [!IMPORTANT]
> **Real-World Geographic Validation Status: BLOCKED**  
> While the point-in-polygon calculation engine (`backend/src/utils/geofencing.js`) and database schema are fully verified against multi-ring Polygon and MultiPolygon test fixtures, **official municipal survey shapefiles for Pune Municipal Corporation (PMC) wards are currently pending official administrative release from the city GIS department**. Real-world municipal coordinates must not be fabricated.
