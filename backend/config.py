import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./study.db")

# GPT-4o for Professor (teaching quality) and Tester (reasoning)
# GPT-4o-mini for Student (probing questions, cost-efficient)
MODEL_STRONG = "gpt-4o"
MODEL_PROFESSOR = "gpt-4o"
MODEL_FAST = "gpt-4o-mini"
