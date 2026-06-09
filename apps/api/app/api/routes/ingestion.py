from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.ingestion import IngestBatchRequest, IngestBatchResponse, IngestEventResponse
from app.services.ingest_pipeline import process_ingest_event

router = APIRouter()


@router.post("/ingest/events/batch", response_model=IngestBatchResponse)
async def ingest_events_batch(
    body: IngestBatchRequest,
    db: Session = Depends(get_db),
) -> IngestBatchResponse:
    accepted = 0
    duplicates = 0
    failures: list[dict[str, Any]] = []
    for idx, payload in enumerate(body.events):
        try:
            result = await process_ingest_event(db, payload)
            if result.duplicate:
                duplicates += 1
            else:
                accepted += 1
        except ValueError as exc:
            failures.append({"index": idx, "error": str(exc)})
    return IngestBatchResponse(accepted=accepted, duplicates=duplicates, failures=failures)


@router.post("/ingest/events", response_model=IngestEventResponse)
async def ingest_events(payload: dict[str, Any], db: Session = Depends(get_db)) -> IngestEventResponse:
    try:
        return await process_ingest_event(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
