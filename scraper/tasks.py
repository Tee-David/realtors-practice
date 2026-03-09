import asyncio
from celery import Celery
from config import config
from app import _run_scrape_job, ScrapeJobRequest

app = Celery(
    "scraper",
    broker=config.redis_url,
    backend=config.redis_url
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

@app.task(name="tasks.process_job", bind=True)
def process_job(self, payload: dict):
    # Payload matches ScrapeJobRequest schema
    request = ScrapeJobRequest(**payload)
    asyncio.run(_run_scrape_job(request))
