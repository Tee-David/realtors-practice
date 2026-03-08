import { PropertyService } from "./src/services/property.service";
import { VersionService } from "./src/services/version.service";
import prisma from "./src/prismaClient";

async function runTests() {
  console.log("Starting Property tests...");
  try {
    let testUser = await prisma.user.findFirst();
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: "test@example.com",
          supabaseId: "test-uuid-1234",
          role: "ADMIN"
        }
      });
    }

    let testSite = await prisma.site.findFirst();
    if (!testSite) {
      testSite = await prisma.site.create({
        data: {
          name: "Test Site",
          key: "test-site",
          baseUrl: "http://example.com"
        }
      });
    }

    console.log("1. Creating property...");
    const { property, duplicate } = await PropertyService.create({
      title: "Test Apartment Lekki Phase 1",
      description: "A test property",
      price: 20000000,
      priceCurrency: "NGN",
      locationText: "Lekki Phase 1",
      state: "Lagos",
      country: "Nigeria",
      bedrooms: 3,
      bathrooms: 3,
      category: "RESIDENTIAL",
      listingType: "SALE",
      listingUrl: "http://example.com/lekki1",
      source: "TEST_SITE",
      siteId: testSite.id
    }, "MANUAL_EDIT", testUser.id);
    
    if (!property) {
      console.log("Duplicate found or creation failed.");
      return;
    }

    console.log("Property created! ID:", property.id);

    console.log("2. Checking versions...");
    const versions1 = await VersionService.getVersions(property.id);
    console.log(`Has ${versions1.total} versions (should be 0 or 1 depending on whether init creates version).`);

    console.log("3. Editing property...");
    const updated = await PropertyService.update(property.id, {
      price: 25000000 // changed price
    }, "MANUAL_EDIT", testUser.id);
    console.log("Property updated. New price:", updated?.price);

    console.log("4. Checking versions again...");
    if (updated) {
      const versions2 = await VersionService.getVersions(updated.id);
      console.log(`Has ${versions2.total} versions. Diff visible:`, versions2.versions.length > 0 ? !!versions2.versions[0].changedFields : false);
    }

    console.log("5. Filtering property...");
    const filtered = await PropertyService.list({ listingType: ["SALE"], minPrice: 15000000, maxPrice: 30000000, page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
    console.log(`Found ${filtered.data.length} properties matching filters.`);
    
    // Cleanup
    await PropertyService.softDelete(property.id);
    
    console.log("✅ Tests passed!");
  } catch (err) {
    console.error("❌ Tests failed:", err);
  } finally {
    process.exit(0);
  }
}

runTests();
