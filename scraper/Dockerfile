# Use official Playwright Python image which includes all OS dependencies + browsers out of the box
FROM mcr.microsoft.com/playwright/python:v1.52.0-jammy

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
