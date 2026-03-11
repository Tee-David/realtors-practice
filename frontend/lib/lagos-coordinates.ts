/**
 * Pre-built Nigerian area coordinate lookup table.
 * Avoids API costs — instant geocoding for common Nigerian areas.
 * Format: [longitude, latitude]
 */

export const NIGERIAN_AREAS: Record<string, [number, number]> = {
  // === LAGOS ===
  "lekki": [3.4746, 6.4394],
  "lekki phase 1": [3.4746, 6.4394],
  "lekki phase 2": [3.5337, 6.4365],
  "victoria island": [3.4226, 6.4281],
  "vi": [3.4226, 6.4281],
  "ikoyi": [3.4346, 6.4540],
  "ikeja": [3.3515, 6.5953],
  "ikeja gra": [3.3485, 6.5873],
  "ajah": [3.5852, 6.4676],
  "yaba": [3.3873, 6.5159],
  "surulere": [3.3570, 6.4947],
  "maryland": [3.3628, 6.5675],
  "magodo": [3.3900, 6.6150],
  "omole": [3.3680, 6.6316],
  "ogba": [3.3413, 6.6257],
  "agege": [3.3263, 6.6210],
  "oshodi": [3.3430, 6.5569],
  "festac": [3.2830, 6.4660],
  "apapa": [3.3614, 6.4478],
  "iganmu": [3.3660, 6.4620],
  "mile 2": [3.3128, 6.4585],
  "satellite town": [3.2629, 6.4700],
  "badagry": [2.8850, 6.4176],
  "epe": [3.9780, 6.5853],
  "ikorodu": [3.5074, 6.6207],
  "gbagada": [3.3933, 6.5533],
  "anthony": [3.3685, 6.5580],
  "ogudu": [3.3917, 6.5717],
  "berger": [3.3583, 6.6283],
  "ojodu": [3.3625, 6.6533],
  "sangotedo": [3.5478, 6.4623],
  "agungi": [3.5158, 6.4431],
  "chevron": [3.5200, 6.4350],
  "osapa london": [3.5100, 6.4433],
  "oral estate": [3.5050, 6.4417],
  "idado": [3.5280, 6.4397],
  "ologolo": [3.5020, 6.4478],
  "lafiaji": [3.5300, 6.4300],
  "banana island": [3.4200, 6.4450],
  "ibeju lekki": [3.6200, 6.4400],
  "mowe": [3.4000, 6.8050],
  "ibafo": [3.3800, 6.7700],
  "isheri": [3.3100, 6.6200],
  "ojo": [3.1927, 6.4641],
  "alimosho": [3.2600, 6.5900],
  "amuwo odofin": [3.3100, 6.4550],
  "mushin": [3.3573, 6.5310],
  "isolo": [3.3280, 6.5270],
  "palm groove": [3.3770, 6.5370],
  "oniru": [3.4400, 6.4310],

  // === ABUJA ===
  "abuja": [7.4951, 9.0579],
  "maitama": [7.4910, 9.0820],
  "asokoro": [7.5246, 9.0452],
  "wuse": [7.4780, 9.0725],
  "wuse 2": [7.4780, 9.0725],
  "garki": [7.4920, 9.0530],
  "gwarinpa": [7.4110, 9.1083],
  "jabi": [7.4371, 9.0713],
  "utako": [7.4430, 9.0746],
  "kubwa": [7.3280, 9.1600],
  "lugbe": [7.3740, 8.9850],
  "katampe": [7.4600, 9.0900],
  "durumi": [7.4750, 9.0220],
  "gudu": [7.4800, 9.0130],
  "life camp": [7.4060, 9.0680],
  "lokogoma": [7.4470, 8.9700],
  "kado": [7.4300, 9.0830],
  "kaura": [7.4500, 9.0050],
  "wuye": [7.4570, 9.0780],
  "idu": [7.3900, 9.0500],

  // === PORT HARCOURT ===
  "port harcourt": [7.0134, 4.8156],
  "ph": [7.0134, 4.8156],
  "gra port harcourt": [7.0000, 4.8100],
  "d-line": [6.9950, 4.8020],
  "old gra": [7.0080, 4.7970],
  "trans amadi": [7.0370, 4.7910],
  "eliozu": [7.0530, 4.8700],
  "rumuokoro": [7.0200, 4.8610],

  // === OTHER MAJOR CITIES ===
  "ibadan": [3.9314, 7.3776],
  "kano": [8.5200, 12.0022],
  "kaduna": [7.4322, 10.5222],
  "benin city": [5.6145, 6.3350],
  "benin": [5.6145, 6.3350],
  "enugu": [7.4951, 6.4431],
  "warri": [5.7589, 5.5168],
  "calabar": [8.3417, 4.9517],
  "uyo": [7.9318, 5.0380],
  "owerri": [7.0333, 5.4833],
  "abeokuta": [3.3490, 7.1608],
  "ilorin": [4.5500, 8.5000],
  "jos": [8.8917, 9.9167],
  "aba": [7.3667, 5.1167],
  "akure": [5.1949, 7.2526],
  "osogbo": [4.5500, 7.7710],
  "ile ife": [4.5600, 7.4680],
  "onitsha": [6.7853, 6.1453],
  "asaba": [6.7311, 6.1977],
  "bauchi": [9.8428, 10.3006],
  "minna": [6.5569, 9.6139],
  "sokoto": [5.2322, 13.0611],
  "maiduguri": [13.1610, 11.8311],
  "makurdi": [8.5391, 7.7337],
  "lafia": [8.5231, 8.4966],
  "yenagoa": [6.2649, 4.9239],
  "awka": [7.0742, 6.2108],
};

/**
 * Extract area name from a search query using basic NLP.
 * Returns the matched area key and its coordinates, or null if not found.
 */
export function extractAreaFromQuery(query: string): { area: string; coords: [number, number] } | null {
  const normalizedQuery = query.toLowerCase().trim();

  // Sort areas by key length (longest first) to match "lekki phase 1" before "lekki"
  const sortedAreas = Object.entries(NIGERIAN_AREAS).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [area, coords] of sortedAreas) {
    if (normalizedQuery.includes(area)) {
      return { area, coords };
    }
  }

  return null;
}

/**
 * Get zoom level based on area type.
 * Cities get a wider zoom, neighborhoods get a closer zoom.
 */
export function getZoomForArea(area: string): number {
  const cities = [
    "abuja", "ibadan", "kano", "kaduna", "benin city", "benin",
    "enugu", "warri", "calabar", "uyo", "owerri", "port harcourt", "ph",
    "abeokuta", "ilorin", "jos", "aba", "akure", "osogbo", "onitsha",
    "asaba", "bauchi", "minna", "sokoto", "maiduguri", "makurdi",
    "lafia", "yenagoa", "awka", "ile ife",
  ];

  if (cities.includes(area.toLowerCase())) {
    return 12; // City-level zoom
  }
  return 14; // Neighborhood-level zoom
}
