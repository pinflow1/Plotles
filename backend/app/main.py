from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import auth, ideas, liveblocks, projects

settings = get_settings()

app = FastAPI(title="Plotless API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(ideas.router)
app.include_router(liveblocks.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
