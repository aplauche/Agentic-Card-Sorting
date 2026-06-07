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


class ClusterLabel(BaseModel):
    """A suggested name for one discovered cluster."""
    cluster_id: int = Field(description="The id of the cluster being named")
    name: str = Field(description="A short, descriptive category name (2-4 words) for this cluster")


class ClusterLabels(BaseModel):
    """LLM-suggested names for all discovered clusters."""
    labels: list[ClusterLabel] = Field(description="One name per cluster")


class LabelClustersRequest(BaseModel):
    clusters: list[ClusterInfo]
