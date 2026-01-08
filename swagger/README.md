# Swagger API Documentation

This directory contains OpenAPI/Swagger documentation for the NexGen Pro API.

## Accessing the Documentation

Once the server is running, you can access the Swagger UI at:

- **Swagger UI**: `http://localhost:8000/api-docs`
- **OpenAPI JSON**: `http://localhost:8000/api-docs.json`

## Structure

The following YAML files contain OpenAPI specifications for different route groups:

- `auth.yaml` - Authentication endpoints (signup, login, password reset, email verification)
- `users.yaml` - User management endpoints (CRUD operations, follow/unfollow, profile management)
- `courses.yaml` - Course management endpoints (create, update, enroll, certificates)
- `orders.yaml` - Order management endpoints (purchases, checkout, payment callbacks)
- `marketing.yaml` - Marketing and affiliate endpoints (market logs, profits, invitations)
- `instructorProfits.yaml` - Instructor profits and analytics endpoints

Additional YAML files can be added here for other route groups

## Adding New Documentation

### Option 1: Using YAML Files

Create a new `.yaml` file in the `swagger/` directory with your endpoint definitions:

```yaml
paths:
  /your-endpoint:
    get:
      tags:
        - Your Tag
      summary: Your endpoint summary
      # ... rest of your endpoint definition
```

The YAML files are automatically merged with the main specification.

### Option 2: Using JSDoc Comments

Add JSDoc comments directly in your route files:

```javascript
/**
 * @swagger
 * /api/v1/your-endpoint:
 *   get:
 *     tags:
 *       - Your Tag
 *     summary: Your endpoint summary
 *     responses:
 *       200:
 *         description: Success
 */
router.get("/your-endpoint", handler);
```

## Authentication

Most endpoints require JWT authentication. Use the "Authorize" button in Swagger UI to add your Bearer token.

## Components

Common schemas and security schemes are defined in `config/swagger.js` and can be referenced using `$ref`:

```yaml
responses:
  400:
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/ErrorResponse"
```
