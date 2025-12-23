const swaggerJsdoc = require("swagger-jsdoc");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

// Base OpenAPI definition
const baseDefinition = {
  openapi: "3.0.0",
  info: {
    title: "NexGen Pro API",
    version: "1.0.0",
    description: "API documentation for NexGen Pro platform",
    contact: {
      name: "API Support",
    },
  },
  servers: [
    {
      url: process.env.BASE_URL || "http://localhost:8000/api/v1",
      description: "Development server",
    },
    {
      url: "/api/v1",
      description: "Relative URL",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token obtained from authentication endpoint",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          status: {
            type: "string",
            example: "error",
          },
          message: {
            type: "string",
            example: "Error message description",
          },
          error: {
            type: "string",
            example: "Detailed error information",
          },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          status: {
            type: "string",
            example: "success",
          },
        },
      },
    },
  },
  tags: [
    {
      name: "Instructor Profits",
      description: "Endpoints for managing instructor profits and analytics",
    },
    {
      name: "Authentication",
      description: "User authentication and authorization endpoints",
    },
    {
      name: "Users",
      description: "User management endpoints",
    },
    {
      name: "Courses",
      description: "Course management endpoints",
    },
    {
      name: "Orders",
      description: "Order management endpoints",
    },
    {
      name: "Marketing",
      description: "Marketing and affiliate endpoints",
    },
  ],
};

// Load and merge YAML files
function loadYamlFiles() {
  const swaggerDir = path.join(__dirname, "../swagger");
  const mergedSpec = {
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
    },
  };

  if (fs.existsSync(swaggerDir)) {
    const files = fs.readdirSync(swaggerDir);
    files.forEach((file) => {
      if (file.endsWith(".yaml") || file.endsWith(".yml")) {
        try {
          const filePath = path.join(swaggerDir, file);
          const fileContents = fs.readFileSync(filePath, "utf8");
          const yamlDoc = yaml.load(fileContents);

          // Merge paths
          if (yamlDoc.paths) {
            Object.assign(mergedSpec.paths, yamlDoc.paths);
          }

          // Merge components/schemas
          if (yamlDoc.components && yamlDoc.components.schemas) {
            Object.assign(
              mergedSpec.components.schemas,
              yamlDoc.components.schemas
            );
          }

          // Merge components/securitySchemes
          if (yamlDoc.components && yamlDoc.components.securitySchemes) {
            Object.assign(
              mergedSpec.components.securitySchemes,
              yamlDoc.components.securitySchemes
            );
          }
        } catch (error) {
          console.error(`Error loading YAML file ${file}:`, error.message);
        }
      }
    });
  }

  return mergedSpec;
}

// Generate spec from JSDoc comments
const jsdocOptions = {
  definition: baseDefinition,
  apis: [path.join(__dirname, "../routes/*.js")],
};

const jsdocSpec = swaggerJsdoc(jsdocOptions);

// Load YAML files and merge
const yamlSpec = loadYamlFiles();

// Merge JSDoc spec with YAML spec
const mergedSpec = {
  ...jsdocSpec,
  paths: {
    ...jsdocSpec.paths,
    ...yamlSpec.paths,
  },
  components: {
    ...jsdocSpec.components,
    schemas: {
      ...(jsdocSpec.components?.schemas || {}),
      ...yamlSpec.components.schemas,
    },
    securitySchemes: {
      ...(jsdocSpec.components?.securitySchemes || {}),
      ...yamlSpec.components.securitySchemes,
    },
  },
};

module.exports = mergedSpec;
