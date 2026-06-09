from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.services.event_stream import sse_stream

router = APIRouter()


@router.get("/events/stream")
async def events_stream(request: Request) -> StreamingResponse:
    return StreamingResponse(sse_stream(request), media_type="text/event-stream")
