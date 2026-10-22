# Docker Setup for StockPilot

Complete Docker setup for running StockPilot (Next.js app + MongoDB) in production or development.

## Prerequisites

- Docker Desktop installed
- Docker Compose v2.x or later

## Quick Start - Full Stack (App + Database)

### 1. Create Environment File

Create a `.env.local` file in the project root:

```bash
MONGODB_PASSWORD=StockPilot@2026
JWT_ACCESS_SECRET=your_unique_random_secret_here_minimum_32_characters
JWT_REFRESH_SECRET=another_different_random_secret_minimum_32_chars
```

### 2. Build and Start Everything

```bash
# Build and start all services
docker-compose up --build -d

# Wait 1-2 minutes for build and MongoDB initialization
docker-compose logs -f app
```

### 3. Access the Application

- **Application**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **MongoDB Express** (dev only): http://localhost:8081

## Development Mode (Local App + Docker Database)

If you want to run the app locally but use Docker for MongoDB:

### 1. Start MongoDB Only

```bash
docker-compose up -d mongodb
```

### 2. Set Local Environment

Create `.env.local`:

```bash
MONGODB_URI=mongodb://admin:StockPilot@2026@localhost:27017/stockpilot?authSource=admin
JWT_ACCESS_SECRET=your_secret_here
JWT_REFRESH_SECRET=another_secret_here
```

### 3. Run App Locally

```bash
pnpm install
pnpm dev
```

Access at http://localhost:3000

## Docker Commands Reference

### Basic Operations

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f app
docker-compose logs -f mongodb

# Restart a service
docker-compose restart app

# Rebuild after code changes
docker-compose up --build -d
```

### Database Management

```bash
# Access MongoDB shell
docker-compose exec mongodb mongosh \
  --username admin \
  --password StockPilot@2026 \
  --authenticationDatabase admin \
  stockpilot

# Backup database
docker-compose exec mongodb mongodump \
  --username admin \
  --password StockPilot@2026 \
  --authenticationDatabase admin \
  --db stockpilot \
  --out /tmp/backup

# Restore from backup
docker-compose exec mongodb mongorestore \
  --username admin \
  --password StockPilot@2026 \
  --authenticationDatabase admin \
  --db stockpilot \
  /tmp/backup/stockpilot
```

### Cleanup

```bash
# Stop and remove containers, networks
docker-compose down

# Also remove volumes (WARNING: deletes all data!)
docker-compose down -v

# Remove unused images
docker image prune -a
```

## Production Deployment

### 1. Update Security Settings

Change default passwords in `.env.local`:

```bash
MONGODB_PASSWORD=very_secure_password_here
JWT_ACCESS_SECRET=random_32_char_string_use_openssl_rand
JWT_REFRESH_SECRET=different_random_32_char_string
```

Generate secure secrets:

```bash
# Generate random secret
openssl rand -base64 48
```

### 2. Disable Mongo Express

Remove the `profiles: [dev]` line from mongo-express service or comment it out.

### 3. Add Resource Limits

Add to each service in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### 4. Use Docker Secrets (Optional)

For production, consider using Docker secrets instead of environment variables for sensitive data.

## Architecture

```
┌─────────────────┐
│   Next.js App   │ Port 3000
│   (Node 20)     │
└────────┬────────┘
         │
         │ mongodb://mongodb:27017
         │
┌────────▼────────┐
│    MongoDB      │ Port 27017
│    (v7.0)       │
└─────────────────┘
```

**Services:**
- **app**: Next.js application with standalone output
- **mongodb**: MongoDB database with persistent storage
- **mongo-express**: Web-based MongoDB admin UI (dev only)

## Troubleshooting

### App won't start

```bash
# Check app logs
docker-compose logs app

# Check if MongoDB is healthy
docker-compose ps

# Verify environment variables
docker-compose exec app env | grep MONGODB
```

### MongoDB connection issues

```bash
# Test MongoDB connection
docker-compose exec mongodb mongosh \
  --username admin \
  --password StockPilot@2026 \
  --authenticationDatabase admin \
  --eval "db.stats()"
```

### Port already in use

If port 3000 or 27017 is already in use, change in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Map container 3000 to host 3001
```

### Database not initialized

```bash
# Reset everything (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d mongodb

# Wait for health check
docker-compose ps

# Then start app
docker-compose up -d app
```

### Build fails

```bash
# Clear Docker cache
docker builder prune -a

# Rebuild without cache
docker-compose build --no-cache
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | Yes* | Auto-generated |
| `MONGODB_PASSWORD` | MongoDB admin password | No | `StockPilot@2026` |
| `JWT_ACCESS_SECRET` | JWT signing secret for access tokens | Yes | - |
| `JWT_REFRESH_SECRET` | JWT signing secret for refresh tokens | Yes | - |
| `NODE_ENV` | Node environment | No | `production` |
| `PORT` | Application port | No | `3000` |

*Auto-generated when using full Docker setup

## Data Persistence

Data is stored in Docker volume `mongodb_data` and persists across:
- Container restarts
- Container removal
- System reboots

To backup: Use mongodump command shown above.
To restore: Use mongorestore command shown above.

## Health Checks

Both services have health checks configured:

- **MongoDB**: Runs every 30s, checks if database accepts connections
- **App**: Runs every 30s, checks `/api/health` endpoint

View health status:

```bash
docker-compose ps
```

## Performance Tips

1. **Use .dockerignore**: Reduces build context size
2. **Multi-stage builds**: Already configured in Dockerfile
3. **Standalone output**: Next.js optimized for production
4. **Non-root user**: Security best practice
5. **Layer caching**: Dependencies installed separately from source

## CI/CD Integration

Example GitHub Actions snippet:

```yaml
- name: Build and test
  run: |
    docker-compose up --build -d
    sleep 60
    curl -f http://localhost:3000/api/health || exit 1
    docker-compose down
```
