from fastapi import APIRouter, Request, BackgroundTasks
from typing import List, Dict, Any
from pydantic import BaseModel
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class MetricEvent(BaseModel):
    type: str
    video_id: Any
    timestamp: int
    duration_ms: float = None

class MetricsBatchRequest(BaseModel):
    events: List[MetricEvent]

@router.post("/batch")
async def batch_metrics(request: MetricsBatchRequest, background_tasks: BackgroundTasks):
    """
    Receive a batch of metrics from the frontend.
    For now, we just log them. In production, these should be flushed to 
    a specialized metrics store (e.g. ClickHouse, Prometheus, or Mixpanel).
    """
    # background_tasks.add_task(process_metrics, request.events)
    logger.info(f"Received {len(request.events)} metric events from client")
    return {"status": "ok", "received": len(request.events)}

async def process_metrics(events: List[MetricEvent]):
    # Future implementation: sync to analytics DB
    pass
