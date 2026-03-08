import asyncio
import json
import warnings
from typing import AsyncGenerator

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI

from card_sort_api.models import CardSortResult

warnings.filterwarnings("ignore", message="Pydantic serializer warnings")

NUM_AGENTS = 20

PERSONAS = [
    "a 28-year-old software developer who thinks in terms of technical architecture",
    "a 45-year-old marketing manager who groups things by business function",
    "a 62-year-old retired teacher who organizes by familiarity and simplicity",
    "a 19-year-old college student who is a digital native and thinks about mobile-first experiences",
    "a 35-year-old UX designer who groups by user journey stages",
    "a 50-year-old small business owner focused on practical daily tasks",
    "a 23-year-old graphic designer who thinks visually and spatially",
    "a 40-year-old project manager who organizes by workflow and priority",
    "a 55-year-old accountant who thinks in terms of categories and hierarchies",
    "a 30-year-old freelance writer who groups by content and purpose",
    "a 38-year-old data scientist who looks for logical patterns and clusters",
    "a 26-year-old social media manager who thinks about engagement and visibility",
    "a 48-year-old healthcare administrator who values clarity and compliance",
    "a 22-year-old e-commerce shopper who thinks about the buying journey",
    "a 60-year-old librarian who organizes by taxonomy and classification systems",
    "a 33-year-old product manager who groups by feature area and user needs",
    "a 42-year-old sales representative who thinks about customer-facing interactions",
    "a 27-year-old mobile app developer who groups by screen and navigation flow",
    "a 52-year-old HR director who organizes by organizational function",
    "a 21-year-old psychology student who thinks about cognitive load and mental models",
]


def build_system_prompt(agent_id: int) -> str:
    persona = PERSONAS[agent_id % len(PERSONAS)]
    return (
        f"You are participant #{agent_id + 1} in a card sorting study. "
        f"You are {persona}.\n\n"
        "You will be given a set of labels (like navigation items, features, or content topics). "
        "Your task is to sort ALL of the labels into groups that make logical sense to you.\n\n"
        "Rules:\n"
        "- Create as many or as few groups as you think are appropriate\n"
        "- Give each group a short, descriptive name\n"
        "- Every label must be placed in exactly one group — do not leave any out\n"
        "- Do not rename or modify the labels — use them exactly as provided\n"
        "- Group them based on how YOU would naturally organize them\n"
    )


async def run_agent(agent_id: int, labels: list[str], llm) -> dict:
    """Run a single card sort agent and return its result as a dict."""
    structured_llm = llm.with_structured_output(CardSortResult, method="json_schema")

    system_msg = SystemMessage(content=build_system_prompt(agent_id))
    human_msg = HumanMessage(content=f"Please sort these labels into groups:\n\n{json.dumps(labels)}")

    result: CardSortResult = await structured_llm.ainvoke([system_msg, human_msg])

    return {
        "agent_id": agent_id + 1,
        "persona": PERSONAS[agent_id % len(PERSONAS)],
        "bins": [bin.model_dump() for bin in result.bins],
    }


async def run_agents_streaming(labels: list[str]) -> AsyncGenerator[dict, None]:
    """Launch all agents and yield each result as it completes."""
    llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0.7)

    tasks = {
        asyncio.ensure_future(run_agent(i, labels, llm)): i
        for i in range(NUM_AGENTS)
    }

    completed = 0
    for coro in asyncio.as_completed(tasks):
        try:
            result = await coro
            completed += 1
            yield {
                "type": "progress",
                "data": {
                    "agent_id": result["agent_id"],
                    "completed": completed,
                    "total": NUM_AGENTS,
                },
                "result": result,
            }
        except Exception as e:
            completed += 1
            yield {
                "type": "error",
                "data": {
                    "message": str(e),
                    "completed": completed,
                    "total": NUM_AGENTS,
                },
                "result": None,
            }
