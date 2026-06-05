import json

from fastapi import APIRouter, File, Form, UploadFile

from card_sort_api.services.analysis import compute_matrix, compute_clusters

router = APIRouter()


@router.post("/api/matrix")
async def matrix(
    file: UploadFile = File(...),
    linkage: str = Form(default="ward"),
):
    """Build the similarity matrix view (dendrogram + heatmap), independent of k."""
    content = await file.read()
    summary = json.loads(content)

    return compute_matrix(summary, linkage_method=linkage)


@router.post("/api/clusters")
async def clusters(
    file: UploadFile = File(...),
    k: int = Form(default=8),
    linkage: str = Form(default="ward"),
):
    """Extract flat clusters at a chosen k from the same HCA."""
    content = await file.read()
    summary = json.loads(content)

    return compute_clusters(summary, k=k, linkage_method=linkage)
