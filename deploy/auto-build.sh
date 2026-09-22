#!/usr/bin/env bash
#
# 服务器侧自动编译 + 推送阿里云镜像仓库脚本
# ------------------------------------------------------------------
# 设计要点:
#   1. 只在远端分支有新提交时才构建(5 分钟轮询一次, 无新代码直接退出)
#   2. 复用本机 docker 层缓存 -> 编译快; 服务器在国内 -> 推送阿里云快
#   3. 镜像 tag 自动生成: <前缀>-<北京时间时间戳>, 同时更新 <前缀>-latest
#
# 必填环境变量:
#   REPO_DIR      仓库绝对路径     例: /root/deploy/compile/hc-server/speckle-server
#   IMAGE_REPO    阿里云仓库名     例: hc-speckle-server / speckle-server
#   ALIYUN_PASS   阿里云仓库密码   (不要写进仓库, 放在服务器上的 /root/deploy/.aliyun_pass)
#
# 可选环境变量:
#   BRANCH=main               监听的分支
#   REGISTRY=registry.cn-hangzhou.aliyuncs.com
#   NAMESPACE=lengyingxi
#   ALIYUN_USER=lengyingxi
#   SERVER_DOCKERFILE=packages/server/Dockerfile
#   FRONTEND_DOCKERFILE=packages/frontend-2/Dockerfile
#   BUILD_FRONTEND=0          是否编译前端
#   BUILD_IFC=0               是否编译 IFC 导入服务
#   PUSH_LATEST=1             是否额外推送 <前缀>-latest
#
set -eo pipefail

REPO_DIR="${REPO_DIR:?必须设置 REPO_DIR(仓库绝对路径)}"
IMAGE_REPO="${IMAGE_REPO:?必须设置 IMAGE_REPO(阿里云仓库名)}"
BRANCH="${BRANCH:-main}"
REGISTRY="${REGISTRY:-registry.cn-hangzhou.aliyuncs.com}"
NAMESPACE="${NAMESPACE:-lengyingxi}"
ALIYUN_USER="${ALIYUN_USER:-lengyingxi}"
SERVER_DOCKERFILE="${SERVER_DOCKERFILE:-packages/server/Dockerfile}"
FRONTEND_DOCKERFILE="${FRONTEND_DOCKERFILE:-packages/frontend-2/Dockerfile}"
BUILD_FRONTEND="${BUILD_FRONTEND:-0}"
BUILD_IFC="${BUILD_IFC:-0}"
PUSH_LATEST="${PUSH_LATEST:-1}"

# 密码来源优先级: 环境变量 > 服务器本地文件
if [ -z "$ALIYUN_PASS" ] && [ -f /root/deploy/.aliyun_pass ]; then
  ALIYUN_PASS="$(cat /root/deploy/.aliyun_pass)"
fi
if [ -z "$ALIYUN_PASS" ]; then
  echo "必须提供 ALIYUN_PASS(环境变量) 或创建 /root/deploy/.aliyun_pass"
  exit 1
fi

LOG_FILE="${LOG_FILE:-$(dirname "$REPO_DIR")/auto-build.log}"
exec > >(tee -a "$LOG_FILE") 2>&1

log() { echo "[$(TZ=Asia/Shanghai date '+%F %T')] $*"; }

# 单实例锁: 上一次没跑完就不重复启动
LOCK_FILE="/tmp/auto-build-$(echo "$REPO_DIR" | md5sum | cut -c1-8).lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "上一次构建仍在运行, 本次跳过"
  exit 0
fi

cd "$REPO_DIR"

log "检查远端 $BRANCH 是否有新提交"
if ! GIT_TERMINAL_PROMPT=0 timeout 120 git fetch --quiet origin "$BRANCH"; then
  log "git fetch 失败(网络问题?), 本次跳过"
  exit 1
fi

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  log "无新提交($LOCAL_SHA), 跳过"
  exit 0
fi

log "发现新提交: $LOCAL_SHA -> $REMOTE_SHA, 开始拉取代码"
git merge --ff-only --quiet "origin/$BRANCH" || {
  log "本地分支有分叉, 无法快进合并, 请手动处理: cd $REPO_DIR && git status"
  exit 1
}

TS="$(TZ=Asia/Shanghai date '+%Y%m%d%H%M%S')"
export DOCKER_BUILDKIT=1

build_and_push() {
  local prefix="$1" dockerfile="$2"
  local full="$REGISTRY/$NAMESPACE/$IMAGE_REPO"
  local tag="$full:$prefix-$TS"

  log "开始构建 $tag (Dockerfile: $dockerfile)"
  docker build -t "$tag" -f "$dockerfile" "$REPO_DIR"

  log "推送 $tag"
  docker push "$tag"

  if [ "$PUSH_LATEST" = "1" ]; then
    docker tag "$tag" "$full:$prefix-latest"
    docker push "$full:$prefix-latest"
    log "已更新 $full:$prefix-latest"
  fi
  log "$prefix 完成"
}

log "登录阿里云镜像仓库 $REGISTRY"
docker login -u "$ALIYUN_USER" -p "$ALIYUN_PASS" "$REGISTRY"

build_and_push server "$SERVER_DOCKERFILE"

if [ "$BUILD_FRONTEND" = "1" ]; then
  build_and_push frontend "$FRONTEND_DOCKERFILE"
fi

if [ "$BUILD_IFC" = "1" ]; then
  build_and_push ifc packages/ifc-import-service/Dockerfile
fi

log "全部完成, 本次版本号: $TS"
log "拉取示例: docker pull $REGISTRY/$NAMESPACE/$IMAGE_REPO:server-$TS"
