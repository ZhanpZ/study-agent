import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./study.db")

# ─── Model Configuration ─────────────────────────────────────────
# GPT-4o for Professor (teaching quality) and Tester (evaluation reasoning)
# GPT-4o-mini for Student, quiz generation, comprehension MCQs (cost-efficient)
MODEL_STRONG = "gpt-4o"
MODEL_PROFESSOR = "gpt-4o"
MODEL_FAST = "gpt-4o-mini"

# ─── Tuning Thresholds ───────────────────────────────────────────
CONCEPT_SIMILARITY_THRESHOLD = 0.7  # fuzzy match threshold for deduplication
MAX_TEACH_ROUNDS = 5                # max teach rounds before forcing evaluation
SM2_DEFAULT_EASINESS = 2.5          # SM-2 initial easiness factor
MASTERY_SCORE_THRESHOLD = 80        # score needed to mark concept as mastered
QUIZ_HISTORY_DEFAULT_LIMIT = 50     # default page size for quiz history
QUIZ_HISTORY_MAX_LIMIT = 500        # max page size for quiz history
