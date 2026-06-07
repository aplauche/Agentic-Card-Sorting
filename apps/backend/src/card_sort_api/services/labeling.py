import json
import warnings

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI

from card_sort_api.models import ClusterLabels

warnings.filterwarnings("ignore", message="Pydantic serializer warnings")

SYSTEM_PROMPT = (
    "You are an information architect reviewing the output of an open card sort. "
    "You are given the discovered clusters, each a group of related labels. "
    "Propose a short, descriptive category name (2-4 words) for each cluster that "
    "captures the common theme of its labels.\n\n"
    "Rules:\n"
    "- Return exactly one name per cluster, keyed by its cluster_id\n"
    "- Names should be concise, human-readable category titles — not sentences\n"
    "- Base the name only on the labels in that cluster"
)


async def suggest_cluster_names(clusters: list[dict]) -> list[dict]:
    """Call the LLM once to suggest a name for each discovered cluster."""
    llm = ChatOpenAI(model="gpt-5.4", temperature=0.3)
    structured_llm = llm.with_structured_output(ClusterLabels, method="json_schema")

    payload = [
        {"cluster_id": c["cluster_id"], "labels": c["labels"]}
        for c in clusters
    ]

    system_msg = SystemMessage(content=SYSTEM_PROMPT)
    human_msg = HumanMessage(
        content=f"Name each of these clusters:\n\n{json.dumps(payload)}"
    )

    result: ClusterLabels = await structured_llm.ainvoke([system_msg, human_msg])

    return [label.model_dump() for label in result.labels]
