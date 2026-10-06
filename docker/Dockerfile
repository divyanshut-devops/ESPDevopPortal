FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    TERM=xterm-256color \
    NODE_VERSION=v20.18.2

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    apt-transport-https \
    bash \
    bash-completion \
    ca-certificates \
    curl \
    dnsutils \
    file \
    git \
    gnupg \
    iproute2 \
    iputils-ping \
    jq \
    less \
    lsof \
    nano \
    net-tools \
    openssh-client \
    procps \
    python3 \
    python3-pip \
    rsync \
    sudo \
    tar \
    tree \
    unzip \
    vim \
    wget \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

RUN ARCH="$(dpkg --print-architecture)" \
  && if [ "$ARCH" = "amd64" ]; then NODE_ARCH=x64; else NODE_ARCH=arm64; fi \
  && curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
    | tar -xJ -C /usr/local --strip-components=1 \
  && node -v && npm -v

RUN ARCH="$(dpkg --print-architecture)" \
  && if [ "$ARCH" = "amd64" ]; then AWS_ARCH=x86_64; else AWS_ARCH=aarch64; fi \
  && curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip" -o /tmp/awscliv2.zip \
  && unzip -q /tmp/awscliv2.zip -d /tmp \
  && /tmp/aws/install \
  && rm -rf /tmp/aws /tmp/awscliv2.zip \
  && aws --version

RUN curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
    | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
    > /etc/apt/sources.list.d/google-cloud-sdk.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-cloud-cli \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /workspace /root \
  && printf '%s\n' \
    'source /etc/bash_completion' \
    "export PS1='\[\e[32m\]root@esp-shell\[\e[0m\]:\[\e[34m\]\w\[\e[0m\]# '" \
    'alias ll="ls -alF"' \
    'alias la="ls -A"' \
    'export PATH="/usr/local/bin:$PATH"' \
    'stty erase ^? echoe 2>/dev/null || true' \
    'alias rm="rm -I --preserve-root"' \
    'echo "ESP Ubuntu 22.04  |  node npm aws gcloud vim git curl"' \
    > /root/.bashrc

COPY esp-pty.py /usr/local/bin/esp-pty
RUN sed -i 's/\r$//' /usr/local/bin/esp-pty && chmod +x /usr/local/bin/esp-pty

WORKDIR /workspace
CMD ["sleep", "infinity"]
