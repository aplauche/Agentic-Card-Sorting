from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from card_sort_api.routers import sort, analyze


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load .env from project root (two levels up from apps/backend/)
    env_path = Path(__file__).resolve().parents[4] / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        load_dotenv()
    yield


app = FastAPI(
    title="Card Sort API",
    description="Run open card sorts with synthetic LLM agents and analyze results.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4321"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sort.router)
app.include_router(analyze.router)
