/**
 * US states + territories for address forms and Geoapify scoping.
 * Bounding boxes are approximate (SW lon/lat → NE lon/lat) for hard filters.
 */

export type UsRegion = {
  code: string;
  name: string;
  /** rect: lon1,lat1,lon2,lat2 (southwest → northeast) */
  rect: [number, number, number, number];
};

export const US_REGIONS: UsRegion[] = [
  { code: "AL", name: "Alabama", rect: [-88.47, 30.22, -84.89, 35.01] },
  { code: "AK", name: "Alaska", rect: [-179.15, 51.21, -129.98, 71.39] },
  { code: "AZ", name: "Arizona", rect: [-114.82, 31.33, -109.05, 37.0] },
  { code: "AR", name: "Arkansas", rect: [-94.62, 33.0, -89.64, 36.5] },
  { code: "CA", name: "California", rect: [-124.48, 32.53, -114.13, 42.01] },
  { code: "CO", name: "Colorado", rect: [-109.06, 36.99, -102.04, 41.0] },
  { code: "CT", name: "Connecticut", rect: [-73.73, 40.98, -71.79, 42.05] },
  { code: "DE", name: "Delaware", rect: [-75.79, 38.45, -75.05, 39.84] },
  { code: "DC", name: "District of Columbia", rect: [-77.12, 38.79, -76.91, 38.99] },
  { code: "FL", name: "Florida", rect: [-87.63, 24.52, -80.03, 31.0] },
  { code: "GA", name: "Georgia", rect: [-85.61, 30.36, -80.84, 35.0] },
  { code: "HI", name: "Hawaii", rect: [-160.25, 18.91, -154.81, 22.24] },
  { code: "ID", name: "Idaho", rect: [-117.24, 41.99, -111.04, 49.0] },
  { code: "IL", name: "Illinois", rect: [-91.51, 36.97, -87.02, 42.51] },
  { code: "IN", name: "Indiana", rect: [-88.1, 37.77, -84.78, 41.76] },
  { code: "IA", name: "Iowa", rect: [-96.64, 40.38, -90.14, 43.5] },
  { code: "KS", name: "Kansas", rect: [-102.05, 36.99, -94.59, 40.0] },
  { code: "KY", name: "Kentucky", rect: [-89.57, 36.5, -81.96, 39.15] },
  { code: "LA", name: "Louisiana", rect: [-94.04, 28.93, -88.82, 33.02] },
  { code: "ME", name: "Maine", rect: [-71.08, 43.06, -66.95, 47.46] },
  { code: "MD", name: "Maryland", rect: [-79.49, 37.89, -75.05, 39.72] },
  { code: "MA", name: "Massachusetts", rect: [-73.51, 41.24, -69.93, 42.89] },
  { code: "MI", name: "Michigan", rect: [-90.42, 41.7, -82.41, 48.3] },
  { code: "MN", name: "Minnesota", rect: [-97.24, 43.5, -89.49, 49.38] },
  { code: "MS", name: "Mississippi", rect: [-91.66, 30.17, -88.1, 35.0] },
  { code: "MO", name: "Missouri", rect: [-95.77, 35.99, -89.1, 40.61] },
  { code: "MT", name: "Montana", rect: [-116.05, 44.36, -104.04, 49.0] },
  { code: "NE", name: "Nebraska", rect: [-104.05, 40.0, -95.31, 43.0] },
  { code: "NV", name: "Nevada", rect: [-120.01, 35.0, -114.04, 42.0] },
  { code: "NH", name: "New Hampshire", rect: [-72.56, 42.7, -70.71, 45.31] },
  { code: "NJ", name: "New Jersey", rect: [-75.56, 38.93, -73.89, 41.36] },
  { code: "NM", name: "New Mexico", rect: [-109.05, 31.33, -103.0, 37.0] },
  { code: "NY", name: "New York", rect: [-79.76, 40.5, -71.86, 45.01] },
  { code: "NC", name: "North Carolina", rect: [-84.32, 33.84, -75.46, 36.59] },
  { code: "ND", name: "North Dakota", rect: [-104.05, 45.94, -96.55, 49.0] },
  { code: "OH", name: "Ohio", rect: [-84.82, 38.4, -80.52, 41.98] },
  { code: "OK", name: "Oklahoma", rect: [-103.0, 33.62, -94.43, 37.0] },
  { code: "OR", name: "Oregon", rect: [-124.57, 41.99, -116.46, 46.29] },
  { code: "PA", name: "Pennsylvania", rect: [-80.52, 39.72, -74.69, 42.27] },
  { code: "RI", name: "Rhode Island", rect: [-71.86, 41.15, -71.12, 42.02] },
  { code: "SC", name: "South Carolina", rect: [-83.35, 32.05, -78.54, 35.22] },
  { code: "SD", name: "South Dakota", rect: [-104.06, 42.48, -96.44, 45.95] },
  { code: "TN", name: "Tennessee", rect: [-90.31, 34.98, -81.65, 36.68] },
  { code: "TX", name: "Texas", rect: [-106.65, 25.84, -93.51, 36.5] },
  { code: "UT", name: "Utah", rect: [-114.05, 36.99, -109.04, 42.0] },
  { code: "VT", name: "Vermont", rect: [-73.44, 42.73, -71.47, 45.02] },
  { code: "VA", name: "Virginia", rect: [-83.68, 36.54, -75.24, 39.47] },
  { code: "WA", name: "Washington", rect: [-124.85, 45.54, -116.92, 49.0] },
  { code: "WV", name: "West Virginia", rect: [-82.64, 37.2, -77.72, 40.64] },
  { code: "WI", name: "Wisconsin", rect: [-92.89, 42.49, -86.81, 47.08] },
  { code: "WY", name: "Wyoming", rect: [-111.06, 40.99, -104.05, 45.01] },
  { code: "AS", name: "American Samoa", rect: [-171.09, -14.55, -168.14, -11.05] },
  { code: "GU", name: "Guam", rect: [144.62, 13.23, 144.96, 13.65] },
  { code: "MP", name: "Northern Mariana Islands", rect: [145.12, 14.11, 145.83, 20.55] },
  { code: "PR", name: "Puerto Rico", rect: [-67.95, 17.88, -65.22, 18.52] },
  { code: "VI", name: "U.S. Virgin Islands", rect: [-65.09, 17.67, -64.56, 18.42] },
];

export const US_REGION_OPTIONS = US_REGIONS.map((r) => ({
  value: r.code,
  label: `${r.code} — ${r.name}`,
}));

const byCode = new Map(US_REGIONS.map((r) => [r.code, r]));

export function getUsRegion(code: string): UsRegion | undefined {
  return byCode.get(code.trim().toUpperCase());
}

export function isUsRegionCode(code: string): boolean {
  return byCode.has(code.trim().toUpperCase());
}
