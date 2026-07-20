FROM python:3.13-slim

# Prevent Python from writing pyc files and buffering stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860

WORKDIR /app

# Install system dependencies (build-essential, libpq-dev for Postgres, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first to leverage Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Make startup script executable
RUN chmod +x start.sh

# Hugging Face Spaces requires port 7860
EXPOSE 7860

# Celery (background) + gunicorn with 2–4 uvicorn workers (see start.sh)
CMD ["./start.sh"]
