"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// Define TypeScript structures
interface Message {
    id: string;
    sender: "customer" | "agent" | "human";
    content: string;
    timestamp: Date;
}

interface AgentConfig {
    name: string;
    system_prompt: string;
    temperature: number;
    config: {
        primaryColor?: string;
        avatarUrl?: string;
        placeholderText?: string;
        welcomeMessage?: string;
    };
}

export default function EmbedChatWidget() {
    const params = useParams();
    const agentId = params?.agent_id as string;
    const backendUrl = "http://localhost:8000";

    // Application States
    const [agent, setAgent] = useState<AgentConfig | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [handoffMode, setHandoffMode] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Set document title
    useEffect(() => {
        document.title = "RIAM";
    }, []);

    // Fetch Agent details on load
    useEffect(() => {
        if (!agentId) return;
        
        const fetchAgent = async () => {
            try {
                const response = await fetch(`${backendUrl}/api/v1/agents/${agentId}`);
                if (response.ok) {
                    const data = await response.json();
                    setAgent(data);
                    
                    // Populate welcome message
                    const welcome = data.config?.welcomeMessage || "Hello! How can we assist you today?";
                    setMessages([
                        {
                            id: "welcome-bubble",
                            sender: "agent",
                            content: welcome,
                            timestamp: new Date(),
                        },
                    ]);
                }
            } catch (err) {
                console.error("Failed to load agent configuration:", err);
            }
        };

        fetchAgent();
    }, [agentId]);

    // Scroll chat window to bottom on new messages
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    // 1. Create a secure Chat Session
    const startNewSession = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/v1/conversations/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agent_id: agentId,
                    customer_name: "Visitor",
                    customer_email: null,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                setConversationId(data.id);
                return data.id as string;
            }
        } catch (err) {
            console.error("Error creating support ticket session:", err);
        }
        return null;
    };

    // 2. Stream AI Agent response using SSE
    const triggerSSEStream = async (activeSessionId: string, userQuery: string) => {
        setIsStreaming(true);
        setIsTyping(true);

        // Add a placeholder message for the incoming AI response
        const placeholderId = `ai-stream-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            {
                id: placeholderId,
                sender: "agent",
                content: "",
                timestamp: new Date(),
            },
        ]);

        try {
            const response = await fetch(
                `${backendUrl}/api/v1/conversations/${activeSessionId}/chat/stream`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: userQuery }),
                }
            );

            if (!response.body) throw new Error("No response body stream found.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const textChunk = decoder.decode(value);
                const sseEvents = textChunk.split("\n\n");

                for (const event of sseEvents) {
                    if (!event.trim()) continue;

                    // Capture SSE Event headers (event: type, data: payload)
                    if (event.startsWith("event: token")) {
                        const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
                        if (dataLine) {
                            const rawData = JSON.parse(dataLine.replace("data: ", ""));
                            accumulatedText += rawData.token;
                            setIsTyping(false); // Hide typing dot since typing tokens started flowing
                            
                            // Update placeholder content
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === placeholderId
                                        ? { ...msg, content: accumulatedText }
                                        : msg
                                )
                            );
                        }
                    } else if (event.startsWith("event: handoff")) {
                        const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
                        if (dataLine) {
                            const rawData = JSON.parse(dataLine.replace("data: ", ""));
                            setIsTyping(false);
                            setHandoffMode(true);
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === placeholderId
                                        ? { ...msg, content: rawData.message }
                                        : msg
                                )
                            );
                        }
                    } else if (event.startsWith("event: done")) {
                        // Finished streaming cleanly
                        break;
                    }
                }
            }
        } catch (err) {
            console.error("SSE stream error:", err);
            // Fallback error indicator in chat bubble
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === placeholderId
                        ? { ...msg, content: "My apologies, I ran into an error generating that answer. Please try again." }
                        : msg
                )
            );
        } finally {
            setIsStreaming(false);
            setIsTyping(false);
        }
    };

    // 3. Handle message submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isStreaming) return;

        const userQuery = input.trim();
        setInput("");

        // Insert User message to UI
        const userMsg: Message = {
            id: `usr-${Date.now()}`,
            sender: "customer",
            content: userQuery,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);

        // Retrieve or initiate conversation session ID
        let activeSessionId = conversationId;
        if (!activeSessionId) {
            setIsTyping(true);
            activeSessionId = await startNewSession();
        }

        if (activeSessionId) {
            await triggerSSEStream(activeSessionId, userQuery);
        } else {
            // Failure fallback
            setMessages((prev) => [
                ...prev,
                {
                    id: `err-${Date.now()}`,
                    sender: "agent",
                    content: "Sorry, I am unable to connect to the server. Please check your connection and try again.",
                    timestamp: new Date(),
                },
            ]);
            setIsTyping(false);
        }
    };

    // Close floating iframe trigger inside parent
    const handleClose = () => {
        window.parent.postMessage({ type: "riam-close-widget" }, "*");
    };

    // Branding variables
    const primaryColor = agent?.config?.primaryColor || "#6366f1";
    const avatarUrl = agent?.config?.avatarUrl;
    const placeholderText = agent?.config?.placeholderText || "Write your message...";

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans border-0 sm:border border-slate-100 rounded-none sm:rounded-2xl sm:max-w-[420px] sm:max-h-[600px] sm:fixed sm:bottom-6 sm:right-6 sm:shadow-2xl shadow-indigo-500/10"
        >
            {/* Widget Elegant Header */}
            <div 
                className="flex items-center justify-between px-5 py-4 text-white shadow-md relative z-10 shrink-0"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #1e1b4b 100%)` }}
            >
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-white/20" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg border-2 border-white/10 animate-pulse">
                                R
                            </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full animate-pulse"></span>
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm leading-tight tracking-wide">{agent?.name || "Riam Support Bot"}</h4>
                        <span className="text-xs text-emerald-200 font-medium">Online • Active</span>
                    </div>
                </div>
                
                {/* Close Button */}
                <button 
                    onClick={handleClose} 
                    className="p-2 rounded-full hover:bg-white/15 transition-all active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Close chat bubble"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Support Inbox Notification Banner */}
            <AnimatePresence>
                {handoffMode && (
                    <motion.div 
                        initial={{ opacity: 0, y: -25 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -25 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-start space-x-2.5 shrink-0"
                    >
                        <span className="text-amber-500 font-bold text-lg leading-none select-none">⚠️</span>
                        <p className="text-xs text-amber-700 font-medium">
                            Human handoff requested. A live agent has been notified and will reply shortly.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Conversation Window */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 scrollbar-thin scrollbar-track-slate-100 scrollbar-thumb-slate-200">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: "spring", damping: 25, stiffness: 250 }}
                            key={msg.id}
                            className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}
                        >
                            <div className={`max-w-[78%] flex flex-col space-y-1`}>
                                <div 
                                    className={`px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed shadow-sm font-normal tracking-wide whitespace-pre-wrap transition-all duration-300
                                        ${msg.sender === "customer" 
                                            ? "bg-slate-900 text-white rounded-br-none" 
                                            : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"
                                        }
                                    `}
                                    style={msg.sender === "customer" ? { background: primaryColor } : {}}
                                >
                                    {msg.content}
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium px-1.5 self-end select-none">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Animated Typing indicator dots */}
                <AnimatePresence>
                    {isTyping && (
                        <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="flex justify-start"
                        >
                            <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-none flex items-center space-x-1.5 shadow-sm">
                                <motion.span 
                                    animate={{ y: [0, -6, 0] }}
                                    transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                                    className="w-2 h-2 bg-slate-300 rounded-full"
                                />
                                <motion.span 
                                    animate={{ y: [0, -6, 0] }}
                                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.15 }}
                                    className="w-2 h-2 bg-slate-300 rounded-full"
                                />
                                <motion.span 
                                    animate={{ y: [0, -6, 0] }}
                                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }}
                                    className="w-2 h-2 bg-slate-300 rounded-full"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                <div ref={scrollRef} />
            </div>

            {/* Chat Input Footer */}
            <form 
                onSubmit={handleSubmit}
                className="px-4 py-3 bg-white border-t border-slate-100 flex items-center space-x-3 shrink-0"
            >
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isStreaming || handoffMode}
                    placeholder={handoffMode ? "AI paused during human intervention..." : placeholderText}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all disabled:opacity-50 text-slate-700 placeholder-slate-400 font-medium min-h-[44px]"
                />
                
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={!input.trim() || isStreaming || handoffMode}
                    className="p-2.5 rounded-xl text-white shadow-sm flex items-center justify-center hover:shadow-md active:scale-95 transition-all disabled:opacity-40 disabled:hover:shadow-none min-h-[44px] min-w-[44px]"
                    style={{ background: primaryColor }}
                    aria-label="Send message"
                >
                    <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                </motion.button>
            </form>
        </motion.div>
    );
}
