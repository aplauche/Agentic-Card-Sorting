from pydantic import BaseModel, Field


class CardBin(BaseModel):
    """A named group/category containing sorted labels."""
    name: str = Field(description="A short, descriptive name for this group")
    labels: list[str] = Field(description="The labels assigned to this group")


class CardSortResult(BaseModel):
    """The complete result of one participant's open card sort."""
    bins: list[CardBin] = Field(description="The groups created by the participant")


class SortRequest(BaseModel):
    labels: list[str]


class ClusterInfo(BaseModel):
    cluster_id: int
    labels: list[str]
    size: int


class AnalyzeResponse(BaseModel):
    dendrogram: dict
    heatmap: dict
    clusters: list[ClusterInfo]
