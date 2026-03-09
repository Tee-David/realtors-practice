import { SiteService } from "./src/services/site.service";

async function run() {
  try {
    const site = await SiteService.create({
      name: "Test Site Two",
      baseUrl: "https://testtwo.com",
      key: "test-site-two",
      enabled: true,
      selectors: {}
    });
    console.log("Created successfully:", site.id);
  } catch (err) {
    console.error("Failed to create in DB:", err);
  } finally {
    process.exit(0);
  }
}

run();
