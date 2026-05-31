"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// TypeScript Interfaces matching Backend Schemas
interface OverviewMetrics {
    total_conversations: number;
    resolved_count: number;
    escalated_count: number;
    active_count: number;
    total_messages: number;
    avg_messages_per_conversation: number;
    total_knowledge_bases: number;
    total_agents: number;
}

interface ConversationItem {
    id: string;
    agent_name: string;
    status: "active" | "handoff" | "closed";
    message_count: number;
    created_at: string;
}

export default function RiamAnalytics() {
    const backendUrl = "http://localhost:8000";
    const router = useRouter();
    const pathname = usePathname();
    const [canGoBack, setCanGoBack] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const authHeaders = {
        "Authorization": "Bearer dev-token",
        "Content-Type": "application/json"
    };

    // States
    const [overview, setOverview] = useState<OverviewMetrics | null>(null);
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [loadingOverview, setLoadingOverview] = useState(true);
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Sidebar active takeover alert pill
    const [escalatedCount, setEscalatedCount] = useState(0);

    const loadOverview = async () => {
        try {
            setLoadingOverview(true);
            const res = await fetch(`${backendUrl}/api/v1/analytics/overview`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json();
                setOverview(data);
                setEscalatedCount(data.escalated_count);
            } else {
                setError("Failed to fetch metric stats.");
            }
        } catch (err) {
            console.error("Failed to load metrics overview", err);
            setError("Failed to connect to backend server.");
        } finally {
            setLoadingOverview(false);
        }
    };

    const loadConversations = async () => {
        try {
            setLoadingConvs(true);
            const res = await fetch(`${backendUrl}/api/v1/analytics/conversations?page=${page}&page_size=${pageSize}`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json();
                setConversations(data.items);
                setTotalItems(data.total);
            }
        } catch (err) {
            console.error("Failed to load conversations metrics", err);
        } finally {
            setLoadingConvs(false);
        }
    };

    useEffect(() => {
        loadOverview();
    }, []);

    // Set document title
    useEffect(() => {
        document.title = "RIAM | Operational Inbox Analytics";
    }, []);

    useEffect(() => {
        loadConversations();
    }, [page]);

    // Back Button navigation safety
    useEffect(() => {
        if (typeof window !== "undefined") {
            setCanGoBack(window.history.length > 1);
        }
    }, []);

    // Esc Key listener support
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape" || e.keyCode === 27) {
                console.log("RIAM Analytics: Escape key pressed, going back");
                router.back();
            }
        };
        document.addEventListener("keydown", handleEsc, true);
        return () => document.removeEventListener("keydown", handleEsc, true);
    }, [router]);

    const totalPages = Math.ceil(totalItems / pageSize);

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
                            {escalatedCount > 0 && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#7c6af7]/10 text-[#7c6af7] border border-[#7c6af7]/20 shrink-0 md:hidden lg:inline group-hover:md:inline">
                                    {escalatedCount}
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

                    {/* Footer User Profile */}
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
                            Operational Inbox Analytics
                        </h2>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"/>
                        <span className="text-[10px] tracking-wide text-[#8892a4] uppercase font-semibold">Connected</span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
                    {/* Error Alerts */}
                    {error && (
                        <div className="px-4 py-3 border-l-2 border-[#f59e0b] bg-transparent text-[#f59e0b] text-xs font-semibold flex items-center space-x-2.5 rounded-none">
                            <svg className="w-4 h-4 text-[#f59e0b] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>Error: {error}</span>
                        </div>
                    )}                     {/* TOP ROW: 4 KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        {/* 1. Total Conversations */}
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 120, damping: 20 }}
                            whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(124, 106, 247, 0.3)" }}
                            className="bg-[#111318] border border-[#1e2330] rounded-xl p-4 md:p-6 shadow-xl relative overflow-hidden transition-chic glass-panel cursor-pointer hover:shadow-lg hover:shadow-[#7c6af7]/5 gradient-border-hover"
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8892a4]">Total Conversations</span>
                                    {loadingOverview ? (
                                        <div className="h-9 w-20 animate-shimmer-bg rounded"></div>
                                    ) : (
                                        <motion.h3 
                                            initial={{ scale: 0.9 }}
                                            animate={{ scale: 1 }}
                                            className="text-2xl md:text-3xl font-light text-[#e2e8f0]"
                                        >
                                            {overview?.total_conversations ?? 0}
                                        </motion.h3>
                                    )}
                                </div>
                                <div className="text-[#8892a4] shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-4 text-[9px] md:text-[10px] text-[#4a5568] font-semibold uppercase tracking-wider truncate">
                                Avg: {overview?.avg_messages_per_conversation ?? 0.0} msg/chat
                            </div>
                        </motion.div>

                        {/* 2. Resolved Count */}
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.05 }}
                            whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(16, 185, 129, 0.3)" }}
                            className="bg-[#111318] border border-[#1e2330] rounded-xl p-4 md:p-6 shadow-xl relative overflow-hidden transition-chic glass-panel cursor-pointer hover:shadow-lg hover:shadow-[#10b981]/5 gradient-border-hover"
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8892a4]">Resolved</span>
                                    {loadingOverview ? (
                                        <div className="h-9 w-20 animate-shimmer-bg rounded"></div>
                                    ) : (
                                        <motion.h3 
                                            initial={{ scale: 0.9 }}
                                            animate={{ scale: 1 }}
                                            className="text-2xl md:text-3xl font-light text-[#10b981]"
                                        >
                                            {overview?.resolved_count ?? 0}
                                        </motion.h3>
                                    )}
                                </div>
                                <div className="text-[#10b981] shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-4 text-[9px] md:text-[10px] text-[#10b981] font-semibold uppercase tracking-wider truncate">
                                Resolved Tickets
                            </div>
                        </motion.div>

                        {/* 3. Escalated (handoff) Count */}
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.1 }}
                            whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(245, 158, 11, 0.3)" }}
                            className="bg-[#111318] border border-[#1e2330] rounded-xl p-4 md:p-6 shadow-xl relative overflow-hidden transition-chic glass-panel cursor-pointer hover:shadow-lg hover:shadow-[#f59e0b]/5 gradient-border-hover"
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8892a4]">Escalated</span>
                                    {loadingOverview ? (
                                        <div className="h-9 w-20 animate-shimmer-bg rounded"></div>
                                    ) : (
                                        <motion.h3 
                                            initial={{ scale: 0.9 }}
                                            animate={{ scale: 1 }}
                                            className="text-2xl md:text-3xl font-light text-[#f59e0b]"
                                        >
                                            {overview?.escalated_count ?? 0}
                                        </motion.h3>
                                    )}
                                </div>
                                <div className="text-[#f59e0b] shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-4 text-[9px] md:text-[10px] text-[#f59e0b] font-semibold uppercase tracking-wider truncate">
                                Live takeovers
                            </div>
                        </motion.div>

                        {/* 4. Active Count */}
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.15 }}
                            whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(124, 106, 247, 0.3)" }}
                            className="bg-[#111318] border border-[#1e2330] rounded-xl p-4 md:p-6 shadow-xl relative overflow-hidden transition-chic glass-panel cursor-pointer hover:shadow-lg hover:shadow-[#7c6af7]/5 gradient-border-hover"
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8892a4]">Active</span>
                                    {loadingOverview ? (
                                        <div className="h-9 w-20 animate-shimmer-bg rounded"></div>
                                    ) : (
                                        <motion.h3 
                                            initial={{ scale: 0.9 }}
                                            animate={{ scale: 1 }}
                                            className="text-2xl md:text-3xl font-light text-[#7c6af7]"
                                        >
                                            {overview?.active_count ?? 0}
                                        </motion.h3>
                                    )}
                                </div>
                                <div className="text-[#7c6af7] shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-4 text-[9px] md:text-[10px] text-[#7c6af7] font-semibold uppercase tracking-wider truncate">
                                Chatbot active
                            </div>
                        </motion.div>
                    </div>

                    {/* MIDDLE ROW: 2 Supporting Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Total Agents */}
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.2 }}
                            whileHover={{ scale: 1.005, borderColor: "rgba(124, 106, 247, 0.25)" }}
                            className="bg-[#111318] border border-[#1e2330] rounded-xl p-6 shadow-xl flex items-center justify-between transition-chic glass-panel cursor-pointer hover:shadow-lg hover:shadow-[#7c6af7]/3 gradient-border-hover"
                        >
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8892a4]">Total Configured Agents</span>
                                {loadingOverview ? (
                                    <div className="h-8 w-16 animate-shimmer-bg rounded"></div>
                                ) : (
                                    <h4 className="text-2xl font-light text-[#e2e8f0]">{overview?.total_agents ?? 0}</h4>
                                )}
                            </div>
                            <div className="text-[#7c6af7] shrink-0">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </motion.div>

                        {/* Knowledge Bases */}
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.25 }}
                            whileHover={{ scale: 1.005, borderColor: "rgba(16, 185, 129, 0.25)" }}
                            className="bg-[#111318] border border-[#1e2330] rounded-xl p-6 shadow-xl flex items-center justify-between transition-chic glass-panel cursor-pointer hover:shadow-lg hover:shadow-[#10b981]/3 gradient-border-hover"
                        >
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8892a4]">Indexed Knowledge Bases</span>
                                {loadingOverview ? (
                                    <div className="h-8 w-16 animate-shimmer-bg rounded"></div>
                                ) : (
                                    <h4 className="text-2xl font-light text-[#e2e8f0]">{overview?.total_knowledge_bases ?? 0}</h4>
                                )}
                            </div>
                            <div className="text-[#10b981] shrink-0">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                            </div>
                        </motion.div>
                    </div>

                    {/* BOTTOM SECTION: Paginated Conversations Table */}
                    <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-6 shadow-xl space-y-4 glass-panel">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#e2e8f0] px-1">Conversations Audit Log</h3>

                        {loadingConvs ? (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, idx) => (
                                    <div key={idx} className="h-12 bg-[#0a0b0f]/40 border border-[#1e2330] rounded-lg animate-shimmer-bg flex items-center px-4 space-x-4">
                                        <div className="h-3 w-1/4 bg-[#181c24]/30 rounded"></div>
                                        <div className="h-3 w-1/6 bg-[#181c24]/30 rounded"></div>
                                        <div className="h-3 w-12 bg-[#181c24]/30 rounded"></div>
                                    </div>
                                ))}
                            </div>
                        ) : conversations.length === 0 ? (
                            /* Simple chat lines empty state illustration */
                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-fadeIn">
                                <svg className="w-20 h-20 text-[#2a3045]" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                <div className="space-y-1">
                                    <h5 className="text-xs font-semibold text-[#e2e8f0]">Nothing here yet</h5>
                                    <p className="text-[10px] text-[#8892a4] max-w-[200px]">No active conversations logged in the system audit log.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full">
                                <div className="overflow-x-auto w-full scrollbar-thin">
                                    <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                                        <thead>
                                            <tr className="border-b border-[#1e2330] text-[#8892a4] font-semibold bg-[#0a0b0f]/20">
                                                <th className="py-3 px-4 uppercase tracking-wider text-[10px]">Agent Name</th>
                                                <th className="py-3 px-4 uppercase tracking-wider text-[10px]">Status</th>
                                                <th className="py-3 px-4 text-center uppercase tracking-wider text-[10px] hidden md:table-cell">Messages</th>
                                                <th className="py-3 px-4 uppercase tracking-wider text-[10px]">Created At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <AnimatePresence mode="wait">
                                                {conversations.map((c, index) => (
                                                    <motion.tr 
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -4 }}
                                                        transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.15 }}
                                                        key={c.id} 
                                                        className="border-b border-[#1e2330]/60 hover:bg-[#0a0b0f]/30 transition-colors"
                                                    >
                                                        <td className="py-3.5 px-4 font-bold text-[#e2e8f0]">{c.agent_name}</td>
                                                        <td className="py-3.5 px-4">
                                                            {c.status === "active" && (
                                                                <span className="px-2 py-0.5 rounded border border-[#7c6af7]/20 text-[#7c6af7] text-[9px] font-bold uppercase tracking-wider">
                                                                    Active
                                                                </span>
                                                            )}
                                                            {c.status === "closed" && (
                                                                <span className="px-2 py-0.5 rounded border border-[#10b981]/20 text-[#10b981] text-[9px] font-bold uppercase tracking-wider">
                                                                    Resolved
                                                                </span>
                                                            )}
                                                            {c.status === "handoff" && (
                                                                <span className="px-2 py-0.5 rounded border border-[#f59e0b]/20 text-[#f59e0b] text-[9px] font-bold uppercase tracking-wider animate-pulse">
                                                                    Escalated
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center font-mono font-medium text-[#e2e8f0] hidden md:table-cell">{c.message_count}</td>
                                                        <td className="py-3.5 px-4 text-[#8892a4] font-mono whitespace-nowrap">{new Date(c.created_at).toLocaleString()}</td>
                                                    </motion.tr>
                                                ))}
                                            </AnimatePresence>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-6 border-t border-[#1e2330] mt-4 px-2">
                                        <button
                                            disabled={page <= 1}
                                            onClick={() => setPage((p) => p - 1)}
                                            className="px-3 py-1.5 bg-[#0a0b0f] hover:bg-[#111318] active:scale-95 disabled:opacity-40 disabled:scale-100 rounded-lg text-[10px] font-bold text-[#8892a4] border border-[#1e2330] transition-chic"
                                        >
                                            Prev
                                        </button>
                                        <span className="text-[10px] text-[#4a5568] font-medium">
                                            Page <span className="text-[#e2e8f0] font-bold">{page}</span> of <span className="text-[#e2e8f0] font-bold">{totalPages}</span>
                                        </span>
                                        <button
                                            disabled={page >= totalPages}
                                            onClick={() => setPage((p) => p + 1)}
                                            className="px-3 py-1.5 bg-[#0a0b0f] hover:bg-[#111318] active:scale-95 disabled:opacity-40 disabled:scale-100 rounded-lg text-[10px] font-bold text-[#8892a4] border border-[#1e2330] transition-chic"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
