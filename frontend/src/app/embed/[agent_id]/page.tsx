"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isLoading = isStreaming || isTyping;

    // Set document title
    useEffect(() => {
        document.title = "RIAM Support Chat";
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
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    // Poll for new messages (crucial for receiving live human operator responses in real-time)
    useEffect(() => {
        if (!conversationId) return;

        const pollMessagesAndStatus = async () => {
            try {
                // 1. Fetch public message history
                const response = await fetch(`${backendUrl}/api/v1/conversations/${conversationId}/messages/public`);
                if (response.ok) {
                    const data = await response.json();
                    const formatted: Message[] = data.map((msg: { id: string; sender: string; content: string; created_at: string }) => ({
                        id: msg.id,
                        sender: msg.sender as "customer" | "agent" | "human",
                        content: msg.content,
                        timestamp: new Date(msg.created_at)
                    }));
                    
                    if (formatted.length > 0) {
                        setMessages(prev => {
                            const welcomeMsg = prev.find(m => m.id === "welcome-bubble");
                            const result = welcomeMsg ? [welcomeMsg] : [];
                            const signatures = new Set<string>();
                            const ids = new Set<string>();

                            formatted.forEach(msg => {
                                const sig = `${msg.sender}:${msg.content}`;
                                signatures.add(sig);
                                ids.add(msg.id);
                                result.push(msg);
                            });

                            prev.forEach(msg => {
                                if (msg.id === "welcome-bubble") return;
                                const sig = `${msg.sender}:${msg.content}`;
                                if (msg.id.startsWith("usr-") || msg.id.startsWith("ai-stream-") || msg.id.startsWith("err-")) {
                                    if (!signatures.has(sig) && !ids.has(msg.id)) {
                                        result.push(msg);
                                    }
                                }
                            });

                            // Deduplicate messages by exact ID
                            const seenIds = new Set<string>();
                            return result.filter(msg => {
                                if (seenIds.has(msg.id)) return false;
                                seenIds.add(msg.id);
                                return true;
                            });
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to poll message updates:", err);
            }
        };

        // Poll every 3 seconds
        const interval = setInterval(pollMessagesAndStatus, 3000);
        return () => clearInterval(interval);
    }, [conversationId]);

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

                    if (event.startsWith("event: token")) {
                        const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
                        if (dataLine) {
                            const rawData = JSON.parse(dataLine.replace("data: ", ""));
                            accumulatedText += rawData.token;
                            setIsTyping(false); // Hide typing dots once tokens flow
                            
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
                        break;
                    }
                }
            }
        } catch (err) {
            console.error("SSE stream error:", err);
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

        // Insert User message to local UI state
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
            if (handoffMode) {
                // If in Handoff/Human mode, bypass AI entirely and post directly to DB
                try {
                    await fetch(`${backendUrl}/api/v1/conversations/${activeSessionId}/messages/public`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ message: userQuery }),
                    });
                } catch (err) {
                    console.error("Failed to append customer handoff message:", err);
                }
            } else {
                // Otherwise run AI response stream
                await triggerSSEStream(activeSessionId, userQuery);
            }
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

    const handleClose = () => {
        window.parent.postMessage({ type: "riam-close-widget" }, "*");
    };

    // Branding variables
    const primaryColor = agent?.config?.primaryColor || "#7c6af7";
    const avatarUrl = agent?.config?.avatarUrl;
    const placeholderText = agent?.config?.placeholderText || "Write your message...";

    return (
        <div className="flex flex-col h-screen w-full bg-[#0b0b14] overflow-hidden font-sans border-0 sm:border border-slate-900 rounded-none sm:rounded-2xl sm:max-w-[420px] sm:max-h-[600px] sm:fixed sm:bottom-6 sm:right-6 sm:shadow-2xl shadow-indigo-950/20">
            {/* Import Google Font Inter */}
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                body {
                    font-family: 'Inter', sans-serif;
                }
                ::-webkit-scrollbar {
                    width: 5px;
                }
                ::-webkit-scrollbar-track {
                    background: #0f0f1c;
                }
                ::-webkit-scrollbar-thumb {
                    background: #232338;
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #3c3c5e;
                }
                .scroll-container {
                    overflow-y: auto;
                    scroll-behavior: smooth;
                }
                .prose-invert a {
                    color: ${primaryColor} !important;
                    text-decoration: underline;
                }
                .prose-invert code {
                    background-color: #0b0b14 !important;
                    padding: 0.125rem 0.25rem;
                    border-radius: 0.25rem;
                    font-family: monospace;
                }
                .prose-invert pre {
                    background-color: #0b0b14 !important;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    overflow-x: auto;
                }
                .prose-invert pre code {
                    padding: 0 !important;
                    background-color: transparent !important;
                }
            `}</style>

            {/* Flat Premium Dark Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#0f0f1a] border-b border-[#1e2330] shrink-0">
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-[#1e2330]" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-[#1e2330] flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c6af7" strokeWidth="1.5">
                                    <rect x="3" y="11" width="18" height="10" rx="2"/>
                                    <path d="M9 11V7a3 3 0 016 0v4"/>
                                    <circle cx="9" cy="16" r="1" fill="#7c6af7"/>
                                    <circle cx="15" cy="16" r="1" fill="#7c6af7"/>
                                    <path d="M12 3v2"/>
                                </svg>
                            </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0f0f1a] rounded-full"></span>
                    </div>
                    <div>
                        <h4 className="font-semibold text-xs text-[#e2e8f0] leading-tight tracking-wide">{agent?.name || "Riam Assistant"}</h4>
                        <span className="text-[10px] text-[#10b981] font-medium tracking-wide mt-0.5 block">
                            Online
                        </span>
                    </div>
                </div>
                
                {/* Close Button */}
                <button 
                    onClick={handleClose} 
                    className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-[#252542] transition-all active:scale-95 min-h-[38px] min-w-[38px] flex items-center justify-center"
                    aria-label="Close chat"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
                        className="bg-amber-950/20 border-b border-amber-900/35 px-4 py-2.5 flex items-start space-x-2 shrink-0"
                    >
                        <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                        <p className="text-[10px] text-amber-300 font-medium leading-relaxed">
                            Operator handoff active. A live assistant has been notified and will reply shortly.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Conversation Window */}
            <div className="flex-1 px-5 py-5 space-y-5 bg-[#0b0b14] scroll-container">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: "spring", damping: 25, stiffness: 250 }}
                            key={msg.id}
                            className={`flex flex-col ${msg.sender === "customer" ? "items-end" : "items-start"}`}
                        >
                            {/* Message Bubble */}
                            <div 
                                className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm font-normal tracking-wide transition-all duration-300
                                    ${msg.sender === "customer" 
                                        ? "bg-[#7c6af7] text-white rounded-tr-none" 
                                        : msg.sender === "human"
                                            ? "bg-[#1a1a2e] text-[#e2e8f0] rounded-tl-none border border-[#7c6af7]/20"
                                            : "bg-[#1a1a2e] text-[#e2e8f0] rounded-tl-none"
                                    }
                                `}
                                style={msg.sender === "customer" ? { background: primaryColor } : {}}
                            >
                                <div className="markdown-content">
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({children}) => (
                                                <p className="mb-2 last:mb-0">{children}</p>
                                            ),
                                            strong: ({children}) => (
                                                <strong className="font-semibold text-white">
                                                    {children}
                                                </strong>
                                            ),
                                            ul: ({children}) => (
                                                <ul className="list-disc list-inside mb-2 space-y-1">
                                                    {children}
                                                </ul>
                                            ),
                                            ol: ({children}) => (
                                                <ol className="list-decimal list-inside mb-2 space-y-1">
                                                    {children}
                                                </ol>
                                            ),
                                            li: ({children}) => (
                                                <li className="text-sm">{children}</li>
                                            ),
                                            code: ({children}) => (
                                                <code className="bg-[#0a0b0f] px-1.5 py-0.5 rounded text-[#7c6af7] text-xs font-mono">
                                                    {children}
                                                </code>
                                            ),
                                            a: ({href, children}) => (
                                                <a href={href} target="_blank" className="text-[#7c6af7] underline hover:opacity-80">
                                                    {children}
                                                </a>
                                            ),
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                            
                            {/* Timestamp - Positioned Below the Bubble */}
                            <span className="text-[10px] text-[#4e4e6a] font-medium mt-1 px-1 select-none">
                                {msg.sender === "human" && <span className="text-[#7c6af7] font-semibold uppercase mr-1">Operator &bull; </span>}
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Animated Typing dots */}
                <AnimatePresence>
                    {isLoading && (
                        <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="flex justify-start"
                        >
                            <div className="bg-[#1a1a2e] px-4 py-3 rounded-2xl rounded-tl-none flex items-center space-x-1.5 shadow-sm">
                                <motion.span 
                                    animate={{ y: [0, -4, 0] }}
                                    transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                                    className="w-1.5 h-1.5 bg-[#7c6af7] rounded-full"
                                />
                                <motion.span 
                                    animate={{ y: [0, -4, 0] }}
                                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.15 }}
                                    className="w-1.5 h-1.5 bg-[#7c6af7] rounded-full"
                                />
                                <motion.span 
                                    animate={{ y: [0, -4, 0] }}
                                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.3 }}
                                    className="w-1.5 h-1.5 bg-[#7c6af7] rounded-full"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Footer - Borderless inside Premium Dark */}
            <form 
                onSubmit={handleSubmit}
                className="px-4 py-3 bg-[#0f0f1a] border-t border-[#1e2330] flex items-center space-x-3 shrink-0"
            >
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isStreaming}
                    placeholder={placeholderText}
                    className="flex-1 px-3 py-2 bg-transparent border-0 focus:outline-none focus:ring-0 text-xs text-[#e2e8f0] placeholder-[#4e4e6a] font-medium min-h-[40px]"
                />
                
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={!input.trim() || isStreaming}
                    className="p-2.5 rounded-full text-white shadow-sm flex items-center justify-center active:scale-95 transition-all disabled:opacity-30 min-h-[38px] min-w-[38px]"
                    style={{ background: primaryColor }}
                    aria-label="Send"
                >
                    <svg className="w-4 h-4 transform rotate-90 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                </motion.button>
            </form>
        </div>
    );
}
