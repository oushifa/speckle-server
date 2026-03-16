set -e

# 必须 --no-cache 重建，否则 Docker 会用旧层，安装的 ifc_importer 包会缺少 process_job.py
docker build --no-cache -f packages/ifc-import-service/Dockerfile -t speckle/speckle-ifc-import-service:latest .

docker rm -f speckle-server-ifc-import-server-1 || true
docker-compose up -d
