import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sites = [
  {
    key: "propertypro",
    name: "PropertyPro",
    baseUrl: "https://www.propertypro.ng",
    listPaths: ["/property-for-sale/in/lagos", "/property-for-rent/in/lagos"],
    selectors: {
      listing_link: "a.single-room-sale",
      title: "h2.listings-property-title, h1.property-title",
      price: "h3.listings-price, span.price",
      location: "h4.listings-location, address",
      bedrooms: "span[title='Bedrooms'], .beds",
      bathrooms: "span[title='Bathrooms'], .baths",
      toilets: "span[title='Toilets']",
      images: "img.property-image::attr(src), img.gallery-image::attr(src)",
      description: "div.property-description, div.description",
      agentName: "span.agent-name, a.agent-link",
      features: "li.feature, ul.amenities li",
    },
    detailSelectors: {
      title: "h1.property-title",
      price: "span.price",
      description: "div.property-description",
    },
    paginationType: "url_param",
    maxPages: 10,
    requiresBrowser: false,
    enabled: true,
  },
  {
    key: "nigeriapropertycentre",
    name: "Nigeria Property Centre",
    baseUrl: "https://nigeriapropertycentre.com",
    listPaths: [
      "/for-sale/flats-apartments/lagos/showtype",
      "/for-rent/flats-apartments/lagos/showtype",
    ],
    selectors: {
      listing_link: "div.wp-block a[href*='/properties/']",
      title: "h1.property-title, h4.content-title",
      price: "span.price, h3.price",
      location: "address, span.location",
      bedrooms: "span.beds, li:has(i.bed)",
      bathrooms: "span.baths, li:has(i.bath)",
      images: "img.property-img::attr(src), div.gallery img::attr(data-src)",
      description: "div.description-text",
      agentName: "span.marketed-by, a.agent-name",
      features: "ul.features li, div.amenities span",
    },
    paginationType: "path_segment",
    maxPages: 10,
    requiresBrowser: false,
    enabled: true,
  },
  {
    key: "jiji-ng",
    name: "Jiji Nigeria",
    baseUrl: "https://jiji.ng",
    listPaths: ["/lagos/real-estate"],
    selectors: {
      listing_link: "a[href*='/real-estate/']",
      title: "h1.b-advert-title, h3.qa-advert-title",
      price: "span.qa-advert-price, div.price",
      location: "span.b-advert-info-region, div.location",
      bedrooms: "li:contains('Bedrooms')",
      bathrooms: "li:contains('Bathrooms')",
      images: "img.b-advert-image::attr(src)",
      description: "div.b-advert-description",
      features: "ul.params li",
    },
    paginationType: "url_param",
    maxPages: 5,
    requiresBrowser: true,
    enabled: true,
  },
  {
    key: "property24-ng",
    name: "Property24 Nigeria",
    baseUrl: "https://www.property24.com.ng",
    listPaths: ["/property-for-sale/lagos", "/property-to-rent/lagos"],
    selectors: {
      listing_link: "a.js_rollover_container",
      title: "h1.p24_propertyTitle",
      price: "span.p24_price",
      location: "span.p24_location",
      bedrooms: "span.p24_featureDetails[title='Bedrooms']",
      bathrooms: "span.p24_featureDetails[title='Bathrooms']",
      images: "img.p24_mainImage::attr(src)",
      description: "div.p24_propertyDescription",
      agentName: "span.p24_agentName",
      features: "ul.p24_keyFeatures li",
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
    listPaths: ["/properties/sale", "/properties/rent"],
    selectors: {
      listing_link: "a[href*='/property/']",
      title: "h1.property-title",
      price: "span.price, div.property-price",
      location: "span.location, div.property-location",
      bedrooms: "span.beds",
      bathrooms: "span.baths",
      images: "img.property-image::attr(src)",
      description: "div.property-description",
      features: "ul.amenities li",
    },
    paginationType: "url_param",
    maxPages: 5,
    requiresBrowser: true,
    enabled: true,
  },
];

async function main() {
  console.log("Seeding Nigerian property sites...");

  for (const site of sites) {
    const existing = await prisma.site.findFirst({
      where: { key: site.key },
    });

    if (existing) {
      console.log(`  Skipping ${site.name} — already exists`);
      continue;
    }

    await prisma.site.create({ data: site });
    console.log(`  Created: ${site.name}`);
  }

  console.log("Done! Sites seeded.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
