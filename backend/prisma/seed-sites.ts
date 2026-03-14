import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Site configurations ported from v2.0 config.yaml with verified selectors.
 *
 * Key architecture decisions:
 * - listingSelector (in `selectors.listingSelector`) is for listing CONTAINERS on index pages
 * - Other selector fields are for extracting data from detail pages
 * - Pipe-separated selectors provide fallback chains: "primary | fallback1 | fallback2"
 * - JSON-LD extraction runs automatically before CSS selectors (no config needed)
 */
const sites = [
  // ===== TIER 1: Major aggregators (high volume, reliable) =====
  {
    key: "nigeriapropertycentre",
    name: "Nigeria Property Centre",
    baseUrl: "https://nigeriapropertycentre.com",
    listPaths: [
      "/for-sale/flats-apartments/lagos/showtype",
      "/for-rent/flats-apartments/lagos/showtype",
      "/for-sale/houses/lagos/showtype",
      "/for-rent/houses/lagos/showtype",
      "/for-sale/land/lagos/showtype",
    ],
    selectors: {
      // Index page: listing container selector
      listingSelector: "li.property-list | .property-list | .property | article",
      // Detail page: field selectors (pipe-separated fallbacks)
      title: "h1.property-title | h4.content-title | h1",
      price: ".property-price | .price | [class*='price']",
      location: ".property-location | address | .location | [class*='location']",
      bedrooms: ".bedrooms .value | [class*='bedroom'] | span:has(i.bed)",
      bathrooms: ".bathrooms .value | [class*='bathroom'] | span:has(i.bath)",
      toilets: ".toilets .value | [class*='toilet']",
      description: ".property-description | .description | [class*='description'] | .details p",
      images: ".property-gallery img::attr(src) | .slider img::attr(src) | .images img::attr(src)",
      agent_name: ".agent-name | .advertiser-name",
      agent_phone: ".phone-number | .contact-number | a[href^='tel:']",
      features: ".property-features li | .amenities li | .features li",
      area_size: ".plot-area | .land-size | [class*='size']",
      // Pagination config
      paginationConfig: {
        next_selectors: ["a[rel='next']", "li.next a", "a[aria-label*='Next']"],
        page_param: "page",
      },
    },
    paginationType: "path_segment",
    maxPages: 30,
    requiresBrowser: false,
    enabled: true,
  },
  {
    key: "propertypro",
    name: "PropertyPro Nigeria",
    baseUrl: "https://propertypro.ng",
    listPaths: [
      "/property-for-sale/lagos",
      "/property-for-rent/lagos",
    ],
    selectors: {
      listingSelector: "div.single-room-text | article.property | li.property",
      title: "h2.listings-property-title | h1.property-title | h1 | a h2 | .single-room-text h2",
      price: "span.propery-price | h3.listings-price | .price | .listings-price",
      location: "h4.listings-location | .location | .single-room-location | address",
      bedrooms: "span[title='Bedrooms'] | .bedrooms | [class*='bedroom']",
      bathrooms: "span[title='Bathrooms'] | .bathrooms | [class*='bathroom']",
      toilets: "span[title='Toilets'] | [class*='toilet']",
      description: "div.property-description | .description | .details",
      images: ".gallery img::attr(src) | .property-images img::attr(src) | img.property-image::attr(src)",
      agent_name: ".agent-name",
      agent_phone: ".phone | a[href^='tel:']",
      features: "ul.amenities li | .features li | li.feature",
      area_size: ".plot-area | [class*='size']",
      paginationConfig: {
        next_selectors: ["a[rel='next']", "li.next a"],
        page_param: "page",
      },
    },
    paginationType: "url_param",
    maxPages: 20,
    requiresBrowser: false,
    enabled: true,
  },
  {
    key: "jiji-ng",
    name: "Jiji Nigeria",
    baseUrl: "https://jiji.ng",
    listPaths: [
      "/lagos/real-estate",
      "/lagos/real-estate/flats-and-apartments-for-rent",
      "/lagos/real-estate/houses-and-apartments-for-sale",
    ],
    selectors: {
      listingSelector: "a[href*='/real-estate/'] | div[class*='listing'] | article",
      title: "h1.b-advert-title | h3.qa-advert-title | h1",
      price: "span.qa-advert-price | .price | .price-details",
      location: "span.b-advert-info-region | .location | .address",
      bedrooms: "[class*='bedroom'] | li:has(text*='Bedroom')",
      bathrooms: "[class*='bathroom'] | li:has(text*='Bathroom')",
      description: ".b-advert-description | .description | .ad-description",
      images: ".gallery img::attr(src) | .photos img::attr(src) | img.b-advert-image::attr(src)",
      agent_name: ".seller-name",
      agent_phone: ".phone-number",
      features: "ul.params li | .attributes li",
      paginationConfig: {
        page_param: "page",
      },
    },
    paginationType: "url_param",
    maxPages: 10,
    requiresBrowser: true,
    enabled: true,
  },
  {
    key: "property24-ng",
    name: "Property24 Nigeria",
    baseUrl: "https://www.property24.com.ng",
    listPaths: [
      "/property-for-sale/lagos",
      "/property-to-rent/lagos",
    ],
    selectors: {
      listingSelector: "a.js_rollover_container | .p24_regularTile | article",
      title: "h1.p24_propertyTitle | h1 | .p24_title",
      price: "span.p24_price | .p24_price | .price",
      location: "span.p24_location | .p24_location | .location",
      bedrooms: "span.p24_featureDetails[title='Bedrooms'] | [class*='bedroom']",
      bathrooms: "span.p24_featureDetails[title='Bathrooms'] | [class*='bathroom']",
      description: "div.p24_propertyDescription | .description | .p24_description",
      images: "img.p24_mainImage::attr(src) | .gallery img::attr(src)",
      agent_name: "span.p24_agentName | .p24_agentName",
      features: "ul.p24_keyFeatures li | .features li",
      paginationConfig: {
        page_param: "Page",
      },
    },
    paginationType: "url_param",
    maxPages: 10,
    requiresBrowser: false,
    enabled: true,
  },
  {
    key: "buyletlive",
    name: "BuyLetLive",
    baseUrl: "https://buyletlive.com",
    listPaths: [
      "/properties/sale",
      "/properties/rent",
    ],
    selectors: {
      listingSelector: "a[href*='/property/'] | div[class*='property'] | .listing-card | article",
      title: "h1.property-title | h1 | .property-name",
      price: "span.price | div.property-price | .price | [class*='price']",
      location: "span.location | div.property-location | .location | [class*='location']",
      bedrooms: "span.beds | [class*='bed'] | [class*='bedroom']",
      bathrooms: "span.baths | [class*='bath'] | [class*='bathroom']",
      description: "div.property-description | .description",
      images: "img.property-image::attr(src) | .gallery img::attr(src)",
      features: "ul.amenities li | .features li",
      paginationConfig: {
        page_param: "page",
      },
    },
    paginationType: "url_param",
    maxPages: 10,
    requiresBrowser: true,
    enabled: true,
  },

  // ===== TIER 2: Additional sources (from v2.0) =====
  {
    key: "cwlagos",
    name: "CW Real Estate",
    baseUrl: "https://cwlagos.com",
    listPaths: [""],
    selectors: {
      listingSelector: "article.property-item | div[class*='property'] | article",
      title: "h2.property-title a | h1 | .property-title",
      price: ".property-price | .price | [class*='price']",
      location: ".property-location | .location | [class*='location']",
      description: ".property-description | .description",
      images: ".property-image img::attr(src) | .gallery img::attr(src)",
      features: ".property-features li | .amenities li",
    },
    paginationType: "url_param",
    maxPages: 10,
    requiresBrowser: false,
    enabled: false,
  },
  {
    key: "adronhomes",
    name: "Adron Homes",
    baseUrl: "https://adronhomesproperties.com",
    listPaths: [""],
    selectors: {
      listingSelector: "div[class*='property'] | article | .listing-card",
      title: "h1 | h2 | .title",
      price: ".price | [class*='price'] | [class*='amount']",
      location: ".location | [class*='location'] | address",
      description: ".description | [class*='description']",
      images: ".gallery img::attr(src) | img::attr(src)",
      features: ".features li | .amenities li",
    },
    paginationType: "url_param",
    maxPages: 10,
    requiresBrowser: true,
    enabled: false,
  },
  {
    key: "lamudi",
    name: "Lamudi Nigeria",
    baseUrl: "https://www.lamudi.com.ng",
    listPaths: ["/sale/lagos/", "/rent/lagos/"],
    selectors: {
      listingSelector: "div[class*='listing'] | article | .property-card",
      title: "h1 | .listing-title | h2",
      price: ".price | [class*='price']",
      location: ".location | [class*='location'] | address",
      bedrooms: "[class*='bedroom'] | span:has(text*='Bedroom')",
      bathrooms: "[class*='bathroom'] | span:has(text*='Bathroom')",
      description: ".description | .details | [class*='description']",
      images: ".gallery img::attr(src)",
      agent_name: ".agent-name",
      agent_phone: "a[href^='tel:']",
    },
    paginationType: "url_param",
    maxPages: 10,
    requiresBrowser: false,
    enabled: false,
  },
  {
    key: "privateproperty",
    name: "Private Property Nigeria",
    baseUrl: "https://www.privateproperty.com.ng",
    listPaths: ["/for-sale/lagos", "/to-rent/lagos"],
    selectors: {
      listingSelector: "div[class*='listing'] | article | .property-card",
      title: "h1 | .listing-title | h2",
      price: ".price | [class*='price']",
      location: ".location | [class*='location'] | .address",
      bedrooms: "[class*='bedroom'] | .beds",
      bathrooms: "[class*='bathroom'] | .baths",
      description: ".description | [class*='description']",
      images: ".gallery img::attr(src) | img[class*='property']::attr(src)",
    },
    paginationType: "url_param",
    maxPages: 10,
    requiresBrowser: false,
    enabled: false,
  },
];

async function main() {
  console.log("Seeding Nigerian property sites (v3.0 with verified selectors)...\n");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const site of sites) {
    const existing = await prisma.site.findFirst({
      where: { key: site.key },
    });

    if (existing) {
      // Update existing sites with new selectors (force update)
      await prisma.site.update({
        where: { id: existing.id },
        data: {
          name: site.name,
          baseUrl: site.baseUrl,
          listPaths: site.listPaths,
          selectors: site.selectors as any,
          paginationType: site.paginationType,
          maxPages: site.maxPages,
          requiresBrowser: site.requiresBrowser,
          enabled: site.enabled,
          deletedAt: null,  // Restore if soft-deleted
        },
      });
      console.log(`  ↻ Updated: ${site.name}`);
      updated++;
      continue;
    }

    await prisma.site.create({ data: site as any });
    console.log(`  + Created: ${site.name}`);
    created++;
  }

  console.log(`\nDone! ${created} created, ${updated} updated, ${skipped} skipped.`);
  console.log(`Total sites in DB: ${await prisma.site.count({ where: { deletedAt: null } })}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
