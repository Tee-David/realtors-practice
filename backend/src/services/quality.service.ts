interface PropertyData {
  title?: string | null;
  description?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area?: string | null;
  state?: string | null;
  fullAddress?: string | null;
  locationText?: string | null;
  images?: unknown;
  agentName?: string | null;
  agentPhone?: string | null;
  features?: string[];
  latitude?: number | null;
  longitude?: number | null;
  propertyType?: string | null;
  listingUrl?: string | null;
  landSize?: string | null;
  buildingSize?: string | null;
}

interface ScoreBreakdown {
  total: number;
  details: Record<string, number>;
}

export class QualityService {
  static score(data: PropertyData): ScoreBreakdown {
    const details: Record<string, number> = {};

    // Title (0-10)
    if (data.title) {
      const len = data.title.length;
      details.title = len > 20 ? 10 : len > 10 ? 7 : 4;
    } else {
      details.title = 0;
    }

    // Description (0-15)
    if (data.description) {
      const len = data.description.length;
      details.description = len > 200 ? 15 : len > 100 ? 10 : len > 30 ? 6 : 3;
    } else {
      details.description = 0;
    }

    // Price (0-10)
    details.price = data.price && data.price > 0 ? 10 : 0;

    // Property details (0-15)
    let detailScore = 0;
    if (data.bedrooms != null) detailScore += 4;
    if (data.bathrooms != null) detailScore += 3;
    if (data.propertyType) detailScore += 4;
    if (data.landSize || data.buildingSize) detailScore += 4;
    details.propertyDetails = Math.min(detailScore, 15);

    // Location (0-20)
    let locationScore = 0;
    if (data.area) locationScore += 5;
    if (data.state) locationScore += 3;
    if (data.fullAddress || data.locationText) locationScore += 5;
    if (data.latitude && data.longitude) locationScore += 7;
    details.location = Math.min(locationScore, 20);

    // Images (0-15)
    const imageArr = Array.isArray(data.images) ? data.images : [];
    if (imageArr.length >= 5) details.images = 15;
    else if (imageArr.length >= 3) details.images = 10;
    else if (imageArr.length >= 1) details.images = 5;
    else details.images = 0;

    // Agent info (0-10)
    let agentScore = 0;
    if (data.agentName) agentScore += 5;
    if (data.agentPhone) agentScore += 5;
    details.agent = Math.min(agentScore, 10);

    // Features (0-5)
    const feats = data.features || [];
    details.features = feats.length >= 3 ? 5 : feats.length >= 1 ? 3 : 0;

    const total = Object.values(details).reduce((sum, v) => sum + v, 0);

    return { total: Math.min(total, 100), details };
  }
}
