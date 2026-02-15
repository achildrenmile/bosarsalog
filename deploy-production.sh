#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f ".env.production" ]; then
    source .env.production
else
    echo -e "${RED}Error: .env.production file not found${NC}"
    echo "Copy .env.production.example to .env.production and configure it"
    exit 1
fi

# Validate required variables
REQUIRED_VARS="DEPLOY_HOST REMOTE_DIR CONTAINER_NAME IMAGE_NAME CONTAINER_PORT SITE_URL JWT_SECRET"
for var in $REQUIRED_VARS; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: $var is not set in .env.production${NC}"
        exit 1
    fi
done

# Check for --rebuild flag
REBUILD_FLAG=""
if [ "$1" == "--rebuild" ]; then
    REBUILD_FLAG="--no-cache"
    echo -e "${YELLOW}Rebuild flag set — will build without cache${NC}"
fi

echo -e "${GREEN}=== Deploying BOS-ARSA Log to $DEPLOY_HOST ===${NC}"
echo "Host: $DEPLOY_HOST"
echo "Remote dir: $REMOTE_DIR"
echo "Container: $CONTAINER_NAME"
echo "Port: $CONTAINER_PORT"
echo ""

# Step 1: Sync code to remote host
echo -e "${GREEN}Step 1: Syncing code...${NC}"
GIT_URL=$(git remote get-url origin 2>/dev/null || echo "")
ssh "$DEPLOY_HOST" "
    if [ -d '$REMOTE_DIR' ]; then
        cd '$REMOTE_DIR' && git pull
    else
        mkdir -p '$(dirname $REMOTE_DIR)'
        git clone '$GIT_URL' '$REMOTE_DIR'
    fi
"

# Step 2: Copy .env.production to remote
echo -e "${GREEN}Step 2: Copying environment config...${NC}"
scp .env.production "$DEPLOY_HOST:$REMOTE_DIR/.env"

# Create .env file for docker compose
ssh "$DEPLOY_HOST" "cat > '$REMOTE_DIR/.env' << 'ENVEOF'
JWT_SECRET=$JWT_SECRET
ENVEOF"

# Step 3: Build Docker image on remote
echo -e "${GREEN}Step 3: Building Docker image...${NC}"
ssh "$DEPLOY_HOST" "
    cd '$REMOTE_DIR'
    docker build $REBUILD_FLAG -t '$IMAGE_NAME' .
"

# Step 4: Restart container via docker compose
echo -e "${GREEN}Step 4: Restarting container...${NC}"
ssh "$DEPLOY_HOST" "
    cd '$REMOTE_DIR'
    docker compose down 2>/dev/null || true
    docker compose up -d
"

# Step 5: Run seed if first deployment (database doesn't exist yet)
echo -e "${GREEN}Step 5: Checking database...${NC}"
ssh "$DEPLOY_HOST" "
    # Wait for container to start
    sleep 3
    # Check if database has data
    VOLUME_PATH=\$(docker volume inspect bosarsalog_bosarsalog-data --format '{{.Mountpoint}}' 2>/dev/null || echo '')
    if [ -n \"\$VOLUME_PATH\" ] && [ ! -f \"\$VOLUME_PATH/bosarsalog.db\" ]; then
        echo 'First deployment — seeding database...'
        docker exec $CONTAINER_NAME node -e \"
            import('./dist/server/db/database.js').then(m => {
                const db = m.initDb();
                import('./dist/server/db/schema.js').then(s => {
                    s.runMigrations(db);
                    console.log('Schema created');
                    db.close();
                });
            });
        \" 2>/dev/null || true
    fi
"

# Step 6: Verify deployment
echo -e "${GREEN}Step 6: Verifying deployment...${NC}"
sleep 3

# Check container status
CONTAINER_STATUS=$(ssh "$DEPLOY_HOST" "docker ps --filter 'name=$CONTAINER_NAME' --format '{{.Status}}'")
echo "Container status: $CONTAINER_STATUS"

# Check local port
LOCAL_PORT=$(echo $CONTAINER_PORT | cut -d: -f1)
if ssh "$DEPLOY_HOST" "curl -sf -o /dev/null http://localhost:$LOCAL_PORT/api/v1/auth/login"; then
    echo -e "${GREEN}✓ Container is running on port $LOCAL_PORT${NC}"
else
    echo -e "${YELLOW}⚠ Container not yet responding on port $LOCAL_PORT — may still be starting${NC}"
fi

# Check public URL
if curl -sf -o /dev/null "$SITE_URL" 2>/dev/null; then
    echo -e "${GREEN}✓ Site is accessible at $SITE_URL${NC}"
else
    echo -e "${YELLOW}⚠ Public URL not yet accessible — configure Cloudflare tunnel for bosarsalog.oeradio.at${NC}"
fi

echo ""
echo -e "${GREEN}=== Deployment complete ===${NC}"
echo ""
echo "Next steps if Cloudflare not configured:"
echo "  1. Go to Cloudflare Zero Trust dashboard"
echo "  2. Add public hostname bosarsalog.oeradio.at to the host-node-01 tunnel"
echo "  3. Point to http://bosarsalog:3000 (container name via cloudflared-tunnel network)"
