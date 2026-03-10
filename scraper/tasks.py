import asyncio
import time
from celery import Celery
from celery.exceptions import MaxRetriesExceededError
from config import config
from utils.logger import get_logger

logger = get_logger("tasks")

app = Celery(
    "scraper",
    broker=config.redis_url,
    backend=config.redis_url,
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Priority: lower number = higher priority (0-9)
    broker_transport_options={
        "priority_steps": list(range(10)),
        "sep": ":",
        "queue_order_strategy": "priority",
    },
)


def _acquire_domain_lock(domain: str) -> bool:
    """Acquire a per-domain Redis lock. Returns True if acquired."""
    import redis as redis_lib
    r = redis_lib.Redis.from_url(config.redis_url, decode_responses=True)
    # Lock expires after 30 minutes (safety valve)
    acquired = r.set(f"domain:lock:{domain}", "1", nx=True, ex=1800)
    return bool(acquired)


def _release_domain_lock(domain: str):
    """Release the per-domain Redis lock."""
    import redis as redis_lib
    r = redis_lib.Redis.from_url(config.redis_url, decode_responses=True)
    r.delete(f"domain:lock:{domain}")


@app.task(
    name="tasks.process_job",
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError, OSError),
    retry_backoff=30,       # Base: 30 seconds
    retry_backoff_max=480,  # Max: 8 minutes
    retry_jitter=True,
    max_retries=3,
)
def process_job(self, payload: dict):
    """Process a scrape job. Retries on transient network errors with exponential backoff."""
    from app import _run_scrape_job, ScrapeJobRequest

    request = ScrapeJobRequest(**payload)

    # Acquire domain locks for all sites in this job
    locked_domains = []
    for site in request.sites:
        domain = site.baseUrl.split("//")[-1].split("/")[0]
        if not _acquire_domain_lock(domain):
            logger.warning(f"Domain {domain} is locked by another task. Retrying in 60s...")
            raise self.retry(countdown=60, max_retries=5)
        locked_domains.append(domain)

    try:
        logger.info(f"Starting job {request.jobId} ({len(request.sites)} sites)")
        asyncio.run(_run_scrape_job(request))
        logger.info(f"Job {request.jobId} completed successfully")
    except (ConnectionError, TimeoutError, OSError) as exc:
        logger.error(f"Transient error in job {request.jobId}: {exc}")
        raise  # autoretry_for handles this
    except Exception as exc:
        logger.error(f"Permanent error in job {request.jobId}: {exc}")
        # Report error back to API — don't retry permanent failures
        from utils.callback import report_error
        asyncio.run(report_error(request.jobId, str(exc)))
    finally:
        # Always release domain locks
        for domain in locked_domains:
            _release_domain_lock(domain)
