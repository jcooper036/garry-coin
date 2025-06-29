# GarryCoin Design and Hosting Plan

This document outlines the technical design, hosting, and deployment strategy for the GarryCoin bot. The core principle is to use containerization with Docker to ensure a consistent and reproducible environment across all stages of development and production.

## 1. Technology Stack

- **Language/Framework**: Use python and the discord provided python SDK
- **Database**: PostgreSQL for persistent data storage (user wallets, transaction history).
- **Containerization**: Docker and Docker Compose.

## 2. Development Environment (Local Hosting)

For local development and testing, we will use Docker Compose to orchestrate the bot and its database in a self-contained environment.

### `docker-compose.yml`

A `docker-compose.yml` file at the root of the project will define two main services:

1.  **`bot` service:**
    *   Built from a `Dockerfile` located in the project repository.
    *   This container will run the Node.js application, which connects to Discord and listens for events.
    *   It will be configured to automatically restart if it crashes.
    *   The service will depend on the `db` service to ensure the database is available before the bot starts.

2.  **`db` service:**
    *   Uses the official `postgres` Docker image.
    *   A Docker volume will be used to persist the database data on the host machine, so data is not lost when the container is stopped or restarted.
    *   Database credentials (username, password) will be configured via environment variables.

### Workflow

With this setup, the entire development environment can be started with a single command:

```bash
docker compose up --build
```

The bot application will connect to the PostgreSQL database using the service name (`db`) as the hostname, leveraging Docker's internal networking.

### Secret Management

Sensitive information, such as the Discord bot token and database password, will be managed using a `.env` file. This file will be loaded by the `docker-compose.yml` but will be listed in `.gitignore` to prevent it from being committed to version control.

## 3. Production Environment (Deployment)

### Hosting Provider

The recommended hosting providers are **Railway** or **Render**. Both platforms offer excellent support for Docker-based deployments and provide managed database services.

### Deployment Strategy

1.  **Source Control:** The code will be hosted on GitHub.
2.  **Deployment Trigger:** The hosting platform will be connected to the GitHub repository. Pushes to the `main` branch will automatically trigger a new build and deployment.
3.  **Bot Service:** The platform will use the `Dockerfile` from the repository to build and deploy the GarryCoin bot service.
4.  **Database Service:** A managed PostgreSQL instance will be provisioned directly on the hosting platform.
5.  **Configuration:** The bot's environment variables (including the database connection string and Discord token) will be securely configured in the hosting platform's dashboard. The application will be updated to use the provided production database URL instead of the local Docker one.

This strategy provides a seamless, automated deployment pipeline from a `git push` to a live, running application.
