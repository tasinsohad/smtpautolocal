# Cloudflare Deployment Guide - SMTP Forge

## Complete Step-by-Step Deployment Instructions

This guide will walk you through deploying SMTP Forge to Cloudflare Workers with D1 database.

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Cloudflare account (free at cloudflare.com)
- [ ] Git installed (for version control)

---

## Step 1: Install Wrangler CLI

Wrangler is the command-line tool for Cloudflare Workers.

```bash
# Install globally
npm install -g wrangler

# Or use npx (no install needed)
npx wrangler --version
```

**Verify installation:**
```bash
wrangler --version
```

---

## Step 2: Login to Cloudflare

```bash
# Opens browser for authentication
wrangler login
```

**What this does:**
- Authenticates you with your Cloudflare account
- Stores credentials locally in `~/.wrangler/config/config.toml`

---

## Step 3: Get Your Account ID

```bash
wrangler whoami
```

**Output will look like:**
```
wrangler whoami
┌──────────────────────┬──────────────────────────┐
│ Account Name         │ Your Account Name        │
├──────────────────────┼──────────────────────────┤
│ Account ID           │ abc123def456ghi789jkl    │
└──────────────────────┴──────────────────────────┘
```

**Save this Account ID** - you'll need it in Step 5.

---

## Step 4: Create D1 Database

Create an edge-optimized SQLite database for your application.

```bash
wrangler d1 create smtp-forge-db
```

**Output will look like:**
```
✅ Database 'smtp-forge-db' created successfully!
Database ID: xyz789abc123def456
Created at: 2024-04-25
```

**Save the Database ID** - you'll need it in Step 5.

---

## Step 5: Update wrangler.jsonc

Open `wrangler.jsonc` and replace the placeholder:

**BEFORE:**
```jsonc
{
  d1_databases: [
    {
      binding: 'DB',
      database_name: 'smtp-forge-db',
      database_id: 'REPLACE_WITH_YOUR_D1_DATABASE_ID',  // <-- REPLACE THIS
      migrations_dir: 'migrations'
    }
  ]
}
```

**AFTER (with your actual IDs):**
```jsonc
{
  d1_databases: [
    {
      binding: 'DB',
      database_name: 'smtp-forge-db',
      database_id: 'xyz789abc123def456',  // Your database ID
      migrations_dir: 'migrations'
    }
  ]
}
```

**Also update the GitHub Actions workflow with your Account ID:**

Edit `.github/workflows/deploy.yml` and add your Account ID in the workflow_dispatch inputs or use secrets.

---

## Step 6: Install Dependencies

```bash
# Install all npm packages
npm install

# Install Cloudflare Workers types (required for TypeScript)
npm install -D @cloudflare/workers-types

# Verify wrangler is available
npx wrangler --version
```

---

## Step 7: Apply D1 Migrations

Initialize the database schema locally, then push to production.

### Option A: Using Wrangler (Recommended for local dev)

```bash
# Create local D1 database and apply migrations
wrangler d1 create smtp-forge-db --local

# Apply migrations to local
wrangler d1 migrations apply smtp-forge-db --local
```

### Option B: Using Drizzle Kit

```bash
# Generate migrations (if schema changes)
npm run db:generate

# Push schema to local D1
npm run db:push:local

# Push schema to remote D1
npm run db:push:remote
```

---

## Step 8: Build the Application

```bash
# Build for production
npm run build

# This outputs to:
#   - .output/server/index.js (Worker code)
#   - .output/public/ (Static assets)
```

---

## Step 9: Deploy to Cloudflare Workers

### Method A: Direct Deployment (Recommended)

```bash
# Deploy using npm script
npm run deploy

# Or step by step:
npm run build
npm run predeploy
wrangler deploy
```

### Method B: Using Deploy Config

```bash
# Build and prepare deploy config
npm run build
npm run predeploy

# Deploy using generated config
wrangler deploy .output/wrangler.deploy.json
```

### Method C: With Environment Variables

```bash
# Set your account ID
export CLOUDFLARE_ACCOUNT_ID=your_account_id

# Deploy
wrangler deploy --env production
```

---

## Step 10: Verify Deployment

```bash
# Check deployment status
wrangler deployments list

# Or view worker details
wrangler worker info --name smtp-forge
```

**Your app will be available at:**
```
https://smtp-forge.YOUR_SUBDOMAIN.workers.dev
```

---

## Step 11: Configure Custom Domain (Optional)

For a custom domain:

1. Go to Cloudflare Dashboard > Workers & Pages
2. Select your `smtp-forge` worker
3. Click **Triggers** > **Custom Domains**
4. Add your domain (e.g., `app.yourdomain.com`)

---

## Troubleshooting

### Error: D1 binding 'DB' not found

**Cause:** Database not created or ID incorrect in wrangler.jsonc

**Fix:**
```bash
# Verify database exists
wrangler d1 list

# Check wrangler.jsonc has correct database_id
cat wrangler.jsonc | grep database_id
```

### Error: migrations apply failed

**Cause:** Migrations already applied or inconsistent state

**Fix:**
```bash
# Remove local database and recreate
wrangler d1 delete smtp-forge-db --local
wrangler d1 create smtp-forge-db --local
wrangler d1 migrations apply smtp-forge-db --local
```

### Error: Workers Paid plan required for smart placement

**Cause:** `placement.mode = 'smart'` requires paid plan

**Fix:** Remove the `placement` section from wrangler.jsonc:
```jsonc
{
  // Remove this section if on free tier:
  // placement: {
  //   mode: 'smart'
  // }
}
```

### Build fails with TypeScript errors

```bash
# Check for type errors
npm run typecheck

# Fix any errors shown
```

### Deploy fails with 255 error

**Cause:** Usually authentication issue

**Fix:**
```bash
# Re-authenticate
wrangler login

# Verify credentials
wrangler whoami
```

---

## Local Development

### Start Local Dev Server

```bash
# With local D1
npm run preview

# Access at http://localhost:8787
```

### Make Changes and Redeploy

```bash
# 1. Make code changes
# 2. Build
npm run build

# 3. Deploy
npm run deploy
```

---

## GitHub Actions CI/CD Setup

For automatic deployments on push to main:

### Step 1: Create Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template
4. Grant permissions:
   - Account: Workers:Edit
   - Zone: Workers Scripts:Edit
5. Create and **copy the token immediately** (shown only once)

### Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add:
   - **Name:** `CLOUDFLARE_API_TOKEN`
   - **Value:** (your API token from Step 1)
5. Add another:
   - **Name:** `CLOUDFLARE_ACCOUNT_ID`
   - **Value:** (your account ID)
6. (Optional) Add:
   - **Name:** `CLOUDFLARE_D1_DATABASE_ID`
   - **Value:** (your D1 database ID - the workflow will auto-create this if not provided)

### Step 3: Push to Main

```bash
git add .
git commit -m 'Configure for Cloudflare deployment'
git push origin main
```

**GitHub Actions will automatically:**
1. Install dependencies
2. Run type checking
3. Build the application
4. Apply D1 migrations
5. Deploy to Cloudflare Workers

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes (production) | API token for Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | Yes (production) | Your Cloudflare account ID |
| `D1_DATABASE_ID` | Yes | D1 database identifier |
| `APP_ENV` | No | `development` or `production` |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Cloudflare Edge                     │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │           SMTP Forge Workers             │   │
│  │                                         │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  │   │
│  │  │  SSR    │  │  API    │  │  Static │  │   │
│  │  │ Handler │  │ Handler │  │  Files  │  │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  │   │
│  │       │            │            │        │   │
│  │  ┌────▼────────────▼────────────▼────┐  │   │
│  │  │           D1 Database             │  │   │
│  │  │         (SQLite @ Edge)           │  │   │
│  │  └───────────────────────────────────┘  │   │
│  │                                         │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## Security Notes

- Authentication is mock-based (auto-creates default user for development)
- **For production:** Implement proper auth (Auth.js, Clerk, etc.)
- Store sensitive API keys via `wrangler secret put SECRET_NAME`
- D1 database is encrypted at rest and in transit
- Use HTTPS for all connections (automatic with Cloudflare)

---

## Performance

- Workers run at 35+ edge locations globally
- D1 has ~2ms typical query latency
- Smart placement auto-selects optimal datacenter (Workers Paid plan)
- Static assets cached at edge with immutable headers

---

## Resources

- [TanStack Start Cloudflare Deployment](https://tanstack.com/start/latest/docs/framework/react/deployments)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions with Wrangler](https://developers.cloudflare.com/workers/ci/cd/)

---

## Quick Reference Commands

```bash
# Install
npm install && npm install -D @cloudflare/workers-types

# Login
wrangler login

# Create D1
wrangler d1 create smtp-forge-db

# Apply migrations
wrangler d1 migrations apply smtp-forge-db --local

# Build & Deploy
npm run build && npm run deploy

# Local dev
npm run preview
```