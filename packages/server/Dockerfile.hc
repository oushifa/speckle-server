# syntax=docker/dockerfile:1
ARG NODE_ENV=production

############################
# BUILD STAGE
############################
FROM node:22-bookworm AS build-stage

# 【修复警告】：在 FROM 之后重新声明 ARG，才能被后面的 ENV 读取
ARG NODE_ENV

WORKDIR /speckle-server

# 替换阿里源加速国内构建
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources || true

# 1. 系统依赖层：使用 cache 挂载缓存 apt 依赖 (直接用 apt 安装 tini，防止 GitHub 下载卡死)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update -y && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    build-essential \
    python3 \
    pkg-config \
    libvips-dev \
    openjdk-17-jdk-headless \
    tini \
    && rm -rf /var/lib/apt/lists/*

# 3. Yarn 4 准备
RUN corepack enable && corepack prepare yarn@4.5.0 --activate

# 4. 构建环境变量：限制 Node.js 内存上限为 3.5GB，防止 Swap 卡顿
ENV NODE_ENV=${NODE_ENV} \
    NODE_OPTIONS="--max-old-space-size=3584" \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    YARN_NPM_REGISTRY_SERVER="https://registry.npmmirror.com" \
    npm_config_registry="https://registry.npmmirror.com" \
    npm_config_disturl="https://npmmirror.com/mirrors/node" \
    npm_config_sharp_binary_host="https://npmmirror.com/mirrors/sharp" \
    npm_config_sharp_libvips_binary_host="https://npmmirror.com/mirrors/sharp-libvips" \
    SHARP_DIST_BASE_URL="https://npmmirror.com/mirrors/sharp-libvips/"

# 5. 依赖配置层
COPY .yarnrc.yml ./
COPY .yarn ./.yarn
COPY package.json yarn.lock ./

COPY packages/frontend-2/type-augmentations/stubs \
    ./packages/frontend-2/type-augmentations/stubs/

COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/objectloader/package.json ./packages/objectloader/

# 剔除 @apollo/rover 避免国内网络下载二进制卡死
RUN node -e "const fs=require('fs');const p='packages/server/package.json';const pkg=JSON.parse(fs.readFileSync(p,'utf8'));if(pkg.devDependencies)delete pkg.devDependencies['@apollo/rover'];fs.writeFileSync(p,JSON.stringify(pkg,null,2)+'\n')"

# 6. 安装依赖：使用 cache 挂载 Yarn 缓存目录
RUN --mount=type=cache,target=/speckle-server/.yarn/cache \
    --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install

# 7. 拷贝业务代码
COPY packages/server ./packages/server/
COPY packages/shared ./packages/shared/
COPY packages/objectloader ./packages/objectloader/

# 8. 执行构建：【修正】取消并行，恢复稳妥的串行构建，依赖挂载缓存和内存限制提速
RUN --mount=type=cache,target=/speckle-server/node_modules/.cache \
    --mount=type=cache,target=/speckle-server/packages/server/node_modules/.cache \
    --mount=type=cache,target=/speckle-server/packages/shared/node_modules/.cache \
    --mount=type=cache,target=/speckle-server/packages/objectloader/node_modules/.cache \
    yarn workspaces foreach -W run build

# 9. 构建环境验证
RUN java -version && javac -version && node -v && yarn -v


############################
# PRODUCTION STAGE
############################
FROM node:22-bookworm-slim AS production-stage

WORKDIR /speckle-server

RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources || true

# 1. 生产运行依赖 (包含 tini)
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update -y && apt-get install -y --no-install-recommends \
    libvips \
    ca-certificates \
    openjdk-17-jdk-headless \
    tini \
    && rm -rf /var/lib/apt/lists/*

# 3. Yarn 4
RUN corepack enable && corepack prepare yarn@4.5.0 --activate

# 4. 复制完整 workspace (直接保留全部依赖，和海外机器策略完全一致)
COPY --from=build-stage /speckle-server /speckle-server

WORKDIR /speckle-server/packages/server

ARG SPECKLE_SERVER_VERSION=custom
ARG NODE_ENV

# 5. 生产环境变量
ENV NODE_ENV=${NODE_ENV} \
    SPECKLE_SERVER_VERSION=${SPECKLE_SERVER_VERSION} \
    FF_RHINO_FILE_IMPORTER_ENABLED=true

# 6. 生产环境验证
RUN java -version && javac -version

ENTRYPOINT ["tini", "--", "sh", "-lc", "yarn cli db migrate latest && node --import=./esmLoader.js ./bin/www"]
