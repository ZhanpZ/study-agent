"""Seed the database with filler review data for testing the Review page."""

import sqlite3
import datetime

DB_PATH = "study.db"

now = datetime.datetime.utcnow()

# Filler concepts with varied scores and review statuses
filler_data = [
    # (name, description, score, confidence, status, interval_days, repetitions, easiness_factor)
    # "due" items — next_review in the past
    ("Binary Search", "Divide-and-conquer search algorithm", 42.0, 30.0, "due", 1.0, 1, 2.5),
    ("Hash Tables", "Key-value data structure with O(1) lookups", 28.0, 20.0, "due", 1.0, 0, 2.1),
    ("Recursion", "Function calling itself with a base case", 55.0, 40.0, "due", 3.0, 2, 2.6),

    # "upcoming" items — next_review in the future
    ("Dynamic Programming", "Breaking problems into overlapping subproblems", 78.0, 60.0, "upcoming", 7.5, 3, 2.7),
    ("Graph BFS/DFS", "Breadth-first and depth-first graph traversal", 65.0, 50.0, "upcoming", 3.0, 2, 2.4),
    ("Two Pointers", "Using two indices to scan a sequence", 90.0, 80.0, "upcoming", 15.0, 4, 2.8),

    # "new" items — no ReviewSchedule at all
    ("Sliding Window", "Fixed/variable window over a sequence", 15.0, 10.0, "new", None, None, None),
    ("Backtracking", "Explore all solutions by undoing choices", 0.0, 0.0, "new", None, None, None),
]

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

for name, desc, score, confidence, status, interval, reps, ef in filler_data:
    # Check if concept already exists
    cur.execute("SELECT id FROM concepts WHERE name = ?", (name,))
    row = cur.fetchone()
    if row:
        print(f"  Skipping '{name}' — already exists (id={row[0]})")
        continue

    # Insert concept
    cur.execute(
        "INSERT INTO concepts (name, description, created_at) VALUES (?, ?, ?)",
        (name, desc, now.isoformat()),
    )
    concept_id = cur.lastrowid

    # Insert skill score
    cur.execute(
        "INSERT INTO skill_scores (concept_id, score, confidence, misconceptions, updated_at) VALUES (?, ?, ?, '[]', ?)",
        (concept_id, score, confidence, now.isoformat()),
    )

    # Insert review schedule (skip for "new" status)
    if status == "due":
        next_review = (now - datetime.timedelta(days=1)).isoformat()
        last_review = (now - datetime.timedelta(days=2)).isoformat()
        cur.execute(
            "INSERT INTO review_schedule (concept_id, easiness_factor, interval_days, repetitions, next_review, last_review) VALUES (?, ?, ?, ?, ?, ?)",
            (concept_id, ef, interval, reps, next_review, last_review),
        )
    elif status == "upcoming":
        next_review = (now + datetime.timedelta(days=interval)).isoformat()
        last_review = now.isoformat()
        cur.execute(
            "INSERT INTO review_schedule (concept_id, easiness_factor, interval_days, repetitions, next_review, last_review) VALUES (?, ?, ?, ?, ?, ?)",
            (concept_id, ef, interval, reps, next_review, last_review),
        )

    print(f"  Inserted '{name}' as [{status}] (score={score}, id={concept_id})")

conn.commit()
conn.close()
print("\nDone! Start the app and visit the Review page to see the test data.")
