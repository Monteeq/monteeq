# --- Build Stage ---
FROM rust:1-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Cargo files first to cache dependencies
COPY Cargo.toml Cargo.lock ./

# Create a dummy src/main.rs to build dependencies and cache them
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy the actual source code
COPY src ./src

# Build the real binary (update the timestamp on main.rs to force rebuild)
RUN touch src/main.rs && cargo build --release

# --- Runner Stage ---
FROM debian:bookworm-slim

# Install runtime dependencies (FFmpeg, FFprobe, OpenSSL, CA-Certificates)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for Hugging Face Spaces (runs as user 1000)
RUN useradd -m -u 1000 appuser
WORKDIR /app

# Copy the compiled binary from builder
COPY --from=builder /app/target/release/monteeq-video-service /app/monteeq-video-service

# Ensure appuser owns the working directory for temp file writes if needed
RUN chown -R appuser:appuser /app

USER appuser

# Set environment variables
ENV PORT=7860
ENV RUST_LOG=info

# Expose port (HF Spaces defaults to 7860 or app_port metadata)
EXPOSE 7860

# Run the video service
CMD ["/app/monteeq-video-service"]
