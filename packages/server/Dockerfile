ARG NODE_ENV=production

############################
# BUILD STAGE
############################
FROM node:22-bookworm AS build-stage

WORKDIR /speckle-server

# 基础依赖（包含 sharp 编译依赖 + OpenJDK17 JDK）
RUN apt-get update -y && apt-get install -y \
    ca-certificates \
    curl \
    git \
    build-essential \
    python3 \
    pkg-config \
    libvips-dev \
    openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

# tini
ARG TINI_VERSION=v0.19.0
RUN curl -fsSL https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini \
    -o /usr/bin/tini \
    && chmod +x /usr/bin/tini

# Yarn 4
RUN corepack enable && corepack prepare yarn@4.5.0 --activate

# 环境变量
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# ===== 依赖层 =====
COPY .yarnrc.yml ./
COPY .yarn ./.yarn
COPY package.json yarn.lock ./

COPY packages/frontend-2/type-augmentations/stubs \
    ./packages/frontend-2/type-augmentations/stubs/

COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/objectloader/package.json ./packages/objectloader/

# 安装依赖
RUN yarn install

# ===== build =====
COPY packages/server ./packages/server/
COPY packages/shared ./packages/shared/
COPY packages/objectloader ./packages/objectloader/

RUN yarn workspaces foreach -A --include '{@speckle/shared,@speckle/objectloader,@speckle/server}' --parallel --topological run build

# 验证（确认 javac 存在）
RUN java -version && javac -version && node -v && yarn -v


############################
# PRODUCTION STAGE
############################
FROM node:22-bookworm-slim AS production-stage

WORKDIR /speckle-server

# 运行依赖（sharp runtime + Java JDK）
RUN apt-get update -y && apt-get install -y \
    libvips \
    ca-certificates \
    openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

# tini
COPY --from=build-stage /usr/bin/tini /usr/bin/tini

# Yarn 4（运行时需要）
RUN corepack enable && corepack prepare yarn@4.5.0 --activate

# 复制完整 workspace
COPY --from=build-stage /speckle-server /speckle-server

WORKDIR /speckle-server/packages/server

ARG SPECKLE_SERVER_VERSION=custom
ARG NODE_ENV

ENV NODE_ENV=${NODE_ENV} \
    SPECKLE_SERVER_VERSION=${SPECKLE_SERVER_VERSION} \
    FF_RHINO_FILE_IMPORTER_ENABLED=true

# 验证（确保 runtime 也有 javac）
RUN java -version && javac -version

ENTRYPOINT ["tini", "--", "sh", "-lc", "yarn cli db migrate latest && node --import=./esmLoader.js ./bin/www"]