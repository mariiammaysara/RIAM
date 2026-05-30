"""
AI Chat Orchestration and LangGraph Service.
Assembles the support agent state machine (router -> retrieve -> grade -> rewrite -> answer -> HITL)
and streams responses to client widgets using Server-Sent Events (SSE).
"""
from typing import Annotated, Any, Dict, List, Literal, Tuple, TypedDict, Union
import uuid
import json
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.agent_repo import AgentRepository
from app.repositories.conversation_repo import ConversationRepository
from app.repositories.knowledge_repo import KnowledgeBaseRepository
from app.services.llm_factory import get_llm


# 1. Define LangGraph State Schema
class AgentState(TypedDict):
    """
    State definition for the Customer Support LangGraph.
    """
    messages: Annotated[List[BaseMessage], add_messages]
    agent_id: uuid.UUID
    business_id: uuid.UUID
    conversation_id: uuid.UUID
    rewrite_count: int  # Added rewrite loop counter
    context_chunks: List[str]
    current_query: str
    next_node: str
    status: str
    provider: str


class ChatService:
    """
    Chat Service class.
    Orchestrates support workflows via LangGraph and streams tokens over SSE.
    """

    def __init__(self, db: AsyncSession, business_id: uuid.UUID) -> None:
        """
        Initializes the chat service.
        """
        self.db = db
        self.business_id = business_id
        
        # Instantiate repositories
        self.agent_repo = AgentRepository(db, business_id)
        self.conv_repo = ConversationRepository(db, business_id)
        self.kb_repo = KnowledgeBaseRepository(db, business_id)
        
        # Initialize default LLM for graph nodes fallback
        self.llm = get_llm()

        # Assemble and compile the LangGraph workflow
        self.workflow = self._build_support_graph()

    def _build_support_graph(self) -> StateGraph:
        """
        Builds the LangGraph Support Agent state machine.
        """
        builder = StateGraph(AgentState)

        # Register nodes
        builder.add_node("router", self._node_router)
        builder.add_node("retrieve", self._node_retrieve)
        builder.add_node("grade", self._node_grade)
        builder.add_node("rewrite", self._node_rewrite)
        builder.add_node("answer", self._node_answer)
        builder.add_node("HITL", self._node_hitl)

        # Set entrypoint
        builder.set_entry_point("router")

        # Define conditional transitions from Router
        builder.add_conditional_edges(
            "router",
            lambda state: state["next_node"],
            {
                "retrieve": "retrieve",
                "answer": "answer",
                "HITL": "HITL"
            }
        )

        # Define transitions from Retrieve
        builder.add_edge("retrieve", "grade")

        # Define conditional transitions from Grade
        builder.add_conditional_edges(
            "grade",
            lambda state: state["next_node"],
            {
                "answer": "answer",
                "rewrite": "rewrite",
                "HITL": "HITL"  # Added conditional flow to HITL
            }
        )

        # Define transitions from Rewrite (loops back to retrieve)
        builder.add_edge("rewrite", "retrieve")

        # Terminating transitions
        builder.add_edge("answer", END)
        builder.add_edge("HITL", END)

        return builder.compile()

    # --- LangGraph Node Implementations ---

    async def _node_router(self, state: AgentState) -> Dict[str, Any]:
        """
        Router Node: Evaluates the user query to decide if it requires:
        - RAG Retrieval (technical/policy questions) -> 'retrieve'
        - Direct Answer (simple greeting/chitchat) -> 'answer'
        - Human handoff (explicit request or high complexity) -> 'HITL'
        """
        last_message = state["messages"][-1].content
        
        # Prompt the router LLM to categorize the inquiry
        system_prompt = (
            "You are an AI support routing assistant. Categorize the user's inquiry into exactly one of three categories:\n"
            "1. 'retrieve': The message asks for specific business details, policies, product information, or troubleshooting.\n"
            "2. 'answer': The message is a simple conversational greeting, goodbye, or general thank-you.\n"
            "3. 'HITL': The message explicitly demands to speak to a human, or is extremely angry/threatening.\n\n"
            "Response format: A single word, either 'retrieve', 'answer', or 'HITL'. Do not write anything else."
        )
        
        # Invoke LLM for category dynamically based on provider
        llm = get_llm(state.get("provider"))
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=last_message)
        ])
        
        category = response.content.strip().lower()
        next_node = "retrieve"
        if category in ["answer", "hitl"]:
            next_node = "answer" if category == "answer" else "HITL"
            
        return {
            "current_query": last_message,
            "next_node": next_node,
            "rewrite_count": 0,  # Reset/initialize rewrite_count to 0
            "context_chunks": []
        }

    async def _node_retrieve(self, state: AgentState) -> Dict[str, Any]:
        """
        Retrieve Node: Generates vector embedding and retrieves similar chunks from pgvector.
        """
        query = state["current_query"]
        
        # Compute embedding using dynamic Embeddings API
        # To avoid actual network calls on dummy keys, we generate a mock vector if dummy keys are used:
        if "dummy" in settings.OPENAI_API_KEY or "dummy" in settings.GEMINI_API_KEY:
            mock_embedding = [0.0] * 768
            chunks_with_dist = await self.kb_repo.search_similar_chunks(embedding=mock_embedding, limit=3)
        else:
            from app.services.llm_factory import get_embeddings
            emb = get_embeddings()
            query_vector = await emb.aembed_query(query)
            chunks_with_dist = await self.kb_repo.search_similar_chunks(embedding=query_vector, limit=3)

        context_list = [chunk.content for chunk, dist in chunks_with_dist]
        return {
            "context_chunks": context_list
        }

    async def _node_grade(self, state: AgentState) -> Dict[str, Any]:
        """
        Grade Node: Evaluates if the retrieved chunks are relevant to the user query.
        - If relevant -> route to 'answer'.
        - If irrelevant and rewrite_count < 3 -> route to 'rewrite'.
        - If irrelevant and rewrite_count >= 3 -> skip retrieval and route to 'HITL'.
        """
        query = state["current_query"]
        chunks = state["context_chunks"]
        rewrite_count = state["rewrite_count"]

        if not chunks:
            # If no context retrieved and rewrite limit reached, escalate to human (HITL)
            if rewrite_count >= 3:
                return {"next_node": "HITL"}
            return {"next_node": "rewrite"}

        # If we have reached the limit of 3 reformulations, bypass grading and handoff directly
        if rewrite_count >= 3:
            return {"next_node": "HITL"}

        system_prompt = (
            "You are a strict QA relevance grader. You will be given a user query and retrieved context chunks.\n"
            "Determine if the chunks contain information that can help answer the query.\n"
            "Response format: A single word, either 'yes' (relevant) or 'no' (irrelevant). Do not write anything else."
        )
        
        context_str = "\n---\n".join(chunks)
        llm = get_llm(state.get("provider"))
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Query: {query}\n\nContext:\n{context_str}")
        ])

        is_relevant = response.content.strip().lower() == "yes"
        
        if is_relevant:
            next_node = "answer"
        else:
            # Check rewrite limit: if we've already done 3 reformulations, handoff to human
            next_node = "HITL" if rewrite_count >= 3 else "rewrite"
            
        return {"next_node": next_node}

    async def _node_rewrite(self, state: AgentState) -> Dict[str, Any]:
        """
        Rewrite Node: Refines the query if pgvector RAG failed to retrieve relevant documents.
        Increments the rewrite_count.
        """
        query = state["current_query"]
        rewrite_count = state["rewrite_count"]

        system_prompt = (
            "You are a search query reformulation assistant. Reformulate the user's original query to make it clearer\n"
            "and more effective for vector database search. Resolve any pronoun ambiguities (e.g. 'it', 'they', 'how to fix it')\n"
            "based on conversation history. Return ONLY the reformulated query, nothing else."
        )

        llm = get_llm(state.get("provider"))
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Original Query: {query}")
        ])

        return {
            "current_query": response.content.strip(),
            "rewrite_count": rewrite_count + 1
        }

    async def _node_answer(self, state: AgentState) -> Dict[str, Any]:
        """
        Answer Node: Generates final response using LLM with context.
        """
        return {"status": "active"}

    async def _node_hitl(self, state: AgentState) -> Dict[str, Any]:
        """
        HITL Node: Marks conversation status as handoff and triggers operator notification.
        """
        conv = await self.conv_repo.get(state["conversation_id"])
        if conv:
            await self.conv_repo.update(db_obj=conv, obj_in={"status": "handoff"})
            await self.db.commit()
            
        return {"status": "handoff"}

    # --- End SSE Streaming Method ---

    async def stream_chat_response(
        self, *, conversation_id: uuid.UUID, user_message: str
    ):
        """
        Main entrypoint to trigger the support agent pipeline.
        Invokes LangGraph nodes, streams tokens in real-time,
        and yields Server-Sent Events (SSE) formatting.
        """
        # Fetch conversation & configuration
        conversation = await self.conv_repo.get_with_messages(conversation_id)
        if not conversation:
            raise ValueError("Conversation not found")

        agent = await self.agent_repo.get(conversation.agent_id)
        if not agent:
            raise ValueError("Agent not found")

        # Save user message to database
        await self.conv_repo.create_message(
            conversation_id=conversation_id,
            sender="customer",
            content=user_message
        )
        await self.db.commit()

        # Build message history for LangGraph
        graph_messages = []
        for msg in conversation.messages:
            if msg.sender == "customer":
                graph_messages.append(HumanMessage(content=msg.content))
            elif msg.sender == "agent":
                graph_messages.append(AIMessage(content=msg.content))
        # Add new query
        graph_messages.append(HumanMessage(content=user_message))

        # 1. Execute LangGraph pre-processing (routing & retrieval nodes)
        initial_state = AgentState(
            messages=graph_messages,
            agent_id=agent.id,
            business_id=self.business_id,
            conversation_id=conversation_id,
            rewrite_count=0,  # Explicitly reset/initialize rewrite_count to 0 at start
            context_chunks=[],
            current_query=user_message,
            next_node="",
            status=conversation.status,
            provider=agent.provider or agent.config.get("provider") or settings.LLM_PROVIDER
        )

        # Run the graph up until the 'answer' or 'HITL' node
        config = {"configurable": {"thread_id": str(conversation_id)}}
        
        state = initial_state
        async for event in self.workflow.astream(initial_state, config):
            for node_name, node_output in event.items():
                state.update(node_output)

        # 2. Yield initial SSE metadata (retrieved source metadata for rich client UI)
        if state.get("context_chunks"):
            yield f"event: sources\ndata: {json.dumps(state['context_chunks'])}\n\n"

        # 3. Stream or route response based on termination status
        if state.get("status") == "handoff":
            handoff_msg = "My apologies! I am connecting you with a human representative to better answer your request. One moment..."
            
            # Save message to DB
            await self.conv_repo.create_message(
                conversation_id=conversation_id,
                sender="agent",
                content=handoff_msg
            )
            await self.db.commit()
            
            yield f"event: handoff\ndata: {json.dumps({'message': handoff_msg})}\n\n"
            return

        # Regular streamed answer generation using LLM
        context_str = "\n".join(state.get("context_chunks", []))
        
        system_instructions = (
            f"{agent.system_prompt}\n\n"
            f"Use the following verified context chunks to answer the customer question if applicable:\n"
            f"{context_str}\n\n"
            f"Be concise, professional, and friendly."
        )

        llm_messages = [SystemMessage(content=system_instructions)]
        # Add previous messages for memory
        llm_messages.extend(graph_messages[-6:-1])
        # Add current query
        llm_messages.append(HumanMessage(content=user_message))

        complete_response = []
        
        # Trigger dynamic LLM stream
        llm = get_llm(agent.provider or agent.config.get("provider") or settings.LLM_PROVIDER)
        async for chunk in llm.astream(llm_messages):
            token = chunk.content
            complete_response.append(token)
            
            # SSE token payload format
            yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"

        # Save AI's response to database
        full_text = "".join(complete_response)
        await self.conv_repo.create_message(
            conversation_id=conversation_id,
            sender="agent",
            content=full_text
        )
        await self.db.commit()

        # Signal completion
        yield "event: done\ndata: {}\n\n"
