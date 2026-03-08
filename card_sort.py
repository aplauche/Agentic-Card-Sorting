import argparse
import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

load_dotenv()

NUM_AGENTS = 20

# --- Structured output models ---

class CardBin(BaseModel):
    """A named group/category containing sorted labels."""
    name: str = Field(description="A short, descriptive name for this group")
    labels: list[str] = Field(description="The labels assigned to this group")


class CardSortResult(BaseModel):
    """The complete result of one participant's open card sort."""
    bins: list[CardBin] = Field(description="The groups created by the participant")


# --- Persona generation ---

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


# --- Agent execution ---

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


async def run_all_agents(labels: list[str]) -> list[dict]:
    """Launch all agents concurrently and collect results."""
    llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0.7)

    tasks = [run_agent(i, labels, llm) for i in range(NUM_AGENTS)]
    results = await asyncio.gather(*tasks)

    return list(results)


# --- Output ---

def save_results(results: list[dict], output_dir: Path) -> None:
    """Save individual agent results and a combined summary."""
    output_dir.mkdir(parents=True, exist_ok=True)

    for result in results:
        agent_file = output_dir / f"agent_{result['agent_id']:02d}.json"
        agent_file.write_text(json.dumps(result, indent=2))

    summary = {
        "total_agents": len(results),
        "labels_sorted": results[0]["bins"] and True,
        "results": results,
    }
    summary_file = output_dir / "summary.json"
    summary_file.write_text(json.dumps(summary, indent=2))

    print(f"Results saved to {output_dir}/")
    print(f"  - {len(results)} individual agent files (agent_01.json - agent_{len(results):02d}.json)")
    print(f"  - 1 summary file (summary.json)")


# --- CLI ---

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run an open card sort with synthetic users (LLM agents)."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--labels",
        nargs="+",
        help='Labels to sort, e.g. --labels "Home" "About" "Contact"',
    )
    group.add_argument(
        "--file",
        type=str,
        help="Path to a JSON file containing an array of label strings",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="output",
        help="Output directory (default: output)",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if args.file:
        file_path = Path(args.file)
        labels = json.loads(file_path.read_text())
        if not isinstance(labels, list) or not all(isinstance(l, str) for l in labels):
            raise ValueError("JSON file must contain an array of strings")
    else:
        labels = args.labels

    print(f"Running open card sort with {NUM_AGENTS} synthetic participants...")
    print(f"Labels ({len(labels)}): {labels}\n")

    results = asyncio.run(run_all_agents(labels))

    output_dir = Path(args.output)
    save_results(results, output_dir)


if __name__ == "__main__":
    main()
