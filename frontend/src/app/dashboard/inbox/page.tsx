"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

// TypeScript interfaces
interface Agent {
    id: string;
    name: string;
    system_prompt: string;
    temperature: number;
    provider: string;
    config: {
        primaryColor?: string;
        welcomeMessage?: string;
    };
}

interface KnowledgeSource {
    id: string;
    name: string;
    source_type: "file" | "url";
    source_url?: string;
    status: "indexing" | "ready" | "failed";
    created_at: string;
}

interface Conversation {
    id: string;
    customer_name: string;
    customer_email?: string;
    status: "active" | "handoff" | "closed";
    created_at: string;
}

interface Message {
    id: string;
    sender: "customer" | "agent" | "human";
    content: string;
    created_at: string;
}

export default function RiamDashboard() {
    const backendUrl = "http://localhost:8000";
    const router = useRouter();
    const pathname = usePathname();
    const [activeTab] = useState<"agents" | "knowledge" | "inbox">("inbox");
    const [canGoBack, setCanGoBack] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Unified Business Context (dev-token authenticates as "org_dev_default_123" in backend dev fallback)
    const authHeaders = {
        "Authorization": "Bearer dev-token",
        "Content-Type": "application/json"
    };

    // --- Core States ---
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [knowledgeList, setKnowledgeList] = useState<KnowledgeSource[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    
    // --- Input Forms States ---
    // Agent Form
    const [agentName, setAgentName] = useState("");
    const [agentPrompt, setAgentPrompt] = useState("");
    const [agentColor, setAgentColor] = useState("#7c6af7");
    const [agentWelcome, setAgentWelcome] = useState("");
    const [agentProvider, setAgentProvider] = useState("groq");
    // Knowledge Base Form
    const [kbName, setKbName] = useState("");
    const [kbType, setKbType] = useState<"file" | "url" | "pdf">("url");
    const [kbUrl, setKbUrl] = useState("");
    const [kbText, setKbText] = useState("");
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [uploadingPdf, setUploadingPdf] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResult, setUploadResult] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    // Inbox Human reply
    const [humanReply, setHumanReply] = useState("");

    // --- API Loaders ---
    const loadAgents = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/v1/agents/`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json();
                setAgents(data);
                if (data.length > 0 && !selectedAgent) {
                    setSelectedAgent(data[0]);
                }
            }
        } catch (err) {
            console.error("Failed to load agents", err);
        }
    };

    const loadKnowledge = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/v1/knowledge/`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json();
                setKnowledgeList(data);
            }
        } catch (err) {
            console.error("Failed to load knowledge bases", err);
        }
    };

    const loadConversations = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/v1/conversations/`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
            }
        } catch (err) {
            console.error("Failed to load conversations", err);
        }
    };

    const loadConversationMessages = async (convId: string) => {
        try {
            const res = await fetch(`${backendUrl}/api/v1/conversations/${convId}/messages`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error("Failed to load message history", err);
        }
    };

    useEffect(() => {
        loadAgents();
        loadKnowledge();
        loadConversations();
    }, []);

    // Set document title
    useEffect(() => {
        document.title = "RIAM | Inbox Live Operator Console";
    }, []);

    // Keep active chat logs refreshed
    useEffect(() => {
        if (selectedConversation) {
            loadConversationMessages(selectedConversation.id);
            const interval = setInterval(() => {
                loadConversationMessages(selectedConversation.id);
            }, 3500);
            return () => clearInterval(interval);
        }
    }, [selectedConversation]);

    // Back Button navigation safety
    useEffect(() => {
        if (typeof window !== "undefined") {
            setCanGoBack(window.history.length > 1);
        }
    }, []);

    // Esc Key listener support (Capture Phase on Document)
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape" || e.keyCode === 27) {
                console.log("RIAM Dashboard: Escape key pressed, going back");
                router.back();
            }
        };
        document.addEventListener("keydown", handleEsc, true);
        return () => document.removeEventListener("keydown", handleEsc, true);
    }, [router]);

    // --- Action Handlers ---
    // Create support agent configuration
    const handleCreateAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agentName.trim() || !agentPrompt.trim()) return;

        try {
            const res = await fetch(`${backendUrl}/api/v1/agents/`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                    name: agentName,
                    system_prompt: agentPrompt,
                    temperature: 0.2,
                    provider: agentProvider,
                    config: {
                        primaryColor: agentColor,
                        welcomeMessage: agentWelcome || undefined
                    },
                    is_active: true
                })
            });

            if (res.ok) {
                const newAgent = await res.json();
                setAgents((prev) => [newAgent, ...prev]);
                setSelectedAgent(newAgent);
                setAgentName("");
                setAgentPrompt("");
                setAgentWelcome("");
                setAgentProvider("groq");
            }
        } catch (err) {
            console.error("Error creating agent", err);
        }
    };

    // Scrape URL knowledge base integration
    const handleAddKnowledge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!kbName.trim()) return;

        try {
            // 1. Create Placeholder
            const resPlaceholder = await fetch(`${backendUrl}/api/v1/knowledge/`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                    name: kbName,
                    source_type: kbType,
                    source_url: kbType === "url" ? kbUrl : null
                })
            });

            if (resPlaceholder.ok) {
                const kb = await resPlaceholder.json();
                setKnowledgeList((prev) => [kb, ...prev]);
                setKbName("");
                
                // 2. Trigger Scraper or Ingestion Service
                if (kbType === "url") {
                    setKbUrl("");
                    await fetch(`${backendUrl}/api/v1/knowledge/${kb.id}/urls`, {
                        method: "POST",
                        headers: authHeaders
                    });
                } else if (kbType === "pdf") {
                    if (!pdfFile) {
                        setUploadError("Please select a PDF file first.");
                        return;
                    }
                    setUploadingPdf(true);
                    setUploadError(null);
                    setUploadResult(null);

                    const formData = new FormData();
                    formData.append("file", pdfFile);

                    setUploadProgress(40);
                    try {
                        const uploadRes = await fetch(`${backendUrl}/api/v1/knowledge/upload/pdf?kb_id=${kb.id}`, {
                            method: "POST",
                            headers: {
                                "Authorization": "Bearer dev-token"
                            },
                            body: formData
                        });

                        setUploadProgress(100);
                        if (uploadRes.ok) {
                            const resultData = await uploadRes.json();
                            setUploadResult(`PDF indexed successfully. Created ${resultData.chunk_count} chunks.`);
                            setPdfFile(null);
                        } else {
                            const errorText = await uploadRes.text();
                            setUploadError(`Failed to upload PDF: ${errorText || uploadRes.statusText}`);
                        }
                    } catch (uploadErr: unknown) {
                        const errMsg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
                        setUploadError(`Network error: ${errMsg}`);
                    } finally {
                        setUploadingPdf(false);
                    }
                } else {
                    // Upload manual raw text
                    await fetch(`${backendUrl}/api/v1/knowledge/${kb.id}/files`, {
                        method: "POST",
                        headers: {
                            ...authHeaders,
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: new URLSearchParams({
                            "kb_id": kb.id,
                        })
                    });
                    setKbText("");
                }
                
                // Reload in 2 seconds to see Ready status
                setTimeout(loadKnowledge, 2500);
            }
        } catch (err) {
            console.error("Error adding knowledge", err);
        }
    };

    // Human intervenes and writes message to customer
    const handleHumanReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedConversation || !humanReply.trim()) return;

        try {
            // First post the human message to the DB
            const msgRes = await fetch(`${backendUrl}/api/v1/conversations/${selectedConversation.id}/messages`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                    sender: "human",
                    content: humanReply.trim()
                })
            });

            if (msgRes.ok) {
                // Ensure the status is set to handoff
                await fetch(`${backendUrl}/api/v1/conversations/${selectedConversation.id}`, {
                    method: "PATCH",
                    headers: authHeaders,
                    body: JSON.stringify({ status: "handoff" })
                });

                setHumanReply("");
                loadConversationMessages(selectedConversation.id);
            }
        } catch (err) {
            console.error("Failed to send human reply", err);
        }
    };

    const handleDeleteAgent = async (id: string, name: string) => {
        const confirmed = window.confirm(`Are you sure you want to delete the agent "${name}"? This cannot be undone.`);
        if (!confirmed) return;

        try {
            const res = await fetch(`${backendUrl}/api/v1/agents/${id}`, {
                method: "DELETE",
                headers: authHeaders
            });
            if (res.ok) {
                setAgents((prev) => prev.filter((item) => item.id !== id));
                if (selectedAgent?.id === id) {
                    setSelectedAgent(null);
                }
            } else {
                alert("Failed to delete the agent.");
            }
        } catch (err) {
            console.error("Error deleting agent:", err);
            alert("Error deleting agent.");
        }
    };


    // Close conversation ticket
    const handleCloseConversation = async (convId: string) => {
        try {
            const res = await fetch(`${backendUrl}/api/v1/conversations/${convId}`, {
                method: "PATCH",
                headers: authHeaders,
                body: JSON.stringify({ status: "closed" })
            });
            if (res.ok) {
                setConversations((prev) =>
                    prev.map((c) => (c.id === convId ? { ...c, status: "closed" } : c))
                );
                setSelectedConversation(null);
            }
        } catch (err) {
            console.error("Error closing conversation", err);
        }
    };

    return (
        <div className="flex h-screen bg-[#0a0b0f] text-[#e2e8f0] font-sans overflow-hidden">
            {/* Sidebar Backdrop Overlay on Mobile */}
            {isSidebarOpen && (
                <div 
                    onClick={() => setIsSidebarOpen(false)}
                    className="fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300"
                />
            )}

            {/* Sidebar Navigation */}
            <aside className={`fixed inset-y-0 left-0 z-50 bg-[#111318] border-r border-[#1e2330] flex flex-col justify-between transform transition-all duration-300 ease-in-out group
                ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                md:static md:translate-x-0 md:w-12 md:hover:w-60 lg:w-60
            `}>
                <div className="p-6 md:p-3 lg:p-6 group-hover:md:p-6 transition-all duration-300 overflow-hidden">
                    {/* Logo Section - Minimal "RIAM" wordmark */}
                    <Link href="/" className="flex items-center space-x-2 mb-8 h-8 overflow-hidden hover:opacity-80 transition-all cursor-pointer">
                        <span className="text-sm font-light tracking-[0.25em] text-[#e2e8f0] whitespace-nowrap">
                            <span className="font-extralight text-[#8892a4]">R</span>
                            <span className="md:hidden lg:inline group-hover:md:inline transition-all duration-300">IAM</span>
                        </span>
                    </Link>

                    <nav className="space-y-1">
                        <Link
                            href="/dashboard/knowledge"
                            className={`w-full flex items-center space-x-3 px-4 py-3.5 md:px-1.5 md:py-2.5 lg:px-4 lg:py-3.5 group-hover:md:px-4 group-hover:md:py-3.5 text-xs font-medium tracking-wide transition-all duration-300 border-l-2 min-h-[44px] ${pathname.includes("/knowledge") ? "border-[#7c6af7] bg-[#7c6af7]/5 text-[#e2e8f0]" : "border-transparent text-[#8892a4] hover:text-[#e2e8f0]"}`}
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-16.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-16.25v16.25" />
                            </svg>
                            <span className="md:hidden lg:inline group-hover:md:inline transition-all duration-300 whitespace-nowrap">KNOWLEDGE HUB</span>
                        </Link>

                        <Link
                            href="/dashboard"
                            className={`w-full flex items-center space-x-3 px-4 py-3.5 md:px-1.5 md:py-2.5 lg:px-4 lg:py-3.5 group-hover:md:px-4 group-hover:md:py-3.5 text-xs font-medium tracking-wide transition-all duration-300 border-l-2 min-h-[44px] ${pathname === "/dashboard" ? "border-[#7c6af7] bg-[#7c6af7]/5 text-[#e2e8f0]" : "border-transparent text-[#8892a4] hover:text-[#e2e8f0]"}`}
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M21 12H3M12 3v18" />
                            </svg>
                            <span className="md:hidden lg:inline group-hover:md:inline transition-all duration-300 whitespace-nowrap">AGENTS DESIGNER</span>
                        </Link>

                        <Link
                            href="/dashboard/inbox"
                            className={`w-full flex items-center space-x-3 px-4 py-3.5 md:px-1.5 md:py-2.5 lg:px-4 lg:py-3.5 group-hover:md:px-4 group-hover:md:py-3.5 text-xs font-medium tracking-wide transition-all duration-300 border-l-2 min-h-[44px] ${pathname.includes("/inbox") ? "border-[#7c6af7] bg-[#7c6af7]/5 text-[#e2e8f0]" : "border-transparent text-[#8892a4] hover:text-[#e2e8f0]"}`}
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                            <span className="flex-1 text-left md:hidden lg:inline group-hover:md:inline transition-all duration-300 whitespace-nowrap">INBOX SUPPORT</span>
                            {conversations.filter(c => c.status === "handoff").length > 0 && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#7c6af7]/10 text-[#7c6af7] border border-[#7c6af7]/20 shrink-0 md:hidden lg:inline group-hover:md:inline">
                                    {conversations.filter(c => c.status === "handoff").length}
                                </span>
                            )}
                        </Link>

                        <Link
                            href="/dashboard/analytics"
                            className={`w-full flex items-center space-x-3 px-4 py-3.5 md:px-1.5 md:py-2.5 lg:px-4 lg:py-3.5 group-hover:md:px-4 group-hover:md:py-3.5 text-xs font-medium tracking-wide transition-all duration-300 border-l-2 min-h-[44px] ${pathname.includes("/analytics") ? "border-[#7c6af7] bg-[#7c6af7]/5 text-[#e2e8f0]" : "border-transparent text-[#8892a4] hover:text-[#e2e8f0]"}`}
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 18.375v-5.25zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-9.75zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                            </svg>
                            <span className="md:hidden lg:inline group-hover:md:inline transition-all duration-300 whitespace-nowrap">ANALYTICS</span>
                        </Link>
                    </nav>
                </div>

                <div className="flex flex-col space-y-1">
                    {/* Keyboard Shortcuts Hint */}
                    <div className="px-6 py-2.5 text-[9px] font-mono text-[#4a5568] uppercase tracking-wider text-center border-t border-[#1e2330]/40 md:hidden lg:block group-hover:md:block whitespace-nowrap transition-all duration-300">
                        ESC to close &middot; ⌘K to search
                    </div>

                    {/* Footer User Section */}
                    <div className="p-6 md:p-3 lg:p-6 group-hover:md:p-6 border-t border-[#1e2330] transition-all duration-300 overflow-hidden">
                        <div className="flex items-center space-x-3">
                            <div className="text-xs font-bold text-[#e2e8f0] border border-[#1e2330] w-8 h-8 rounded-full flex items-center justify-center shrink-0">MH</div>
                            <div className="md:hidden lg:block group-hover:md:block transition-all duration-300 whitespace-nowrap">
                                <h5 className="text-[11px] font-medium tracking-wide text-[#e2e8f0]">Mariam Hagag</h5>
                                <span className="text-[10px] text-[#8892a4] block">Owner</span>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0b0f]">
                <header className="h-16 border-b border-[#1e2330] px-4 md:px-8 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        {/* Hamburger Button on Mobile */}
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden p-2 text-[#8892a4] hover:text-[#e2e8f0] transition-chic min-h-[44px] min-w-[44px] flex items-center justify-center"
                            aria-label="Open menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>
                        {canGoBack && (
                            <button 
                                onClick={() => router.back()}
                                className="flex items-center space-x-1.5 text-xs text-[#8892a4] hover:text-[#e2e8f0] transition-chic min-h-[44px]"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                </svg>
                                <span className="text-[10px] uppercase tracking-widest font-semibold">Back</span>
                            </button>
                        )}
                        <h2 className="text-[10px] uppercase tracking-[0.2em] font-medium text-[#8892a4] truncate">
                            Inbox Live Operator Console
                        </h2>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"/>
                        <span className="text-[10px] tracking-wide text-[#8892a4] uppercase font-semibold">Connected</span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    
                    <AnimatePresence mode="wait">
                    {/* TAB 1: AGENTS DESIGNER */}
                    {activeTab === "agents" && (
                        <motion.div 
                            key="agents"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="grid grid-cols-1 md:grid-cols-12 gap-8"
                        >
                            {/* Left panel: spacious minimal form */}
                            <div className="md:col-span-7 lg:col-span-8 bg-[#111318] border border-[#1e2330] rounded-xl p-4 md:p-8 space-y-8 glass-panel">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#7c6af7]">AGENT ORCHESTRATION</span>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#e2e8f0]">Configure Support Agent</h3>
                                </div>
                                <form onSubmit={handleCreateAgent} className="space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5568]">Agent Name</label>
                                            <input 
                                                type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)}
                                                placeholder="e.g. Technical Support Bot"
                                                className="w-full bg-[#181c24] border border-[#1e2330] focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7]/20 focus:outline-none rounded px-4 py-2.5 text-xs text-[#e2e8f0] transition-chic min-h-[44px]"
                                            />
                                        </div>
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5568]">Primary Color</label>
                                            <div className="flex items-center space-x-3 h-[44px]">
                                                <input 
                                                    type="color" value={agentColor} onChange={(e) => setAgentColor(e.target.value)}
                                                    className="w-8 h-8 bg-transparent border border-[#1e2330] rounded-lg cursor-pointer transition-transform hover:scale-105"
                                                />
                                                <span className="text-xs font-mono text-[#8892a4] uppercase">{agentColor}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col space-y-2">
                                        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5568]">Welcome Message</label>
                                        <input 
                                            type="text" value={agentWelcome} onChange={(e) => setAgentWelcome(e.target.value)}
                                            placeholder="Hello! How can we assist you today?"
                                            className="w-full bg-[#181c24] border border-[#1e2330] focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7]/20 focus:outline-none rounded px-4 py-2.5 text-xs text-[#e2e8f0] transition-chic min-h-[44px]"
                                        />
                                    </div>

                                    <div className="flex flex-col space-y-2">
                                        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5568]">LLM Provider</label>
                                        <div className="relative">
                                            <select 
                                                value={agentProvider} 
                                                onChange={(e) => setAgentProvider(e.target.value)}
                                                className="w-full appearance-none px-4 py-2.5 bg-[#181c24] border border-[#1e2330] focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7]/20 focus:outline-none rounded text-xs text-[#e2e8f0] cursor-pointer transition-chic min-h-[44px]"
                                            >
                                                <option value="groq">Groq (default)</option>
                                                <option value="gemini" disabled className="opacity-55 text-gray-500">Google Gemini (Soon)</option>
                                                <option value="openai" disabled className="opacity-55 text-gray-500">OpenAI GPT-4o (Soon)</option>
                                                <option value="anthropic" disabled className="opacity-55 text-gray-500">Anthropic Claude (Soon)</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[#8892a4]">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col space-y-2">
                                        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5568]">System Prompt instructions</label>
                                        <textarea 
                                            rows={6} value={agentPrompt} onChange={(e) => setAgentPrompt(e.target.value)}
                                            placeholder="You are a helpful customer support representative. You will answer questions based strictly on the provided knowledge bases. If you are unsure or the context is missing, apologize and direct them to human support."
                                            className="w-full bg-[#181c24] border border-[#1e2330] focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7]/20 focus:outline-none rounded px-4 py-2.5 text-xs text-[#e2e8f0] resize-none transition-chic"
                                        />
                                    </div>

                                    <button 
                                        type="submit"
                                        className="w-full sm:w-auto px-5 py-3.5 bg-[#7c6af7] hover:bg-[#6b5ce7] text-white font-bold rounded text-[10px] tracking-widest uppercase transition-chic shadow-lg shadow-[#7c6af7]/10 min-h-[44px] hover-swipe hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        Save & Compile Support Agent
                                    </button>
                                </form>
                            </div>

                            {/* Right panel: Embed script (top) & active agents (bottom) */}
                            <div className="md:col-span-5 lg:col-span-4 space-y-6">
                                <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-6 shadow-xl space-y-4 glass-panel">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#e2e8f0]">Copy Embed Script</h4>
                                    <p className="text-xs text-[#8892a4] leading-relaxed">
                                        Place this lightweight JS script tag right before the closing HTML body tag on your business website to deploy the support chat widget instantly.
                                    </p>
                                    
                                    {selectedAgent ? (
                                        <div className="space-y-3">
                                            <div className="bg-[#0a0b0f] border border-[#1e2330] rounded-lg p-3.5 font-mono text-[10px] leading-relaxed select-all text-[#e2e8f0] break-all border-dashed">
                                                {`<!-- Riam Chat Bubble embed -->\n<script\n  src="http://localhost:3000/widget.js"\n  data-agent-id="${selectedAgent.id}"\n  data-backend-url="http://localhost:8000">\n</script>`}
                                            </div>
                                            <span className="text-[10px] text-[#7c6af7] font-semibold block">
                                                Injected with custom primary color theme dynamically.
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-[#4a5568] italic py-4 text-center">
                                            Compile an agent configuration to build your copy-paste widget code.
                                        </div>
                                    )}
                                </div>

                                {/* Active List */}
                                <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-6 shadow-xl space-y-3 glass-panel">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#e2e8f0]">Active Agents ({agents.length})</h4>
                                    <div className="space-y-2">
                                        {agents.map((ag, index) => (
                                            <motion.div 
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.2 }}
                                                whileHover={{ scale: 1.01, borderColor: "rgba(124, 106, 247, 0.3)" }}
                                                key={ag.id} onClick={() => setSelectedAgent(ag)}
                                                className={`p-3.5 rounded-lg border cursor-pointer transition-chic flex items-center justify-between min-h-[44px] ${selectedAgent?.id === ag.id ? "bg-[#181c24] border-[#7c6af7]/35 shadow-md shadow-[#7c6af7]/5" : "bg-[#0a0b0f]/40 border-[#1e2330] hover:border-[#8892a4]/30 hover:bg-[#111318]"}`}
                                            >
                                                <div>
                                                    <h5 className="text-xs font-bold text-[#e2e8f0]">{ag.name}</h5>
                                                    <span className="text-[9px] text-[#4a5568] font-mono">ID: {ag.id.slice(0, 8)}...</span>
                                                </div>
                                                
                                                <div className="flex items-center space-x-2 shrink-0">
                                                    <span 
                                                        className="w-2.5 h-2.5 rounded-full border border-[#1e2330]"
                                                        style={{ background: ag.config?.primaryColor || "#7c6af7" }}
                                                    ></span>
                                                    
                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteAgent(ag.id, ag.name);
                                                        }}
                                                        className="p-1 text-[#8892a4] hover:text-[#ef4444] transition-all rounded shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center"
                                                        title="Delete agent"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}

                                        {agents.length === 0 && (
                                            /* Robot empty state illustration */
                                            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                                                <svg className="w-20 h-20 text-[#2a3045]" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                                                    <rect x="5" y="8" width="14" height="11" rx="2" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h.01M15 13h.01M8 17h8M12 5v3m-3-3h6" />
                                                    <circle cx="9" cy="5" r="1" />
                                                    <circle cx="15" cy="5" r="1" />
                                                </svg>
                                                <div className="space-y-1">
                                                    <h5 className="text-xs font-semibold text-[#e2e8f0]">Nothing here yet</h5>
                                                    <p className="text-[10px] text-[#8892a4] max-w-[180px]">No agents deployed yet. Configure and compile your first support agent on the left.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* TAB 2: KNOWLEDGE HUB */}
                    {activeTab === "knowledge" && (
                        <motion.div 
                            key="knowledge"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="grid grid-cols-1 md:grid-cols-12 gap-8"
                        >
                            {/* Left panel: clean spacious form */}
                            <div className="md:col-span-7 lg:col-span-8 bg-[#111318] border border-[#1e2330] rounded-xl p-4 md:p-8 space-y-8 glass-panel">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[#7c6af7]">VECTOR DATABASES</span>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#e2e8f0]">Ingest New Knowledge Source</h3>
                                </div>
                                <form onSubmit={handleAddKnowledge} className="space-y-6">
                                    <div className="flex flex-col space-y-2">
                                        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5568]">Source Name</label>
                                        <input 
                                            type="text" value={kbName} onChange={(e) => setKbName(e.target.value)}
                                            placeholder="e.g. Return Policy Document"
                                            className="w-full bg-[#181c24] border border-[#1e2330] focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7]/20 focus:outline-none rounded px-4 py-2.5 text-xs text-[#e2e8f0] transition-chic min-h-[44px]"
                                        />
                                    </div>

                                    <div className="flex flex-col space-y-2.5">
                                        <label className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5568]">Medium Type</label>
                                        {/* Tab underline style selection */}
                                        <div className="flex items-center space-x-6 border-b border-[#1e2330] pb-px overflow-x-auto whitespace-nowrap w-full scrollbar-none scroll-smooth">
                                            <button 
                                                type="button" onClick={() => setKbType("url")}
                                                className={`pb-2.5 text-[10px] font-bold tracking-widest uppercase transition-chic border-b-2 shrink-0 min-h-[44px] ${kbType === "url" ? "border-[#7c6af7] text-[#e2e8f0]" : "border-transparent text-[#8892a4] hover:text-[#e2e8f0]"}`}
                                            >
                                                Web URL
                                            </button>
                                            <button 
                                                type="button" onClick={() => setKbType("file")}
                                                className={`pb-2.5 text-[10px] font-bold tracking-widest uppercase transition-chic border-b-2 shrink-0 min-h-[44px] ${kbType === "file" ? "border-[#7c6af7] text-[#e2e8f0]" : "border-transparent text-[#8892a4] hover:text-[#e2e8f0]"}`}
                                            >
                                                Text File
                                            </button>
                                            <button 
                                                type="button" onClick={() => setKbType("pdf")}
                                                className={`pb-2.5 text-[10px] font-bold tracking-widest uppercase transition-chic border-b-2 shrink-0 min-h-[44px] ${kbType === "pdf" ? "border-[#7c6af7] text-[#e2e8f0]" : "border-transparent text-[#8892a4] hover:text-[#e2e8f0]"}`}
                                            >
                                                PDF Document
                                            </button>
                                        </div>
                                    </div>

                                    {kbType === "url" && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex flex-col space-y-2"
                                        >
                                            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5568]">Scrape Target URL</label>
                                            <input 
                                                type="url" value={kbUrl} onChange={(e) => setKbUrl(e.target.value)}
                                                placeholder="https://example.com/shipping-refunds"
                                                className="w-full bg-[#181c24] border border-[#1e2330] focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7]/20 focus:outline-none rounded px-4 py-2.5 text-xs text-[#e2e8f0] transition-chic min-h-[44px]"
                                            />
                                        </motion.div>
                                    )}

                                    {kbType === "file" && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex flex-col space-y-2"
                                        >
                                            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5568]">Document Text Payload</label>
                                            <textarea 
                                                rows={5} value={kbText} onChange={(e) => setKbText(e.target.value)}
                                                placeholder="Write or paste raw text contents of your company policy here..."
                                                className="w-full bg-[#181c24] border border-[#1e2330] focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7]/20 focus:outline-none rounded px-4 py-2.5 text-xs text-[#e2e8f0] resize-none transition-chic"
                                            />
                                        </motion.div>
                                    )}

                                    {kbType === "pdf" && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex flex-col space-y-2.5 bg-[#0a0b0f]/45 p-4 rounded border border-[#1e2330]"
                                        >
                                            <label className="text-[10px] font-semibold uppercase tracking-widest text-[#4a5568]">PDF File Upload</label>
                                            <input 
                                                type="file" 
                                                accept=".pdf"
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files.length > 0) {
                                                        const file = e.target.files[0];
                                                        if (file.size > 10 * 1024 * 1024) {
                                                            setUploadError("File size exceeds 10MB limit.");
                                                            setPdfFile(null);
                                                        } else {
                                                            setPdfFile(file);
                                                            setUploadError(null);
                                                            setUploadResult(null);
                                                        }
                                                    }
                                                }}
                                                className="block w-full text-xs text-[#8892a4] file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-[#111318] file:text-[#7c6af7] hover:file:bg-[#181c24] cursor-pointer file:cursor-pointer transition-chic min-h-[44px]"
                                            />
                                            <span className="text-[10px] text-[#4a5568]">Maximum file size: 10MB. File type must be PDF.</span>
                                            
                                            {/* Progress / Status Indicators */}
                                            {uploadingPdf && (
                                                <div className="space-y-1 w-full pt-2">
                                                    <div className="flex justify-between text-[10px] text-[#8892a4] font-semibold">
                                                        <span>Uploading and Indexing...</span>
                                                        <span>{uploadProgress}%</span>
                                                    </div>
                                                    <div className="w-full bg-[#181c24] rounded-full h-1 overflow-hidden">
                                                        <div 
                                                            className="bg-[#7c6af7] h-1 transition-all duration-300"
                                                            style={{ width: `${uploadProgress}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}

                                            {uploadResult && (
                                                <div className="p-2.5 bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] rounded text-xs font-medium mt-1">
                                                    Success: {uploadResult}
                                                </div>
                                            )}

                                            {uploadError && (
                                                <div className="p-2.5 bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] rounded text-xs font-medium mt-1">
                                                    Error: {uploadError}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    <button 
                                        type="submit"
                                        className="w-full sm:w-auto px-5 py-3.5 bg-[#7c6af7] hover:bg-[#6b5ce7] text-white font-bold rounded text-[10px] tracking-widest uppercase transition-chic shadow-lg shadow-[#7c6af7]/10 min-h-[44px] hover-swipe hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        Trigger Vector Ingestion Pipeline
                                    </button>
                                </form>
                            </div>

                            {/* Status tracker sidebar card */}
                            <div className="md:col-span-5 lg:col-span-4 bg-[#111318] border border-[#1e2330] rounded-xl p-6 shadow-xl space-y-4 glass-panel">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[#e2e8f0]">Vector Storage Index ({knowledgeList.length})</h3>
                                <div className="space-y-3">
                                    {knowledgeList.map((kb, index) => (
                                        <motion.div 
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.2 }}
                                            whileHover={{ scale: 1.01, borderColor: "rgba(124, 106, 247, 0.3)" }}
                                            key={kb.id} 
                                            className="p-3.5 bg-[#0a0b0f] border border-[#1e2330] rounded-lg space-y-2 relative overflow-hidden transition-chic hover:bg-[#111318]"
                                        >
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-xs font-bold truncate max-w-[70%] text-[#e2e8f0]">{kb.name}</h5>
                                                
                                                {/* Ingestion status pills without background */}
                                                {kb.status === "indexing" && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 text-[#f59e0b] border border-[#f59e0b]/20 rounded uppercase tracking-wider animate-pulse">
                                                        Indexing
                                                    </span>
                                                )}
                                                {kb.status === "ready" && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 text-[#10b981] border border-[#10b981]/20 rounded uppercase tracking-wider">
                                                        Ready
                                                    </span>
                                                )}
                                                {kb.status === "failed" && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 text-[#ef4444] border border-[#ef4444]/20 rounded uppercase tracking-wider">
                                                        Failed
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-center text-[9px] text-[#4a5568] font-mono">
                                                <span>TYPE: {kb.source_type.toUpperCase()}</span>
                                                <span>{new Date(kb.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {knowledgeList.length === 0 && (
                                        /* Stack document/db outline illustration */
                                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-fadeIn">
                                            <svg className="w-20 h-20 text-[#2a3045]" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                                                <ellipse cx="12" cy="5" rx="8" ry="3.5" />
                                                <path d="M4 5v6c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5V5" />
                                                <path d="M4 11v6c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5v-6" />
                                            </svg>
                                            <div className="space-y-1">
                                                <h5 className="text-xs font-semibold text-[#e2e8f0]">Nothing here yet</h5>
                                                <p className="text-[10px] text-[#8892a4] max-w-[180px]">No knowledge sources indexed. Ingest policies or documents to populate the vector storage.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}                    {/* TAB 3: INBOX LIVE SUPPORT TICKET MANAGEMENT */}
                    {activeTab === "inbox" && (
                        <motion.div 
                            key="inbox"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[calc(100vh-14rem)]"
                        >
                            {/* Conversations Left Panel List */}
                            <div className={`bg-[#111318] border border-[#1e2330] rounded-xl p-4 shadow-xl overflow-y-auto space-y-3 glass-panel ${selectedConversation ? "hidden md:block" : "block"}`}>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[#e2e8f0] px-2 mb-2">Inbox Conversations</h3>
                                <div className="space-y-2">
                                    {conversations.map((conv, index) => (
                                        <motion.div 
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.2 }}
                                            whileHover={{ scale: 1.01, borderColor: "rgba(124, 106, 247, 0.3)" }}
                                            key={conv.id} onClick={() => setSelectedConversation(conv)}
                                            className={`p-3.5 rounded-lg border cursor-pointer transition-chic space-y-2 min-h-[44px] ${selectedConversation?.id === conv.id ? "bg-[#181c24] border-[#7c6af7]/35 shadow-md shadow-[#7c6af7]/5" : "bg-[#0a0b0f]/40 border-[#1e2330] hover:border-[#8892a4]/30 hover:bg-[#111318]"}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-xs font-bold text-[#e2e8f0]">{conv.customer_name}</h5>
                                                
                                                {/* Status markers - simple borders, no colored background */}
                                                {conv.status === "handoff" && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 border border-[#f59e0b]/20 text-[#f59e0b] rounded tracking-wider uppercase animate-pulse">
                                                        Handoff
                                                    </span>
                                                )}
                                                {conv.status === "active" && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 border border-[#7c6af7]/20 text-[#7c6af7] rounded tracking-wider uppercase">
                                                        AI Active
                                                    </span>
                                                )}
                                                {conv.status === "closed" && (
                                                    <span className="text-[9px] font-medium px-1.5 py-0.5 border border-[#1e2330] text-[#4a5568] rounded tracking-wider uppercase">
                                                        Closed
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[9px] text-[#4a5568] truncate font-mono">
                                                ID: {conv.id}
                                            </div>
                                        </motion.div>
                                    ))}
                                    {conversations.length === 0 && (
                                        /* Tray outline illustration */
                                        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 animate-fadeIn">
                                            <svg className="w-20 h-20 text-[#2a3045]" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.008 1.24l.885 1.77a2.25 2.25 0 002.007 1.24h1.98a2.25 2.25 0 002.007-1.24l.885-1.77a2.25 2.25 0 012.007-1.24h3.86m-18 0h18M2.25 13.5l1.626-5.693A2.25 2.25 0 016.03 6.25h11.94a2.25 2.25 0 012.155 1.557l1.626 5.693M2.25 13.5v5.25A2.25 2.25 0 004.5 21h15a2.25 2.25 0 002.25-2.25V13.5" />
                                            </svg>
                                            <div className="space-y-1">
                                                <h5 className="text-xs font-semibold text-[#e2e8f0]">Nothing here yet</h5>
                                                <p className="text-[10px] text-[#8892a4] max-w-[180px]">No support tickets yet. Active customer support chats demanding handoff will log here.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Chat Logs Middle Panel */}
                            <div className={`md:col-span-2 bg-[#111318] border border-[#1e2330] rounded-xl flex flex-col shadow-xl overflow-hidden h-full glass-panel ${selectedConversation ? "flex" : "hidden md:flex"}`}>
                                {selectedConversation ? (
                                    <>
                                        {/* Chat ticket header details */}
                                        <div className="px-6 py-4 bg-[#181c24]/50 border-b border-[#1e2330] flex items-center justify-between">
                                            <div className="flex items-center">
                                                {/* Back Button (Mobile Only) */}
                                                <button 
                                                    onClick={() => setSelectedConversation(null)}
                                                    className="md:hidden flex items-center space-x-1.5 text-xs text-[#8892a4] hover:text-[#e2e8f0] mr-3 min-h-[44px] min-w-[44px]"
                                                    aria-label="Back to conversations list"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                                    </svg>
                                                    <span>Back</span>
                                                </button>
                                                <div>
                                                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#e2e8f0]">{selectedConversation.customer_name}</h4>
                                                    <span className="text-[10px] text-[#4a5568] font-mono">SESSION: {selectedConversation.id}</span>
                                                </div>
                                            </div>

                                            {/* Action takeover buttons */}
                                            <div className="flex items-center space-x-3">
                                                {selectedConversation.status !== "closed" && (
                                                    <button 
                                                        onClick={() => handleCloseConversation(selectedConversation.id)}
                                                        className="px-3 py-1.5 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/20 rounded text-[10px] font-bold uppercase tracking-widest transition-chic min-h-[44px] hover:scale-[1.02] active:scale-[0.98]"
                                                    >
                                                        Close Ticket
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Ticket Message Logs */}
                                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#0a0b0f]/30 scrollbar-thin">
                                            {messages.map((msg) => (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                                    key={msg.id}
                                                    className={`flex ${msg.sender === "customer" ? "justify-start" : "justify-end"}`}
                                                >
                                                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm leading-relaxed
                                                        ${msg.sender === "customer" 
                                                            ? "bg-[#181c24] border border-[#1e2330] text-[#e2e8f0] rounded-bl-none" 
                                                            : msg.sender === "human"
                                                                ? "bg-[#7c6af7] text-white rounded-br-none"
                                                                : "bg-[#111318] border border-[#1e2330] text-[#8892a4] rounded-br-none"
                                                        }
                                                    `}>
                                                        <span className="text-[8px] font-bold block text-[#7c6af7] uppercase tracking-widest mb-1 select-none">
                                                            {msg.sender === "customer" ? "Customer" : msg.sender === "human" ? "Operator" : "AI Assistant"}
                                                        </span>
                                                        {msg.content}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>

                                        {/* Human Takeover Reply Box */}
                                        {selectedConversation.status !== "closed" && (
                                            <form 
                                                onSubmit={handleHumanReply}
                                                className="px-5 py-3.5 bg-[#181c24]/50 border-t border-[#1e2330] flex items-center space-x-3"
                                            >
                                                <input
                                                    type="text" value={humanReply} onChange={(e) => setHumanReply(e.target.value)}
                                                    placeholder="Send human message (takeover control)..."
                                                    className="flex-1 px-4 py-2.5 bg-[#0a0b0f] border border-[#1e2330] focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af7]/20 focus:outline-none rounded text-xs text-[#e2e8f0] transition-chic min-h-[44px]"
                                                />
                                                <button
                                                    type="submit" disabled={!humanReply.trim()}
                                                    className="px-4 py-2.5 bg-[#7c6af7] hover:bg-[#6b5ce7] active:scale-95 disabled:opacity-40 disabled:scale-100 text-white text-xs font-semibold rounded tracking-wider uppercase transition-chic shadow-lg shadow-[#7c6af7]/10 min-h-[44px] hover:scale-[1.02]"
                                                >
                                                    Send
                                                </button>
                                            </form>
                                        )}
                                    </>
                                ) : (
                                    /* Tray outline empty state */
                                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4 animate-fadeIn">
                                        <svg className="w-20 h-20 text-[#2a3045]" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.008 1.24l.885 1.77a2.25 2.25 0 002.007 1.24h1.98a2.25 2.25 0 002.007-1.24l.885-1.77a2.25 2.25 0 012.007-1.24h3.86m-18 0h18M2.25 13.5l1.626-5.693A2.25 2.25 0 016.03 6.25h11.94a2.25 2.25 0 012.155 1.557l1.626 5.693M2.25 13.5v5.25A2.25 2.25 0 004.5 21h15a2.25 2.25 0 002.25-2.25V13.5" />
                                        </svg>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-semibold text-[#e2e8f0]">Nothing here yet</h4>
                                            <p className="text-[10px] text-[#8892a4] max-w-[220px]">Select a conversation ticket from the inbox to audit chat logs and takeover control.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
