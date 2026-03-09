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
      description: "API documentation for the Realtors' Practice real estate platform.",
      contact: {
        name: "WDC Solutions Hub",
      },
    },
    servers: [
      {
        url: config.env === "production" ? "https://realtorspractice.onrender.com/api" : "http://localhost:5000/api",
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
  // Look for swagger JSDoc comments in all route files and controllers
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
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
