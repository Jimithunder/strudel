FROM mcr.microsoft.com/devcontainers/base:bookworm

ARG NODE_VERSION=24
ARG PNPM_VERSION=9.15.2
ARG RUST_TOOLCHAIN=stable

ENV DEBIAN_FRONTEND=noninteractive
ENV RUSTUP_HOME=/usr/local/rustup
ENV CARGO_HOME=/usr/local/cargo
ENV PATH=/usr/local/cargo/bin:$PATH

RUN apt-get update \
    && apt-get install -y \
       curl \
       build-essential \
       git \
       pkg-config \
       libwebkit2gtk-4.1-dev \
       libgtk-3-dev \
       libayatana-appindicator3-dev \
       librsvg2-dev \
       patchelf \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y nodejs \
    && corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate \
    && curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal --default-toolchain ${RUST_TOOLCHAIN} --component rustfmt,clippy \
    && rustup default ${RUST_TOOLCHAIN} \
    && rustup component add rustfmt clippy \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN chown -R vscode:vscode ${RUSTUP_HOME} ${CARGO_HOME}

USER vscode

RUN pnpm --version \
    && rustc --version \
    && cargo --version

USER root
