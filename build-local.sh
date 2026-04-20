set -ex
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
COMMIT_HASH=$(git rev-parse --short HEAD)
tag=$BRANCH_NAME-$COMMIT_HASH-$(date "+%Y%m%d%H%M%S")

docker build -t speckle/speckle-server:$tag -f packages/server/Dockerfile .
docker build -t speckle/frontend-2:$tag -f packages/frontend-2/Dockerfile .


# 修改版本
DEPLOY_PATH="/root/deploy/speckle-server"
cd $DEPLOY_PATH
sed -i "/tag/c tag=$tag" .env

# 发版
docker-compose up -d
