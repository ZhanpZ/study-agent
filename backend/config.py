import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./study.db")

# GPT-5 for Professor (best teaching quality) and Tester (strong reasoning)
# GPT-5-mini for Student (probing questions, cost-efficient)
MODEL_STRONG = "gpt-5"
MODEL_PROFESSOR = "gpt-5"
MODEL_FAST = "gpt-5-mini"
