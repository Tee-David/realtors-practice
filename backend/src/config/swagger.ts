import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { type Application } from "express";
import { config } from "./env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Realtors' Practice API",
      version: "3.0.0",
      description:
        "Nigerian property intelligence platform API. Scrapes, validates, enriches, and serves Nigerian real estate listings.\n\n" +
        "## Authentication\n" +
        "Most endpoints require a Bearer JWT token obtained from Supabase Auth via `/auth/login`.\n" +
        "Internal endpoints (scraper callbacks) use the `X-Internal-Key` header.\n\n" +
        "## Rate Limits\n" +
        "- General: 300 req / 15 min (production)\n" +
        "- Auth: 10 req / hour (production)",
      contact: {
        name: "WDC Solutions Hub",
      },
    },
    servers: [
      {
        url: config.env === "production"
          ? "https://realtors-practice-new-api.onrender.com/api"
          : `http://localhost:${config.port}/api`,
        description: config.env === "production" ? "Production Server" : "Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Look for swagger JSDoc comments in all route files, controllers, and services
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/services/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Application) {
  // Swagger UI route
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Realtors' Practice API Docs",
  }));

  // Endpoint to serve the raw swagger spec as JSON
  app.get("/api/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}
