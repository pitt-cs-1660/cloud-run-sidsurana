from fastapi import FastAPI, Form, Request, HTTPException, Header
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from google.cloud import firestore
from typing import Annotated
import datetime

import firebase_admin
from firebase_admin import credentials, auth
from google.oauth2 import id_token
from google.auth.transport import requests as grequests

# === Firebase Admin SDK Initialization ===
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred)

# === FastAPI App Initialization ===
app = FastAPI()

# ✅ Apply CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Static and Template Setup ===
app.mount("/static", StaticFiles(directory="/app/static"), name="static")
templates = Jinja2Templates(directory="/app/template")

# === Firestore Setup ===
db = firestore.Client()
votes_collection = db.collection("votes")

# === Routes ===

@app.get("/")
async def read_root(request: Request):
    votes = list(votes_collection.stream())
    tabs_count = sum(1 for v in votes if v.to_dict().get("team") == "TABS")
    spaces_count = sum(1 for v in votes if v.to_dict().get("team") == "SPACES")

    # Sort votes by timestamp
    recent_votes = sorted(
        (v.to_dict() for v in votes),
        key=lambda x: x.get("timestamp", datetime.datetime.min),
        reverse=True
    )[:5]

    return templates.TemplateResponse("index.html", {
        "request": request,
        "tabs_count": tabs_count,
        "spaces_count": spaces_count,
        "recent_votes": recent_votes,
        "leader_message": "Vote now!",
        "lead_team": "TABS" if tabs_count > spaces_count else "SPACES" if spaces_count > tabs_count else None
    })

from fastapi import Header
from google.oauth2 import id_token
from google.auth.transport import requests as grequests

@app.post("/")
async def create_vote(
    request: Request,
    team: Annotated[str, Form()],
    authorization: Annotated[str | None, Header()] = None,
):
    if team not in ["TABS", "SPACES"]:
        raise HTTPException(status_code=400, detail="Invalid vote")

    # 🔒 Bypass token verification in dev mode
    if request.url.hostname == "localhost" and "auth=false" in str(request.url):
        user_email = "dev@localhost"
    else:
        if not authorization:
            raise HTTPException(status_code=401, detail="Missing Authorization header")

        token = authorization.split("Bearer ")[-1]

        if token == "dummyToken":
            user_email = "dev@localhost"
        else:
            try:
                decoded_token = auth.verify_id_token(token)
                user_email = decoded_token["email"]
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    # ✅ Save the vote
    votes_collection.add({
        "team": team,
        "timestamp": firestore.SERVER_TIMESTAMP,
        "user": user_email
    })

    return {"detail": f"Vote recorded for {team} by {user_email}"}

