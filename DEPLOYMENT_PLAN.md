# GarryCoin Deployment Plan: Render

This document outlines the strategy for deploying the GarryCoin bot to a production environment using Render. This plan is designed to leverage a free-tier, stable hosting solution with automated CI/CD via GitHub.

## 1. Why Render?

- **Free Tier:** Render offers a free tier suitable for this project, including a free web service, a free background worker, and a free PostgreSQL database that persists data.
- **Docker-Native:** It has first-class support for deploying services directly from a `Dockerfile`.
- **Git-based CI/CD:** It connects directly to a GitHub repository and automatically builds and deploys new commits to the `main` branch.
- **Simplicity:** The platform is user-friendly, making it easy to configure services and manage environment variables.

## 2. Deployment Steps

### Step 1: Create and Push to a GitHub Repository

The first step is to create a new repository on GitHub and push the existing local project code to it.

### Step 2: Set Up Services on Render

We will use Render's "Blueprint" feature to define all the necessary services in a single configuration file (`render.yaml`) or through the dashboard.

1.  **PostgreSQL Database:**
    *   Create a new, managed PostgreSQL instance on Render.
    *   Render will provide an internal connection URL, which we will use as an environment variable.

2.  **API Service (as a "Web Service"):**
    *   **Source:** The GitHub repository.
    *   **Type:** Web Service.
    *   **Build:** Use the project's `Dockerfile`.
    *   **Build Command:** `npx knex migrate:latest` (This runs database migrations on every deploy).
    *   **Start Command:** `npm run start-api`.
    *   **Health Check Path:** `/` (Our `index.js` handles this).

3.  **Emoji Bot (as a "Background Worker"):**
    *   **Source:** The GitHub repository.
    *   **Type:** Background Worker.
    *   **Build:** Use the project's `Dockerfile`.
    *   **Start Command:** `npm run start-bot`.

### Step 3: Configure Environment Variables

All secrets and configuration variables from the local `.env` file will be added to Render's secret management system.

- The `POSTGRES_*` variables will be replaced by the single `DATABASE_URL` from the Render PostgreSQL instance.
- `NGROK_URL` and `NGROK_AUTHTOKEN` will be removed. Render provides its own public URL for the `api` service, which will be used to update the Discord application's interaction endpoint.
- All other variables (`DISCORD_TOKEN`, `PUBLIC_KEY`, `APP_ID`, `GUILD_ID`) will be copied into Render's environment settings.
