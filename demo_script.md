# Study Agent: 5–10 Minute Demo Video Script

---

## Opening (0:00 – 0:30)

**[Screen: Project landing page or home screen]**

> "Hi, I'm going to walk you through Study Agent — an AI-powered learning platform built around the Feynman Technique. The idea is simple: the best way to learn something is to teach it. Study Agent puts that into practice by having you explain concepts back to an AI professor, answer probing questions, and get evaluated on your understanding. Let's jump in."

---

## Section 1: Overview of Study Modes (0:30 – 1:00)

**[Screen: Home/Study page showing mode selector]**

> "When you open Study Agent, you get three core study modes:
> - **Concept Mode** — for understanding theoretical ideas
> - **Code Mode** — for learning programming concepts with code challenges
> - **LeetCode Mode** — for grinding algorithm problems
>
> There are also two standalone drill modes: **Algorithm Quiz** and **ML Math Drill**, which we'll touch on at the end."

---

## Section 2: Concept Mode Walkthrough (1:00 – 3:30)

**[Screen: Study page, selecting Concept Mode, entering a topic]**

> "Let's start with Concept Mode. I'll type in a topic — let's go with **'Gradient Descent'**."

**[Typing topic, hitting Start]**

> "The session begins with the **Professor Agent** giving a structured explanation of the topic. Notice it adapts to your current skill level — right now I'm at beginner level, so it's keeping things intuitive with analogies."

**[Screen: Professor explanation streaming in the chat]**

> "Once the explanation is done, the session moves to the **teach-back phase**. This is the Feynman moment — I need to explain it back in my own words."

**[Screen: User typing their explanation in the chat]**

> "I'll explain gradient descent as... 'It's like being on a hill and always stepping in the direction that goes downhill fastest, until you reach the lowest point.'"

**[Screen: Student Agent asking follow-up questions]**

> "The Student Agent now asks probing questions to test my depth. Things like: 'What happens when the learning rate is too large?' or 'Can gradient descent get stuck?' — it's not just checking if I memorized the answer."

**[Screen: User responding, conversation continuing]**

> "After a few exchanges, the **Tester Agent** evaluates my responses and gives me a score."

**[Screen: Score update and summary appearing]**

> "I got a score of 78 — not bad. The summary highlights what I got right and what I should revisit. My skill score for 'Gradient Descent' updates using a weighted moving average, and the spaced repetition scheduler marks when I should review it next."

---

## Section 3: Code Mode Walkthrough (3:30 – 5:30)

**[Screen: Switching to Code Mode, entering topic 'Binary Search']**

> "Now let's try Code Mode with **Binary Search**. This mode is designed for topics where writing actual code matters."

**[Screen: Professor explanation with code snippets]**

> "The Professor gives an explanation that includes annotated code examples. I can see it rendered with syntax highlighting."

**[Screen: Teach-back phase, user explains the algorithm]**

> "In my teach-back, I explain the algorithm and its time complexity."

**[Screen: Code challenge panel appearing]**

> "Code Mode adds a **code challenge step** — the agent presents a coding problem and I implement the solution right here in the interface."

**[Screen: User typing code in the code panel]**

> "I'll write a binary search implementation... and submit."

**[Screen: Evaluation feedback]**

> "The agent evaluates my solution — checking correctness, edge cases, and whether I understood the underlying pattern. The score feeds into my skill profile."

---

## Section 4: LeetCode Mode (5:30 – 6:30)

**[Screen: LeetCode Mode, entering a problem number or name]**

> "LeetCode Mode is different — it fetches a real LeetCode problem and focuses entirely on the problem-solving process. There's no teach-back phase here; it jumps straight to working through the problem with the agent."

**[Screen: LeetCode problem displayed, user attempting solution]**

> "The agent acts as a coach — it won't just give you the answer, but it asks guiding questions: 'What data structure would help here?', 'What's the brute-force approach first?'"

**[Screen: Evaluation and skill update]**

> "After submission, it evaluates the approach, time complexity, and whether I handled edge cases. Great for interview prep."

---

## Section 5: Algorithm Quiz & ML Math Drill (6:30 – 7:30)

**[Screen: Algorithm Quiz page]**

> "The standalone **Algorithm Quiz** mode generates multiple-choice questions about algorithm concepts, complexity analysis, and data structures. Great for quick warm-ups."

**[Screen: ML Math Drill page]**

> "**ML Math Drill** focuses on the mathematical foundations of machine learning — things like gradient computations, matrix operations, and loss function derivatives. Questions are generated dynamically, rendered with LaTeX so the math looks clean."

**[Screen: MCQ panel with a math question]**

> "You answer, get instant feedback, and the system tracks which areas need more work."

---

## Section 6: Dashboard & Progress Tracking (7:30 – 8:30)

**[Screen: Dashboard page]**

> "The Dashboard gives you a bird's-eye view of your learning. You can see all the topics you've studied, your skill scores, confidence levels, and when each topic is due for spaced repetition review."

**[Screen: Skill scores listed, spaced repetition dates]**

> "Skill scores are tracked with a weighted moving average — recent performance matters more than old sessions. Confidence grows as you revisit topics. The SM-2 spaced repetition algorithm schedules reviews so you see topics right before you'd forget them."

---

## Section 7: Review Page (8:30 – 9:00)

**[Screen: Review page]**

> "The Review page shows topics that are due for review today. One click kicks off a new session on that topic — keeping your knowledge fresh without having to manually track anything."

---

## Closing (9:00 – 9:30)

**[Screen: Back to home or a summary view]**

> "That's Study Agent — a full learning loop powered by CrewAI agents: a Professor that teaches, a Student that challenges, and a Tester that evaluates. Three study modes, two drill modes, spaced repetition, and skill tracking — all in one place.
>
> The stack is FastAPI on the backend with async SQLAlchemy, and React 19 with Tailwind on the frontend. Agents run on GPT-4o and GPT-4o-mini via OpenAI.
>
> Thanks for watching."

---

## Notes for Recording

- **Target length:** 7–10 minutes at a comfortable narration pace
- **Screen recording:** Use 1920×1080, hide browser bookmarks bar for a cleaner look
- **Demo tip:** Pre-seed the database with a few completed sessions so the Dashboard looks populated
- **Narration:** Record audio separately and sync to screen capture for cleaner audio quality
- **Captions:** Add captions for the phase transitions (`explain → teach → evaluate`) to help viewers follow the session state machine
