"""
Streaming wrappers for professor and student agents.
Bypasses CrewAI's blocking execute_task() for real-time token delivery.
"""
import logging
from openai import AsyncOpenAI
from fastapi import WebSocket

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI()
    return _client


def _professor_system_prompt() -> str:
    return (
        "You are a Senior SDE/MLE Professor. "
        "Goal: Explain CS and ML concepts clearly for SDE/MLE engineers. "
        "Be precise and concise — no filler words, no redundant sentences. "
        "Every sentence must teach something. Use real production systems as examples. "
        "Adapt depth to skill level.\n\n"
        "Backstory: Staff Engineer from FAANG with deep SDE and MLE experience. "
        "You teach by connecting concepts to real engineering decisions — "
        "system design trade-offs, scaling, and production gotchas. "
        "You never pad explanations with fluff."
    )


def _student_system_prompt() -> str:
    return (
        "You are a Curious Junior SDE/MLE. "
        "Goal: Act as a junior SDE/MLE being taught by a peer. "
        "Ask 1-2 sharp questions that probe understanding gaps. "
        "Focus on production applicability and trade-offs. "
        "Never correct the user — only ask questions that reveal gaps.\n\n"
        "Backstory: Junior engineer at a tech company. You ask questions a real teammate would: "
        "'How does this scale?', 'What happens in production when X fails?'. "
        "If the explanation is vague or wrong, you ask pointed follow-ups."
    )


async def stream_to_ws(
    websocket: WebSocket,
    system_prompt: str,
    user_prompt: str,
    agent_name: str,
    model: str = "gpt-4o-mini",
) -> str:
    """
    Stream an LLM response token-by-token over the WebSocket.
    Sends stream_chunk messages as tokens arrive, stream_end when done.
    Returns the full accumulated response text.
    """
    client = _get_client()
    full_text = []

    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            stream=True,
            temperature=0.7,
        )

        await websocket.send_json({
            "type": "stream_start",
            "agent": agent_name,
        })

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                full_text.append(delta)
                await websocket.send_json({
                    "type": "stream_chunk",
                    "content": delta,
                    "agent": agent_name,
                })

        await websocket.send_json({
            "type": "stream_end",
            "agent": agent_name,
        })

    except Exception as e:
        logger.error("Streaming error for agent '%s': %s", agent_name, e)
        # Fall back to sending what we have so far as a complete message
        if full_text:
            await websocket.send_json({
                "type": "stream_end",
                "agent": agent_name,
            })
        else:
            raise

    return "".join(full_text)


def build_explain_prompt(
    topic: str,
    skill_level: float,
    mode: str = "concept",
) -> str:
    skill_desc = "beginner" if skill_level < 30 else "intermediate" if skill_level < 70 else "advanced"
    style_rule = (
        "STYLE: Be precise and concise. No filler phrases like 'Let me explain', "
        "'In this section', 'It's worth noting'. Jump straight into the content. "
        "Every sentence must convey information. Use short paragraphs."
    )

    if mode == "industrial":
        return (
            f"Explain '{topic}' for a {skill_desc} SDE/MLE ({skill_level}/100).\n\n"
            "Cover:\n"
            "1. Production-quality implementation with clean architecture\n"
            "2. Relevant design patterns (SOLID, GoF)\n"
            "3. API design and interface contracts\n"
            "4. Error handling and observability\n"
            "5. How this fits into larger system architectures\n"
            "6. Testing strategies\n\n"
            f"Use Python. Show production-grade code, not toy examples. Use markdown code blocks.\n\n{style_rule}"
        )
    elif mode == "leetcode":
        return (
            f"Explain '{topic}' for a {skill_desc} SDE/MLE ({skill_level}/100).\n\n"
            "Cover:\n"
            "1. Clean canonical solution\n"
            "2. 2-3 alternative approaches with trade-offs\n"
            "3. Time/space complexity for EACH approach\n"
            "4. Pattern classification (sliding window, two pointers, BFS/DFS, DP, etc.)\n"
            "5. Common pitfalls and edge cases\n"
            "6. Problem-specific tricks\n\n"
            f"Use Python. Markdown code blocks.\n\n{style_rule}"
        )
    else:
        return (
            f"Explain '{topic}' for a {skill_desc} SDE/MLE ({skill_level}/100). "
            "Connect to real production systems, design decisions, and engineering scenarios. "
            "Use analogies from real systems (distributed services, ML pipelines, databases). "
            "Beginners: start with fundamentals + analogies. "
            f"Intermediate/advanced: go into nuances and edge cases.\n\n{style_rule}"
        )


def build_followup_prompt(
    topic: str,
    question: str,
    conversation_history: list[dict],
    skill_level: float,
    mode: str = "concept",
) -> str:
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history
    )
    skill_desc = "beginner" if skill_level < 30 else "intermediate" if skill_level < 70 else "advanced"
    mode_hint = {
        "industrial": "Use production code examples. Connect to system design.",
        "leetcode": "Use algorithm examples and complexity analysis.",
    }.get(mode, "Use analogies and real-world engineering examples.")

    return (
        f"Teaching '{topic}' to a {skill_desc} SDE/MLE ({skill_level}/100).\n\n"
        f"Conversation so far:\n{history_text}\n\n"
        f"Follow-up question: \"{question}\"\n\n"
        f"Answer directly. Don't repeat prior explanation. {mode_hint}\n\n"
        "STYLE: Be precise and concise. No filler. Every sentence must teach."
    )


def build_student_prompt(
    topic: str,
    user_explanation: str,
    conversation_history: list[dict],
    skill_level: float,
    mode: str = "concept",
    critical_errors: list[str] | None = None,
    pending_gaps: list[str] | None = None,
) -> str:
    difficulty = "basic" if skill_level < 30 else "probing" if skill_level < 70 else "challenging"

    history_text = ""
    if conversation_history:
        history_text = "Previous conversation:\n"
        for msg in conversation_history[-10:]:
            role = msg.get("agent", msg.get("role", "unknown"))
            history_text += f"[{role}]: {msg['content']}\n"

    error_text = ""
    if critical_errors:
        error_lines = "\n".join(f"- {e}" for e in critical_errors)
        error_text = (
            f"\nIMPORTANT: The explanation contains factual errors. Do NOT correct them directly. "
            f"Ask Socratic questions that guide the user to discover the mistake:\n{error_lines}\n"
        )

    gap_text = ""
    if pending_gaps:
        gap_lines = "\n".join(f"- {g}" for g in pending_gaps)
        gap_text = (
            f"\nPRIORITY GAPS from last evaluation — probe these specifically:\n{gap_lines}\n"
        )

    focus_map = {
        "industrial": (
            f"Ask 1-2 {difficulty} questions about the production code. "
            "Target: scaling, failure modes, design patterns, testing, observability. "
            "Do NOT correct — only ask questions that reveal gaps."
        ),
        "leetcode": (
            f"Ask 1-2 {difficulty} questions about the algorithm. "
            "Target: edge cases, alternative algorithms, exact complexity, pattern classification. "
            "Do NOT correct — only ask questions that reveal gaps."
        ),
    }
    focus = focus_map.get(mode, (
        f"Ask 1-2 {difficulty} questions testing real understanding for SDE/MLE work. "
        "Target vague or incomplete areas. Ask about real-world implications. "
        "Do NOT correct — only ask questions that reveal gaps."
    ))

    return (
        f"User is teaching you about '{topic}'. "
        f"Their explanation: \"{user_explanation}\"\n\n"
        f"{history_text}"
        f"{error_text}"
        f"{gap_text}\n"
        f"Difficulty: {difficulty}. {focus}\n\n"
        "STYLE: Ask concise, pointed questions. No preamble or pleasantries."
    )
