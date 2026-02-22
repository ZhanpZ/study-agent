import json
import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.database import init_db, get_db
from backend.models.tables import Concept, SkillScore, ReviewSchedule, Session, Message
from backend.models.schemas import (
    SessionStart, SessionResponse, SkillResponse, ReviewDue, StatsResponse, WSMessage,
    ConceptMerge,
)
from backend.agents.orchestrator import Orchestrator, Phase
from backend.agents.professor import generate_summary
from backend.agents.tester import generate_comprehension_mcqs
from backend.agents.quiz_generator import (
    create_quiz_agent, generate_algorithm_quiz, generate_constraint_quiz,
    create_ml_math_agent, generate_ml_math_question,
)
from backend.services.scheduler import update_review_schedule, get_due_reviews
from backend.services.skill_tracker import (
    get_or_create_skill, update_skill, get_all_skills, get_stats,
)
from backend.services.concept_matcher import find_matching_concept, deduplicate_concepts


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Auto-merge duplicate concepts from before fuzzy matching was added
    async for db in get_db():
        merged = await deduplicate_concepts(db)
        if merged:
            print(f"Merged {merged} duplicate concept(s) on startup")
        break
    yield


app = FastAPI(title="Study Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active orchestrators per session
active_sessions: dict[int, tuple[Orchestrator, "SessionState"]] = {}


# ─── REST Endpoints ───────────────────────────────────────────────


@app.post("/api/session/start", response_model=SessionResponse)
async def start_session(body: SessionStart, db: AsyncSession = Depends(get_db)):
    # Find existing concept via fuzzy match, or create new
    concept = await find_matching_concept(db, body.topic)

    if concept is None:
        concept = Concept(name=body.topic, description="")
        db.add(concept)
        await db.commit()
        await db.refresh(concept)

    # Get current skill level
    skill = await get_or_create_skill(db, concept.id)

    # Create session record
    session = Session(concept_id=concept.id, phase="explain", mode=body.mode)
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Initialize orchestrator
    orchestrator = Orchestrator()
    state = orchestrator.start_session(body.topic, skill.score, mode=body.mode)
    active_sessions[session.id] = (orchestrator, state)

    return SessionResponse(
        id=session.id,
        concept_id=concept.id,
        phase=state.phase.value,
        mode=session.mode,
        started_at=session.started_at,
    )


@app.get("/api/session/{session_id}")
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        return {"error": "Session not found"}

    # Get messages
    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.timestamp)
    )
    messages = msg_result.scalars().all()

    return {
        "id": session.id,
        "concept_id": session.concept_id,
        "phase": session.phase,
        "mode": session.mode,
        "messages": [
            {"role": m.role, "agent": m.agent, "content": m.content}
            for m in messages
        ],
    }


@app.get("/api/session/{session_id}/summary")
async def get_session_summary(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, session_id)
    if not session:
        return {"error": "Session not found"}
    return {"summary": session.summary, "mode": session.mode}


@app.get("/api/concepts/{concept_id}/sessions")
async def get_concept_sessions(concept_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Session)
        .where(Session.concept_id == concept_id)
        .order_by(Session.started_at.desc())
    )
    sessions = result.scalars().all()
    return [
        {
            "id": s.id,
            "phase": s.phase,
            "mode": s.mode,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "has_summary": s.summary is not None,
        }
        for s in sessions
    ]


@app.get("/api/reviews/due")
async def reviews_due(db: AsyncSession = Depends(get_db)):
    return await get_due_reviews(db)


@app.get("/api/dashboard/skills")
async def dashboard_skills(db: AsyncSession = Depends(get_db)):
    return await get_all_skills(db)


@app.get("/api/dashboard/stats", response_model=StatsResponse)
async def dashboard_stats(db: AsyncSession = Depends(get_db)):
    return await get_stats(db)


@app.post("/api/concepts/merge")
async def merge_concepts(body: ConceptMerge, db: AsyncSession = Depends(get_db)):
    """Merge source concept into target concept."""
    target = await db.get(Concept, body.target_id)
    source = await db.get(Concept, body.source_id)
    if not target or not source:
        return {"error": "Concept not found"}

    # Move all sessions from source to target
    sessions_result = await db.execute(
        select(Session).where(Session.concept_id == source.id)
    )
    for session in sessions_result.scalars().all():
        session.concept_id = target.id

    # Merge skill scores (keep highest)
    target_skill = await get_or_create_skill(db, target.id)
    source_skill_result = await db.execute(
        select(SkillScore).where(SkillScore.concept_id == source.id)
    )
    source_skill = source_skill_result.scalar_one_or_none()
    if source_skill:
        if source_skill.score > target_skill.score:
            target_skill.score = source_skill.score
        await db.delete(source_skill)

    # Delete source review schedule if exists
    source_review_result = await db.execute(
        select(ReviewSchedule).where(ReviewSchedule.concept_id == source.id)
    )
    source_review = source_review_result.scalar_one_or_none()
    if source_review:
        await db.delete(source_review)

    await db.delete(source)
    await db.commit()

    return {"status": "merged", "target_id": target.id}


@app.get("/api/algorithm-quiz")
async def get_algorithm_quiz(topic: str = "all", count: int = 5):
    """Generate algorithm selection quiz questions."""
    agent = create_quiz_agent()
    questions = generate_algorithm_quiz(agent, topic_scope=topic, num_questions=min(count, 10))
    return {"questions": questions, "topic": topic}


@app.get("/api/constraint-quiz")
async def get_constraint_quiz(count: int = 5):
    """Generate keyword + constraint → algorithm matching questions (select all that apply)."""
    agent = create_quiz_agent()
    questions = generate_constraint_quiz(agent, num_questions=min(count, 10))
    return {"questions": questions}


@app.get("/api/ml-math")
async def get_ml_math_question(topic: str = "all"):
    """Generate a single ML math drill question (math MC + proof MC + ML application)."""
    agent = create_ml_math_agent()
    question = generate_ml_math_question(agent, topic=topic)
    return {"question": question}


# ─── WebSocket Endpoint ───────────────────────────────────────────


@app.websocket("/ws/session/{session_id}")
async def websocket_session(websocket: WebSocket, session_id: int):
    await websocket.accept()

    # Try to restore session if not in active_sessions (e.g. after tab switch or server restart)
    if session_id not in active_sessions:
        async for db in get_db():
            session_record = await db.get(Session, session_id)
            if not session_record:
                await websocket.send_json({"type": "error", "content": "Session not found"})
                await websocket.close()
                return

            concept = await db.get(Concept, session_record.concept_id)
            skill = await get_or_create_skill(db, session_record.concept_id)

            orchestrator = Orchestrator()
            state = orchestrator.start_session(
                concept.name, skill.score, mode=session_record.mode
            )
            state.phase = Phase(session_record.phase)

            # Rebuild conversation history from stored messages
            msg_result = await db.execute(
                select(Message)
                .where(Message.session_id == session_id)
                .order_by(Message.timestamp)
            )
            for m in msg_result.scalars().all():
                state.conversation_history.append({
                    "role": m.role, "agent": m.agent, "content": m.content
                })
            state.teach_rounds = sum(
                1 for m in state.conversation_history if m["role"] == "user"
            )

            active_sessions[session_id] = (orchestrator, state)
            break

    orchestrator, state = active_sessions[session_id]

    # Get a DB session for persistence
    async for db in get_db():
        try:
            # If session just started, kick off the Professor explanation
            if state.phase == Phase.EXPLAIN:
                await websocket.send_json({
                    "type": "phase_change",
                    "phase": "explain",
                })
                response, agent_name, state = orchestrator.process_message(state)
                active_sessions[session_id] = (orchestrator, state)

                # Save message to DB
                db.add(Message(
                    session_id=session_id, role="assistant",
                    agent=agent_name, content=response,
                ))
                await db.commit()

                await websocket.send_json({
                    "type": "message",
                    "agent": agent_name,
                    "content": response,
                    "phase": "explain_done",
                })

                # Send explain_done — wait for user to click "Ready to Teach"
                await websocket.send_json({
                    "type": "phase_change",
                    "phase": "explain_done",
                })

                # Generate comprehension MCQs based on the explanation
                comprehension_mcqs = generate_comprehension_mcqs(
                    orchestrator.tester, state.topic, response,
                )
                if comprehension_mcqs:
                    await websocket.send_json({
                        "type": "comprehension_mcqs",
                        "questions": comprehension_mcqs,
                    })

            # Main message loop
            while True:
                data = await websocket.receive_text()
                msg = json.loads(data)

                if msg.get("type") == "ready_to_teach":
                    # User clicked "Ready to Teach" / "Ready for Challenge"
                    if state.phase == Phase.EXPLAIN_DONE:
                        # Leetcode mode skips teach → goes straight to code challenge
                        if state.mode == "leetcode":
                            response, agent_name, state = orchestrator.transition_to_evaluate(state)
                            active_sessions[session_id] = (orchestrator, state)

                            if response == "__CODE_CHALLENGE__":
                                await websocket.send_json({
                                    "type": "code_challenge",
                                    "problem": state.code_challenge.get("problem", ""),
                                    "hints": state.code_challenge.get("hints", []),
                                    "phase": "evaluate",
                                })
                                await websocket.send_json({
                                    "type": "phase_change", "phase": "evaluate",
                                })
                            continue

                        state = orchestrator.transition_to_teach(state)
                        active_sessions[session_id] = (orchestrator, state)

                        await websocket.send_json({
                            "type": "phase_change", "phase": "teach",
                        })
                        prompt, agent_name, state = orchestrator.process_message(state)
                        active_sessions[session_id] = (orchestrator, state)

                        db.add(Message(
                            session_id=session_id, role="assistant",
                            agent=agent_name, content=prompt,
                        ))
                        await db.commit()

                        await websocket.send_json({
                            "type": "message",
                            "agent": agent_name,
                            "content": prompt,
                            "phase": state.phase.value,
                        })

                elif msg.get("type") == "mcq_answers":
                    # User submitted MCQ answers
                    answers = msg.get("answers", [])
                    response, agent_name, state = orchestrator.process_mcq_answers(
                        state, answers
                    )
                    active_sessions[session_id] = (orchestrator, state)

                    db.add(Message(
                        session_id=session_id, role="assistant",
                        agent=agent_name, content=response,
                    ))
                    await db.commit()

                    await websocket.send_json({
                        "type": "message",
                        "agent": agent_name,
                        "content": response,
                        "phase": state.phase.value,
                    })

                    await _handle_post_evaluation(
                        websocket, db, session_id, orchestrator, state
                    )

                elif msg.get("type") == "code_answer":
                    # User submitted code
                    code = msg.get("code", "")
                    response, agent_name, state = orchestrator.process_code_answer(
                        state, code
                    )
                    active_sessions[session_id] = (orchestrator, state)

                    db.add(Message(
                        session_id=session_id, role="assistant",
                        agent=agent_name, content=response,
                    ))
                    await db.commit()

                    await websocket.send_json({
                        "type": "message",
                        "agent": agent_name,
                        "content": response,
                        "phase": state.phase.value,
                    })

                    await _handle_post_evaluation(
                        websocket, db, session_id, orchestrator, state
                    )

                elif msg.get("type") == "message":
                    user_content = msg["content"]

                    # Save user message
                    db.add(Message(
                        session_id=session_id, role="user",
                        agent="user", content=user_content,
                    ))
                    await db.commit()

                    # Process through orchestrator
                    response, agent_name, state = orchestrator.process_message(
                        state, user_content
                    )
                    active_sessions[session_id] = (orchestrator, state)

                    # Check for special response types (MCQ, code challenge)
                    if response == "__MCQ__":
                        # Send MCQ questions to client
                        await websocket.send_json({
                            "type": "mcq",
                            "questions": state.mcq_questions,
                            "phase": "quiz",
                        })
                        await websocket.send_json({
                            "type": "phase_change", "phase": "quiz",
                        })
                        continue

                    if response == "__CODE_CHALLENGE__":
                        # Send code challenge to client
                        await websocket.send_json({
                            "type": "code_challenge",
                            "problem": state.code_challenge.get("problem", ""),
                            "hints": state.code_challenge.get("hints", []),
                            "phase": "evaluate",
                        })
                        await websocket.send_json({
                            "type": "phase_change", "phase": "evaluate",
                        })
                        continue

                    # Save agent response
                    db.add(Message(
                        session_id=session_id, role="assistant",
                        agent=agent_name, content=response,
                    ))
                    await db.commit()

                    await websocket.send_json({
                        "type": "message",
                        "agent": agent_name,
                        "content": response,
                        "phase": state.phase.value,
                    })

                    # Generate comprehension MCQs for professor follow-up answers
                    if state.phase == Phase.EXPLAIN_DONE and agent_name == "professor":
                        followup_mcqs = generate_comprehension_mcqs(
                            orchestrator.tester, state.topic, response,
                        )
                        if followup_mcqs:
                            await websocket.send_json({
                                "type": "comprehension_mcqs",
                                "questions": followup_mcqs,
                            })

                    # Send phase change if needed
                    if agent_name == "tester":
                        await _handle_post_evaluation(
                            websocket, db, session_id, orchestrator, state
                        )

        except WebSocketDisconnect:
            # Clean up on disconnect
            if session_id in active_sessions:
                # Update session phase in DB
                session_record = await db.get(Session, session_id)
                if session_record:
                    session_record.phase = state.phase.value
                    await db.commit()


async def _handle_post_evaluation(
    websocket: WebSocket,
    db: AsyncSession,
    session_id: int,
    orchestrator: Orchestrator,
    state,
):
    """Handle post-evaluation: send score, complete session if mastered."""
    evaluation = state.last_evaluation
    if not evaluation:
        return

    await websocket.send_json({
        "type": "score_update",
        "score": evaluation.score,
        "gaps": evaluation.gaps,
    })

    if state.phase == Phase.COMPLETE:
        await websocket.send_json({
            "type": "phase_change",
            "phase": "complete",
        })

        # Update skill and review schedule
        session_record = await db.get(Session, session_id)
        if session_record and session_record.concept_id:
            await update_skill(
                db, session_record.concept_id,
                evaluation.score, evaluation.gaps,
            )
            await update_review_schedule(
                db, session_record.concept_id,
                evaluation.score,
            )
            session_record.phase = "complete"
            session_record.ended_at = datetime.datetime.utcnow()

            # Generate and store session summary
            summary = generate_summary(
                orchestrator.professor,
                state.topic,
                state.conversation_history,
                mode=state.mode,
            )
            session_record.summary = summary
            await db.commit()

            # Send summary to client
            await websocket.send_json({
                "type": "summary",
                "content": summary,
            })
    else:
        await websocket.send_json({
            "type": "phase_change",
            "phase": state.phase.value,
        })
