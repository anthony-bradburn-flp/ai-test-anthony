# Code Summary

## Project Overview

This is a **Full-Stack Web Application** for project governance document management and generation, built for "Flipside Group". It streamlines project onboarding by capturing project details and auto-generating governance documents.

---

## Architecture

```
/
├── client/          # React frontend
├── server/          # Express.js backend API
├── shared/          # Shared TypeScript schemas and types
├── migrations/      # Database migrations (Drizzle ORM)
├── script/          # Build scripts
└── dist/            # Production build output
```

**Pattern**: Monorepo with clear client/server/shared separation, type-safe end-to-end with TypeScript and Zod.

---

## Key Functionality

### 1. Project Intake Form (`client/src/pages/governance-starter.tsx`)
A multi-section form organized into 4 tabs:
- **Project Info**: Client name, project type, description, billing milestones with percentage validation (must sum to 100%), date range validation
- **Flipside Stakeholders**: Dynamic field array to add/remove internal team members with role assignment
- **Client Stakeholders**: Dynamic field array for client contacts with sponsor selection
- **Documentation**: File upload and document preferences

### 2. Admin Dashboard (`client/src/pages/admin.tsx`)
Tabs for managing the governance infrastructure:
- **Document Packages**: Configure document bundles per project type
- **Templates**: Manage governance document templates (RACI, RAID logs, Risk Registers, Communications Plans, etc.)
- **Users**: User management
- **AI Settings**: Configure AI model for document generation

### 3. Backend API (`server/`)
- `index.ts`: Express app with middleware and request logging
- `routes.ts`: API route registration (structured for expansion)
- `storage.ts`: `IStorage` interface with in-memory implementation — ready to swap in database-backed storage

---

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Radix UI, React Hook Form, Zod, Wouter, React Query |
| Backend | Express.js 5, Node.js/TypeScript, Drizzle ORM, PostgreSQL |
| Auth | Passport.js + express-session (scaffolded, not yet implemented) |
| Build | Vite (client), esbuild (server), tsx |
| Animations | Framer Motion |
| Icons | Lucide React |
| Notifications | Sonner (toasts) |

---

## Notable Patterns

- **Type Safety**: End-to-end TypeScript with Zod schema validation shared between client and server
- **Storage Abstraction**: `IStorage` interface decouples business logic from storage backend
- **Dynamic Forms**: `react-hook-form` field arrays for stakeholders and billing milestones
- **Custom Validation**: Billing percentages summing to 100%, date range checks
- **Path Aliases**: `@/` for client code, `@shared/` for shared code
- **Selective Bundling**: esbuild server bundling with an allowlist to minimize cold start time

---

## Database

- PostgreSQL via Drizzle ORM
- Current schema: `users` table with UUID primary keys
- Migration system in place via Drizzle Kit
- Designed to expand with projects, templates, and packages tables

---

## Development & Deployment

- Dev server on port 5000 with Vite HMR integration
- Designed for Replit deployment (Replit Vite plugins included)
- Production build: `vite build` (client) + `esbuild` (server)
