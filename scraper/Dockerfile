# Use official Playwright Python image which includes all OS dependencies + browsers out of the box
FROM mcr.microsoft.com/playwright/python:v1.52.0-jammy

WORKDIR /app

# Install system deps for Scrapling and Crawl4AI
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2-dev libxslt1-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies (multi-layer cognitive loop scraping stack)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Crawl4AI browser dependencies (uses its own managed browser)
RUN python -c "import crawl4ai; print('crawl4ai imported')" 2>/dev/null || true

COPY . .

# Create non-root user for security
RUN adduser --disabled-password --gecos '' scraper && chown -R scraper:scraper /app
USER scraper

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
