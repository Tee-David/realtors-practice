import { createSiteSchema } from "./src/validators/site.validators";

const testPayload = {
  name: "Test Site",
  baseUrl: "https://test.com",
  key: "test-site",
  enabled: true,
  selectors: {}
};

const result = createSiteSchema.safeParse(testPayload);

if (!result.success) {
  console.log("Validation Failed:", JSON.stringify(result.error.errors, null, 2));
} else {
  console.log("Validation Passed:", result.data);
}
