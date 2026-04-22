import os
from dotenv import load_dotenv
from crewai import LLM

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./study.db")

# ─── Model Configuration ─────────────────────────────────────────
# String aliases (used by professor, student, tester agents)
MODEL_STRONG = "gpt-4o"            # evaluations, MCQ generation (accuracy-critical)
MODEL_PROFESSOR = "gpt-4o-mini"    # explanations & follow-ups (cost-optimized, quality sufficient)
MODEL_FAST = "gpt-4o-mini"         # student agent, simple tasks

# LLM objects with explicit temperature (used by quiz generation)
LLM_QUIZ = LLM(model="gpt-4o", temperature=0.3)           # algorithm & constraint quizzes
LLM_MATH = LLM(model="gpt-4o", temperature=0.2)           # ML math drills (lowest temp)
LLM_VERIFY = LLM(model="gpt-4o-mini", temperature=0.1)    # verification pass (cheap, deterministic)
LLM_COMPREHENSION = LLM(model="gpt-4o-mini", temperature=0.4)  # comprehension MCQs

# ─── Tuning Thresholds ───────────────────────────────────────────
CONCEPT_SIMILARITY_THRESHOLD = 0.7  # fuzzy match threshold for deduplication
MAX_TEACH_ROUNDS = 5                # max teach rounds before forcing evaluation
MIN_TEACH_BEFORE_EVAL = 3           # minimum teach rounds before first evaluation
EVAL_EVERY_N_ROUNDS = 2             # evaluate every N rounds after MIN_TEACH_BEFORE_EVAL
SM2_DEFAULT_EASINESS = 2.5          # SM-2 initial easiness factor
MASTERY_SCORE_THRESHOLD = 80        # score needed to mark concept as mastered
QUIZ_HISTORY_DEFAULT_LIMIT = 50     # default page size for quiz history
QUIZ_HISTORY_MAX_LIMIT = 500        # max page size for quiz history

# ─── Skill Tracker ───────────────────────────────────────────────
SKILL_SCORE_ALPHA = 0.3             # weight of previous score in moving average
SKILL_SCORE_BETA = 0.7              # weight of new score in moving average
SKILL_CONFIDENCE_INCREMENT = 10     # confidence gain per evaluation
SKILL_MAX_MISCONCEPTIONS = 10       # max unique gaps tracked per concept

# ─── Agent Context ────────────────────────────────────────────────
HISTORY_CONTEXT_WINDOW = 10         # conversation messages sent to agent prompts

# ─── Tester / MCQ Cache ──────────────────────────────────────────
MCQ_CACHE_TTL = 86400               # seconds (24h)
MCQ_CACHE_MAX_SIZE = 128
