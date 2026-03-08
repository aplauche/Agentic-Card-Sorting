import json

from fastapi import APIRouter, File, Form, UploadFile

from card_sort_api.services.analysis import analyze

router = APIRouter()


@router.post("/api/analyze")
async def analyze_results(
    file: UploadFile = File(...),
    k: int = Form(default=8),
    linkage: str = Form(default="ward"),
):
    """Analyze card sort results: similarity matrix, HCA, clustering."""
    content = await file.read()
    summary = json.loads(content)

    result = analyze(summary, k=k, linkage_method=linkage)

    return result
