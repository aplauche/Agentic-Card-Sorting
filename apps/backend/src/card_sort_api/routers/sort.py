import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from card_sort_api.models import SortRequest
from card_sort_api.services.card_sort import run_agents_streaming, NUM_AGENTS

router = APIRouter()


@router.post("/api/sort")
async def sort_labels(request: SortRequest):
    """Run card sort with 20 synthetic agents, streaming progress via SSE."""

    async def event_stream():
        results = []
        async for event in run_agents_streaming(request.labels):
            if event["result"] is not None:
                results.append(event["result"])

            sse_data = json.dumps(event["data"])
            yield f"event: {event['type']}\ndata: {sse_data}\n\n"

        summary = {
            "total_agents": NUM_AGENTS,
            "labels_sorted": True,
            "results": sorted(results, key=lambda r: r["agent_id"]),
        }
        yield f"event: complete\ndata: {json.dumps(summary)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
