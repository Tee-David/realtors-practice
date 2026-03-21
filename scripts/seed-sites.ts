/**
 * Seed all 49 Nigerian property sites into the database.
 * Run: npx tsx scripts/seed-sites.ts
 *
 * Uses upsert (by key) so it's safe to run multiple times.
 * Does NOT delete existing sites.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SITES = [
  { key: "adronhomes", name: "Adron Homes", baseUrl: "https://adronhomesproperties.com/", enabled: false },
  { key: "ashproperties", name: "Ash Properties & Constructions", baseUrl: "https://ashpropertiesng.com/", enabled: false },
  { key: "brokerfield", name: "Brokerfield Real Estate", baseUrl: "https://brokerfieldrealestate.com/", enabled: false },
  { key: "buyletlive", name: "BuyLetLive", baseUrl: "https://buyletlive.com/", enabled: true, listPaths: ["/properties/all?page=1"] },
  { key: "castles", name: "Castles", baseUrl: "https://castles.com.ng/", enabled: false },
  { key: "cuddlerealty", name: "Cuddle Realty", baseUrl: "https://cuddlerealty.com/", enabled: false },
  { key: "cwlagos", name: "CW Real Estate", baseUrl: "https://cwlagos.com/", enabled: false },
  { key: "edenoasis", name: "Eden Oasis Realty", baseUrl: "https://www.edenoasisrealty.com/", enabled: true },
  { key: "estateintel", name: "Estate Intel", baseUrl: "https://estateintel.com/", enabled: false },
  { key: "facibus", name: "Facibus Housing", baseUrl: "https://facibushousing.com/", enabled: false },
  { key: "giddaa", name: "Giddaa", baseUrl: "https://giddaa.com/", enabled: false },
  { key: "gtexthomes", name: "Gtext Homes", baseUrl: "https://gtexthomes.com/", enabled: false },
  { key: "houseafrica", name: "HouseAfrica", baseUrl: "https://www.houseafrica.com.ng/", enabled: false },
  { key: "hutbay", name: "Hutbay", baseUrl: "https://www.hutbay.com/", enabled: false },
  { key: "jiji", name: "Jiji Real Estate", baseUrl: "https://jiji.ng/real-estate", enabled: true, listPaths: ["/real-estate?page=1"] },
  { key: "lagosproperty", name: "Lagos Property", baseUrl: "https://lagosproperty.net/", enabled: false },
  { key: "lamudi", name: "Lamudi Nigeria", baseUrl: "https://www.lamudi.com.ng/", enabled: false },
  { key: "landmall", name: "Landmall.ng", baseUrl: "https://www.landmall.ng/", enabled: false },
  { key: "landng", name: "Land.ng", baseUrl: "https://land.ng/", enabled: false },
  { key: "lodges", name: "Lodges.ng", baseUrl: "https://www.lodges.ng/", enabled: false },
  { key: "myproperty", name: "MyProperty.ng", baseUrl: "https://www.myproperty.ng/", enabled: false },
  { key: "naijahouses", name: "NaijaHouses", baseUrl: "https://www.naijahouses.com/", enabled: false },
  { key: "naijalandlord", name: "NaijaLandlord", baseUrl: "https://www.naijalandlord.com/", enabled: false },
  { key: "nazaprimehive", name: "Nazaprime Hive", baseUrl: "https://hive.nazaprime.com.ng/", enabled: false },
  { key: "nigerianpropertymarket", name: "Nigerian Property Market", baseUrl: "https://nigerianpropertymarket.com/", enabled: false },
  { key: "nigeriapropertyzone", name: "Nigeria Property Zone", baseUrl: "https://nigeriapropertyzone.com.ng/", enabled: false },
  {
    key: "npc", name: "Nigeria Property Centre", baseUrl: "https://nigeriapropertycentre.com/",
    enabled: true,
    listPaths: [
      "/for-sale/flats-apartments/lagos/showtype?bedrooms=0",
      "/for-sale/houses/lagos/showtype?bedrooms=0",
      "/for-rent/flats-apartments/lagos/showtype?bedrooms=0",
    ],
  },
  { key: "olist", name: "OList Real Estate", baseUrl: "https://www.olist.ng/real-estate", enabled: false },
  { key: "oparahrealty", name: "Oparah Realty", baseUrl: "https://oparahrealty.com/", enabled: false },
  { key: "ownahome", name: "Ownahome", baseUrl: "https://ownahome.ng/", enabled: false },
  { key: "privateproperty", name: "Private Property Nigeria", baseUrl: "https://www.privateproperty.com.ng/", enabled: true },
  { key: "pwanhomes", name: "Pwan Homes", baseUrl: "https://www.pwanhomes.com/", enabled: false },
  { key: "propertieslinkng", name: "Propertylink Nigeria", baseUrl: "https://propertieslinkng.com/", enabled: false },
  { key: "property24", name: "Property24 Nigeria", baseUrl: "https://www.property24.com.ng/", enabled: true, listPaths: ["/property-for-sale", "/property-to-rent"] },
  { key: "propertyguru", name: "Property Guru NG", baseUrl: "https://propertyguru.com.ng/", enabled: false },
  { key: "propertylisthub", name: "Property List Hub", baseUrl: "https://propertylisthub.com/", enabled: false },
  {
    key: "propertypro", name: "PropertyPro Nigeria", baseUrl: "https://www.propertypro.ng/",
    enabled: true,
    listPaths: ["/property-for-sale/lagos", "/property-for-rent/lagos"],
  },
  { key: "quicktellerhomes", name: "Quickteller Homes", baseUrl: "https://homes.quickteller.com/", enabled: false },
  { key: "ramos", name: "Ramos Real Estate", baseUrl: "https://ramosrealestateng.com/", enabled: false },
  { key: "realestatenigeria", name: "Real Estate Nigeria", baseUrl: "https://www.realestatenigeria.com/", enabled: false },
  { key: "realtorintl", name: "Realtor.com Intl Nigeria", baseUrl: "https://www.realtor.com/international/ng/", enabled: false },
  { key: "realtorng", name: "Realtor.ng", baseUrl: "https://www.realtor.ng/", enabled: false },
  { key: "rentsmallsmall", name: "RentSmallSmall", baseUrl: "https://rentsmallsmall.ng/", enabled: false },
  { key: "spleet", name: "Spleet", baseUrl: "https://spleet.africa/", enabled: false },
  { key: "takooka_props", name: "Takooka Properties", baseUrl: "https://properties.takooka.com/", enabled: false },
  { key: "thinkmint", name: "Thinkmint Nigeria", baseUrl: "https://buyrealestate.thinkmint.ng/", enabled: false },
  { key: "tradebanq", name: "TradeBanq", baseUrl: "https://www.tradebanq.com/", enabled: false },
  { key: "trovit", name: "Trovit Homes NG", baseUrl: "https://homes.trovit.ng/", enabled: false },
  { key: "ubosieleh", name: "Ubosi Eleh & Co.", baseUrl: "https://ubosieleh.com/", enabled: false },
];

async function main() {
  console.log(`Seeding ${SITES.length} sites...\n`);

  let created = 0;
  let updated = 0;

  for (const site of SITES) {
    const data = {
      name: site.name,
      baseUrl: site.baseUrl,
      enabled: site.enabled,
      parser: "universal",
      listPaths: site.listPaths || [],
      paginationType: "auto",
      maxPages: 15,
      requiresBrowser: true,
    };

    const result = await prisma.site.upsert({
      where: { key: site.key },
      create: { key: site.key, ...data },
      update: data,
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
      console.log(`  ✓ Created: ${site.name} (${site.key})`);
    } else {
      updated++;
      console.log(`  ↻ Updated: ${site.name} (${site.key})`);
    }
  }

  console.log(`\nDone: ${created} created, ${updated} updated`);
  console.log(`Enabled sites: ${SITES.filter(s => s.enabled).length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
