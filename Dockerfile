# Nautilus D-NAS Dockerfile
# Optimized for UGREEN AI NAS (UGOS Pro / Debian Linux Kernel)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install system utilities needed for NAS volume auditing
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    findutils \
    coreutils \
    tar \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY . /app

# Ensure directories exist
RUN mkdir -p /volume1/nautilus_missions/incoming /volume1/nautilus_missions/reconstructed

EXPOSE 8000

CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"]
