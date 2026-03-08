import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function hash(title: string, url: string, source: string) {
  return crypto.createHash("sha256").update(`${title.toLowerCase().trim()}|${url.trim()}|${source.toLowerCase().trim()}`).digest("hex");
}

const SITES = [
  { key: "propertypro", name: "PropertyPro", baseUrl: "https://www.propertypro.ng" },
  { key: "nigeriapropertycentre", name: "Nigeria Property Centre", baseUrl: "https://nigeriapropertycentre.com" },
  { key: "privateproperty", name: "Private Property", baseUrl: "https://www.privateproperty.com.ng" },
];

const SAMPLE_PROPERTIES = [
  { title: "Luxury 5 Bedroom Detached Duplex with BQ", listingType: "SALE" as const, category: "RESIDENTIAL" as const, price: 150000000, bedrooms: 5, bathrooms: 5, area: "Lekki Phase 1", state: "Lagos", propertyType: "Detached Duplex", description: "Exquisitely finished 5 bedroom detached duplex with swimming pool, BQ, and modern finishes throughout. Located in a serene estate in Lekki Phase 1.", features: ["Swimming Pool", "BQ", "Central AC", "CCTV", "Smart Home"], landSizeSqm: 600 },
  { title: "3 Bedroom Flat in Ikeja GRA", listingType: "RENT" as const, category: "RESIDENTIAL" as const, price: 3500000, bedrooms: 3, bathrooms: 3, area: "Ikeja GRA", state: "Lagos", propertyType: "Flat/Apartment", rentFrequency: "per annum", description: "Well maintained 3 bedroom flat in a quiet cul-de-sac in Ikeja GRA. All rooms en-suite with fitted kitchen.", features: ["Fitted Kitchen", "24hr Power", "Security"], landSizeSqm: 150 },
  { title: "Brand New 4 Bedroom Semi-Detached Duplex", listingType: "SALE" as const, category: "RESIDENTIAL" as const, price: 85000000, bedrooms: 4, bathrooms: 4, area: "Ajah", state: "Lagos", propertyType: "Semi-Detached Duplex", description: "Brand new 4 bedroom semi-detached duplex in a gated estate. Quality finishes, spacious rooms, and excellent road network.", features: ["Gated Estate", "Paved Roads", "BQ", "Car Park"], landSizeSqm: 350 },
  { title: "Commercial Office Space in Victoria Island", listingType: "LEASE" as const, category: "COMMERCIAL" as const, price: 15000000, area: "Victoria Island", state: "Lagos", propertyType: "Office Space", rentFrequency: "per annum", description: "Premium office space on Adeola Odeku Street, Victoria Island. Open plan layout, 24/7 power, and dedicated parking.", features: ["24/7 Power", "Elevator", "Reception", "Conference Room", "Parking"], buildingSizeSqm: 500 },
  { title: "2 Bedroom Shortlet Apartment Lekki", listingType: "SHORTLET" as const, category: "SHORTLET" as const, price: 80000, bedrooms: 2, bathrooms: 2, area: "Lekki Phase 1", state: "Lagos", propertyType: "Flat/Apartment", rentFrequency: "per night", description: "Tastefully furnished 2 bedroom shortlet apartment with Netflix, WiFi, and 24hr power. Perfect for business travelers and tourists.", features: ["WiFi", "Netflix", "Fully Furnished", "24hr Power", "Swimming Pool", "Gym"] },
  { title: "1000sqm Land in Banana Island", listingType: "SALE" as const, category: "LAND" as const, price: 600000000, area: "Banana Island", state: "Lagos", propertyType: "Residential Land", description: "Prime 1000sqm residential land in the prestigious Banana Island estate. Dry land with C of O. Perfect for luxury development.", features: ["C of O", "Dry Land", "Fenced"], landSizeSqm: 1000 },
  { title: "Serviced 3 Bedroom Flat with Pool", listingType: "SALE" as const, category: "RESIDENTIAL" as const, price: 65000000, bedrooms: 3, bathrooms: 3, area: "Ikoyi", state: "Lagos", propertyType: "Flat/Apartment", description: "Beautifully finished 3 bedroom serviced flat in Ikoyi with swimming pool, gym, and 24/7 security.", features: ["Swimming Pool", "Gym", "24hr Security", "Elevator", "Fitted Kitchen"], buildingSizeSqm: 200 },
  { title: "Warehouse for Lease in Apapa", listingType: "LEASE" as const, category: "INDUSTRIAL" as const, price: 25000000, area: "Apapa", state: "Lagos", propertyType: "Warehouse", rentFrequency: "per annum", description: "Large warehouse space in Apapa industrial zone. High ceilings, loading bays, and good access roads. Suitable for logistics and storage.", features: ["Loading Bay", "High Ceiling", "Security", "Office Space"], buildingSizeSqm: 2000 },
  { title: "Newly Built 4 Bedroom Terrace in Chevron", listingType: "SALE" as const, category: "RESIDENTIAL" as const, price: 55000000, bedrooms: 4, bathrooms: 4, area: "Chevron", state: "Lagos", propertyType: "Terrace Duplex", description: "Newly built 4 bedroom terrace duplex in Chevron area. Smart home features, all rooms en-suite, fitted kitchen with island.", features: ["Smart Home", "Fitted Kitchen", "BQ", "CCTV", "Interlocked Compound"], landSizeSqm: 250 },
  { title: "2 Bedroom Flat for Rent in Yaba", listingType: "RENT" as const, category: "RESIDENTIAL" as const, price: 1800000, bedrooms: 2, bathrooms: 2, area: "Yaba", state: "Lagos", propertyType: "Flat/Apartment", rentFrequency: "per annum", description: "Clean and spacious 2 bedroom flat in Yaba. Close to major tech hubs and universities. Good water supply and steady power.", features: ["Water Supply", "Prepaid Meter", "Pop Ceiling"] },
  { title: "500sqm Commercial Land in Lekki", listingType: "SALE" as const, category: "LAND" as const, price: 120000000, area: "Lekki", state: "Lagos", propertyType: "Commercial Land", description: "Strategic 500sqm commercial land on the Lekki-Epe Expressway. Ideal for shopping complex, hotel, or mixed-use development. Gazette and C of O available.", features: ["C of O", "Gazette", "Road Facing", "Dry Land"], landSizeSqm: 500 },
  { title: "Penthouse Suite in Eko Atlantic", listingType: "SALE" as const, category: "RESIDENTIAL" as const, price: 450000000, bedrooms: 4, bathrooms: 5, area: "Eko Atlantic", state: "Lagos", propertyType: "Penthouse", description: "Ultra-luxury penthouse in Eko Atlantic with panoramic ocean views. Italian marble finishes, private elevator, rooftop terrace, and smart home automation.", features: ["Ocean View", "Private Elevator", "Rooftop Terrace", "Smart Home", "Marble Finishes", "Wine Cellar", "Home Cinema"], buildingSizeSqm: 450 },
  { title: "Studio Apartment Shortlet Victoria Island", listingType: "SHORTLET" as const, category: "SHORTLET" as const, price: 50000, bedrooms: 1, bathrooms: 1, area: "Victoria Island", state: "Lagos", propertyType: "Studio", rentFrequency: "per night", description: "Cozy studio apartment in the heart of Victoria Island. Fully furnished with modern amenities. Walking distance to bars and restaurants.", features: ["WiFi", "Netflix", "Air Conditioning", "Fully Furnished", "24hr Power"] },
  { title: "6 Bedroom Mansion with Cinema", listingType: "SALE" as const, category: "RESIDENTIAL" as const, price: 350000000, bedrooms: 6, bathrooms: 7, area: "Ikoyi", state: "Lagos", propertyType: "Detached Duplex", description: "Magnificent 6 bedroom mansion in Old Ikoyi. Features include home cinema, wine cellar, infinity pool, and staff quarters. Sits on 1200sqm of land.", features: ["Home Cinema", "Wine Cellar", "Infinity Pool", "Staff Quarters", "Garden", "CCTV", "Central AC"], landSizeSqm: 1200 },
  { title: "3 Bedroom Bungalow in Magodo", listingType: "SALE" as const, category: "RESIDENTIAL" as const, price: 45000000, bedrooms: 3, bathrooms: 2, area: "Magodo", state: "Lagos", propertyType: "Bungalow", description: "Well-built 3 bedroom bungalow in Magodo Phase 2. Spacious compound with room for expansion. Family-friendly neighborhood with good schools nearby.", features: ["Spacious Compound", "BQ", "Car Park", "Water Borehole"] },
  { title: "Shop Space in Computer Village", listingType: "RENT" as const, category: "COMMERCIAL" as const, price: 2500000, area: "Computer Village, Ikeja", state: "Lagos", propertyType: "Shop", rentFrequency: "per annum", description: "Well-positioned shop space in Computer Village, Ikeja. High foot traffic area, perfect for electronics retail. Ground floor with good frontage.", features: ["Ground Floor", "Good Frontage", "High Traffic"], buildingSizeSqm: 30 },
  { title: "4 Bedroom Duplex with Pool in Sangotedo", listingType: "SALE" as const, category: "RESIDENTIAL" as const, price: 70000000, bedrooms: 4, bathrooms: 5, area: "Sangotedo", state: "Lagos", propertyType: "Detached Duplex", description: "Modern 4 bedroom detached duplex with private pool in a secure estate in Sangotedo. Close to Shoprite and major amenities.", features: ["Swimming Pool", "BQ", "Gated Estate", "Fitted Kitchen", "CCTV"], landSizeSqm: 400 },
  { title: "1 Bedroom Mini Flat in Surulere", listingType: "RENT" as const, category: "RESIDENTIAL" as const, price: 800000, bedrooms: 1, bathrooms: 1, area: "Surulere", state: "Lagos", propertyType: "Mini Flat", rentFrequency: "per annum", description: "Newly renovated 1 bedroom mini flat in Surulere. Tiled floors, modern fittings, and prepaid meter. Close to the National Stadium.", features: ["Prepaid Meter", "Tiled", "Water Supply"] },
  { title: "Mixed-Use Development Land Ibeju-Lekki", listingType: "SALE" as const, category: "LAND" as const, price: 35000000, area: "Ibeju-Lekki", state: "Lagos", propertyType: "Mixed-Use Land", description: "2000sqm of land in Ibeju-Lekki free trade zone area. Excellent for mixed-use development. Close to Dangote Refinery and new airport project.", features: ["Gazette", "Survey Plan", "Free Trade Zone"], landSizeSqm: 2000 },
  { title: "3 Bedroom Shortlet with Rooftop Terrace", listingType: "SHORTLET" as const, category: "SHORTLET" as const, price: 120000, bedrooms: 3, bathrooms: 3, area: "Lekki Phase 1", state: "Lagos", propertyType: "Penthouse", rentFrequency: "per night", description: "Stunning 3 bedroom shortlet penthouse with rooftop terrace and BBQ area. Perfect for events and getaways. Fully smart home enabled.", features: ["Rooftop Terrace", "BBQ Area", "Smart Home", "Netflix", "WiFi", "Pool", "Gym", "Fully Furnished"] },
];

async function main() {
  console.log("Seeding database...");

  // Create sites
  const createdSites = [];
  for (const site of SITES) {
    const created = await prisma.site.upsert({
      where: { key: site.key },
      update: {},
      create: site,
    });
    createdSites.push(created);
    console.log(`  Site: ${created.name} (${created.id})`);
  }

  // Create properties
  let count = 0;
  for (const prop of SAMPLE_PROPERTIES) {
    const siteIndex = count % createdSites.length;
    const site = createdSites[siteIndex];
    const listingUrl = `${site.baseUrl}/listing/${count + 1}`;
    const propHash = hash(prop.title, listingUrl, site.key);

    const existing = await prisma.property.findUnique({ where: { hash: propHash } });
    if (existing) {
      console.log(`  Skip (exists): ${prop.title}`);
      count++;
      continue;
    }

    // Quality score calculation
    let qs = 0;
    if (prop.title.length > 20) qs += 10;
    if (prop.description && prop.description.length > 100) qs += 15;
    if (prop.price) qs += 10;
    if (prop.bedrooms) qs += 4;
    if (prop.bathrooms) qs += 3;
    if (prop.propertyType) qs += 4;
    if (prop.area) qs += 5;
    if (prop.state) qs += 3;
    if (prop.features && prop.features.length >= 3) qs += 5;
    if (prop.landSizeSqm || prop.buildingSizeSqm) qs += 4;

    const property = await prisma.property.create({
      data: {
        hash: propHash,
        title: prop.title,
        listingUrl,
        source: site.key,
        siteId: site.id,
        listingType: prop.listingType,
        category: prop.category,
        price: prop.price,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        area: prop.area,
        state: prop.state,
        propertyType: prop.propertyType,
        description: prop.description,
        features: prop.features || [],
        landSizeSqm: prop.landSizeSqm,
        buildingSizeSqm: prop.buildingSizeSqm,
        rentFrequency: prop.rentFrequency,
        locationText: `${prop.area}, ${prop.state}`,
        qualityScore: Math.min(qs, 100),
        scrapeTimestamp: new Date(),
        daysOnMarket: Math.floor(Math.random() * 90),
      },
    });

    // Create initial price history
    if (prop.price) {
      await prisma.priceHistory.create({
        data: {
          propertyId: property.id,
          price: prop.price,
          source: "SYSTEM",
        },
      });
    }

    console.log(`  Property: ${property.title} (${property.id})`);
    count++;
  }

  console.log(`\nSeeded ${count} properties across ${createdSites.length} sites.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
