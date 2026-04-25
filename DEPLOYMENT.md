# Cloudflare Deployment Guide

## SMTP Forge - Cloudflare Workers + D1

This guide covers deploying SMTP Forge to Cloudflare Workers with D1 SQLite database.

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account with Workers plan

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Cloudflare Workers Types

```bash
npm install -D @cloudflare/workers-types
```

### 3. Configure Cloudflare Credentials

```bash
# Login to Cloudflare
wrangler login

# Set your Account ID (found in Cloudflare dashboard)
wrangler whoami
```

### 4. Create D1 Database (if not exists)

```bash
# Create database
wrangler d1 create smtp-forge-db

# Update database_id in wrangler.jsonc with the returned ID
```

### 5. Apply Migrations

```bash
# Local development
npm run db:migrate:local

# Production
npm run db:migrate:remote
```

### 6. Build and Deploy

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Or use Workers specific deployment
npm run deploy:workers
```

## Development

### Local Development Server

```bash
# Start with local D1
npm run preview

# With remote D1
npm run preview:remote
```

### Database Operations

```bash
# Generate migrations after schema changes
npm run db:generate

# Push schema to local D1
npm run db:push:local

# Push schema to remote D1
npm run db:push:remote

# Open Drizzle Studio
npm run db:studio
```

## Configuration Files

### wrangler.jsonc

The main configuration for Cloudflare Workers:
- `main`: Server entry point
- `d1_databases`: D1 database bindings
- `assets`: Static file serving
- `placement`: Edge compute optimization

### Environment Variables

Set via `wrangler secret` for sensitive values:
```bash
wrangler secret put SECRET_NAME
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Cloudflare Edge                     │
│  ┌─────────────────────────────────────────┐   │
│  │           SMTP Forge Workers             │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  │   │
│  │  │  SSR    │  │  API    │  │  Static │  │   │
│  │  │ Handler │  │ Handler │  │  Files  │  │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  │   │
│  │       │            │            │        │   │
│  │  ┌────▼────────────▼────────────▼────┐  │   │
│  │  │           D1 Database             │  │   │
│  │  │         (SQLite @ Edge)           │  │   │
│  │  └───────────────────────────────────┘  │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Troubleshooting

### D1 Binding Not Found

```
❌ Cloudflare D1 binding 'DB' not found!
```

**Fix:** 
1. Ensure `d1_databases` in wrangler.jsonc has `binding: 'DB'`
2. Run migrations: `npm run db:migrate:local`
3. Verify wrangler.jsonc is in project root

### Build Fails

Check that `@cloudflare/workers-types` is installed:
```bash
npm install -D @cloudflare/workers-types
```

### Type Errors

Run TypeScript check:
```bash
npm run typecheck
```

## Security Notes

- Authentication is currently mock-based (auto-creates default user)
- For production, implement proper auth (Auth.js, Clerk, etc.)
- Store sensitive API keys via `wrangler secret`
- D1 database is encrypted at rest and in transit

## Performance

- Workers run at 35+ edge locations globally
- D1 has ~2ms typical query latency
- Smart placement automatically selects optimal datacenter (requires Workers Paid plan)
- Static assets cached at edge with immutable headers

## Important Notes

### Smart Placement (Workers Paid Plan)

The `placement: { mode: 'smart' }` setting in wrangler.jsonc automatically runs your Worker at the optimal datacenter based on latency. **This requires a Workers Paid plan**.

If you're on the free tier, remove the `placement` section from wrangler.jsonc.

### Build Output

The `cloudflare-workers` preset outputs to the `.output/` directory:
- Server: `.output/server/index.js`
- Static assets: `.output/public/`

This is configured in wrangler.jsonc `main` and `assets` paths.

## GitHub Actions CI/CD

The project includes automatic deployment via GitHub Actions. Every push to `main` will:

1. Install dependencies
2. Run type checking and linting
3. Build the application
4. Apply D1 migrations
5. Deploy to Cloudflare Workers

### Setup GitHub Secrets

To enable automatic deployment, you need to add two secrets to your GitHub repository:

1. **CLOUDFLARE_API_TOKEN** - Create a Cloudflare API token:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - Click "Create Token"
   - Use "Edit Cloudflare Workers" template or create custom token with:
     - `Account: Workers:Edit`
     - `Zone: Workers Scripts:Edit`
   - Copy the generated token

2. **CLOUDFLARE_ACCOUNT_ID** - Your Cloudflare Account ID:
   - Found in Cloudflare Dashboard > Overview
   - Or run `wrangler whoami` locally

### Adding Secrets to GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add:
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: (your API token)
5. Add another secret:
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Value: (your account ID)

### Manual Deployment

You can also trigger deployment manually:
1. Go to the **Actions** tab in your GitHub repository
2. Select the "Deploy to Cloudflare Workers + D1" workflow
3. Click **Run workflow**

## Resources

- [TanStack Start Cloudflare Deployment](https://tanstack.com/start/latest/docs/framework/react/deployments)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)