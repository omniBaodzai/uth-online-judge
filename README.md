# UTH Online Judge

An online programming judge system for programming contests, inspired by platforms such as Codeforces.

## Prerequisites

- Git
- Docker Desktop with Docker Compose

Node.js does not need to be installed on the host machine.

## Getting Started

### 1. Clone the repository

```bash
git clone -b lebao https://github.com/omniBaodzai/uth-online-judge.git
cd uth-online-judge
```

### 2. Configure environment variables

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace the sample PostgreSQL password with a strong local password.

Never commit the `.env` file or share real credentials.

### 3. Start the application

```bash
docker compose up --build -d
```

Check service status:

```bash
docker compose ps
```

### 4. Access the frontend

Open http://localhost:5173 in your browser.

PostgreSQL is exposed on port 5432 by default.

## Stopping the application

```bash
docker compose down
```

This stops and removes the containers but preserves the PostgreSQL data volume.

Do not use `docker compose down -v` unless you intentionally want to delete the database volume.

## Current Status

- [x] Docker Compose configuration
- [x] PostgreSQL container
- [x] React + Vite frontend container
- [ ] Backend API
- [ ] Online judge execution service
