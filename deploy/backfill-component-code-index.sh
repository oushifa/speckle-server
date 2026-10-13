#!/usr/bin/env bash
#
# 构件编码索引（component_code_index）回填 —— 在部署机、compose 目录旁执行。
#
# 它做的事就是：
#   docker compose run --rm -T --entrypoint sh <service> -lc \
#     'cd /speckle-server/packages/server && yarn tsx --import ./esmLoader.js \
#        ./scripts/rebuildComponentCodeIndex.ts <参数>'
#
# 也就是用**一次性容器**跑回填，绕开镜像启动脚本（不会重跑迁移、不会起服务），
# 但完整继承 service 的环境变量与网络，因此多 region 时也会遍历到各地域库。
#
# 用法：
#   ./deploy/backfill-component-code-index.sh --dry-run            # 只统计，不写库
#   ./deploy/backfill-component-code-index.sh --projectId=abc123   # 单项目试点
#   ./deploy/backfill-component-code-index.sh -f                   # 前台全量
#   ./deploy/backfill-component-code-index.sh                      # 后台全量 + 日志
#   ./deploy/backfill-component-code-index.sh --limit=200          # 分批，可反复重跑续上
#   ./deploy/backfill-component-code-index.sh --force              # 连已新鲜的切片也重建
#
# 可用环境变量：
#   COMPOSE_DIR    compose 目录（默认：本脚本所在目录的上一级）
#   COMPOSE_FILE   指定 compose 文件（默认：docker compose 自己找）
#   SERVICE        服务名（默认：speckle-server）
#   LOG_DIR        后台日志目录（默认：$HOME）
#   FOREGROUND=1   等价于 -f
#   COMPOSE_BIN    compose 命令（默认 `docker compose`；老版本用 COMPOSE_BIN=docker-compose）
#   SCRIPT_FILE    用宿主机上的脚本文件覆盖镜像内的 rebuildComponentCodeIndex.ts
#   MOUNTS         额外的挂载覆盖，逗号分隔的 host:target 列表（改造后的重建逻辑
#                  在 services/componentCodeIndex.ts，需要一起挂）
#
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-}"
COMPOSE_BIN="${COMPOSE_BIN:-docker compose}"
SERVICE="${SERVICE:-speckle-server}"
LOG_DIR="${LOG_DIR:-$HOME}"
FOREGROUND="${FOREGROUND:-0}"
SCRIPT_FILE="${SCRIPT_FILE:-}"
MOUNTS="${MOUNTS:-}"
SCRIPT_TARGET="/speckle-server/packages/server/scripts/rebuildComponentCodeIndex.ts"

usage() {
  sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

SCRIPT_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --dry-run|--force)
      SCRIPT_ARGS+=("$1")
      shift
      ;;
    -f|--foreground)
      FOREGROUND=1
      shift
      ;;
    --limit|--sleep-ms|--projectId|--project-id|--modelId|--model-id)
      [[ $# -ge 2 ]] || {
        echo "参数 $1 缺少取值" >&2
        exit 1
      }
      SCRIPT_ARGS+=("$1=$2")
      shift 2
      ;;
    --limit=*|--sleep-ms=*|--projectId=*|--project-id=*|--modelId=*|--model-id=*)
      SCRIPT_ARGS+=("$1")
      shift
      ;;
    *)
      echo "未知参数: $1（用 --help 看用法）" >&2
      exit 1
      ;;
  esac
done

# 这些参数会被拼进 `sh -lc` 的字符串里，先挡掉可疑字符
for arg in ${SCRIPT_ARGS[@]+"${SCRIPT_ARGS[@]}"}; do
  case "$arg" in
    *[!A-Za-z0-9_=.-]*)
      echo "参数含非法字符: $arg" >&2
      exit 1
      ;;
  esac
done

COMPOSE=($COMPOSE_BIN)
if [[ -n "$COMPOSE_FILE" ]]; then
  COMPOSE+=(-f "$COMPOSE_FILE")
fi

RUN_ARGS=()
if [[ -n "$SCRIPT_FILE" ]]; then
  [[ -f "$SCRIPT_FILE" ]] || {
    echo "SCRIPT_FILE 不存在: $SCRIPT_FILE" >&2
    exit 1
  }
  RUN_ARGS+=(-v "$SCRIPT_FILE:$SCRIPT_TARGET:ro")
fi

# 额外的挂载覆盖，逗号分隔的 host:target 列表。
# 改造后的重建逻辑同时在 services/componentCodeIndex.ts 里，要一起挂：
#   MOUNTS=/root/ci/componentCodeIndex.ts:/speckle-server/packages/server/modules/progress/services/componentCodeIndex.ts
if [[ -n "$MOUNTS" ]]; then
  IFS=',' read -r -a _mount_list <<<"$MOUNTS"
  for _mount in "${_mount_list[@]}"; do
    [[ -n "$_mount" ]] || continue
    if [[ "$_mount" != *:* ]]; then
      echo "MOUNTS 项格式应为 host:target，实际: $_mount" >&2
      exit 1
    fi
    RUN_ARGS+=(-v "$_mount:ro")
  done
fi

INNER="cd /speckle-server/packages/server && yarn tsx --import ./esmLoader.js ./scripts/rebuildComponentCodeIndex.ts"
if (( ${#SCRIPT_ARGS[@]} > 0 )); then
  INNER="$INNER ${SCRIPT_ARGS[*]}"
fi

echo "compose 目录 : $COMPOSE_DIR"
echo "服务         : $SERVICE"
[[ -n "$SCRIPT_FILE" ]] && echo "覆盖脚本     : $SCRIPT_FILE"
echo "执行命令     : $INNER"

cd "$COMPOSE_DIR"

# dry-run 默认前台跑（要看统计结果）
if [[ "$FOREGROUND" == "1" ]] || [[ " ${SCRIPT_ARGS[*]-} " == *" --dry-run "* ]]; then
  exec "${COMPOSE[@]}" run --rm -T ${RUN_ARGS[@]+"${RUN_ARGS[@]}"} --entrypoint sh "$SERVICE" -lc "$INNER"
fi

mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/ccindex-backfill-$(date +%Y%m%d-%H%M%S).log"
nohup "${COMPOSE[@]}" run --rm -T ${RUN_ARGS[@]+"${RUN_ARGS[@]}"} --entrypoint sh "$SERVICE" -lc "$INNER" >"$LOG" 2>&1 &
echo
echo "已在后台执行，PID=$!"
echo "日志：$LOG"
echo "跟进：tail -f \"$LOG\""
