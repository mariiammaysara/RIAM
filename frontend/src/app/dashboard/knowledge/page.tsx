"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// TypeScript Interfaces matching Backend Schemas
interface KnowledgeSource {
    id: string;
    name: string;
    source_type: "file" | "url" | "pdf";
    source_url?: string;
    status: "indexing" | "ready" | "failed";
    created_at: string;
}

export default function RiamKnowledgeHub() {
    const backendUrl = "http://localhost:8000";
    const router = useRouter();
    const [canGoBack, setCanGoBack] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Unified Business Context (dev-token authenticates as "org_dev_default_123" in backend dev fallback)
    const authHeaders = {
        "Authorization": "Bearer dev-token",
        "Content-Type": "application/json"
    };

    // States
    const [knowledgeList, setKnowledgeList] = useState<KnowledgeSource[]>([]);
    const [kbName, setKbName] = useState("");
    const [kbType, setKbType] = useState<"file" | "url" | "pdf">("url");
    const [kbUrl, setKbUrl] = useState("");
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [uploadingPdf, setUploadingPdf] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResult, setUploadResult] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    
    // Sidebar active takeover alert pill
    const [escalatedCount, setEscalatedCount] = useState(0);

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

    const loadInboxEscalatedCount = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/v1/conversations/`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json();
                const count = data.filter((c: any) => c.status === "handoff").length;
                setEscalatedCount(count);
            }
        } catch (err) {
            console.error("Failed to load conversation counts for sidebar", err);
        }
    };

    useEffect(() => {
        loadKnowledge();
        loadInboxEscalatedCount();
        
        // Poll for updates to keep indices status fresh
        const interval = setInterval(() => {
            loadKnowledge();
            loadInboxEscalatedCount();
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Set document title
    useEffect(() => {
        document.title = "RIAM | Knowledge Hub";
    }, []);

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
                console.log("RIAM Knowledge Hub: Escape key pressed, resetting forms");
                setKbName("");
                setKbUrl("");
                setPdfFile(null);
                setUploadError(null);
                setUploadResult(null);
                setIsSidebarOpen(false);
            }
        };
        document.addEventListener("keydown", handleEsc, true);
        return () => document.removeEventListener("keydown", handleEsc, true);
    }, []);

    // --- Action Handlers ---
    
    // Ingest URL or PDF knowledge base integrations
    const handleAddKnowledge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!kbName.trim()) return;

        try {
            // STEP 1: Create Knowledge Base entry placeholder
            const resPlaceholder = await fetch(`${backendUrl}/api/v1/knowledge/`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                    name: kbName,
                    source_type: kbType,
                    source_url: kbType === "url" ? kbUrl : null
                })
            });

            if (!resPlaceholder.ok) {
                const errorText = await resPlaceholder.text();
                setUploadError(`Failed to create knowledge base reference: ${errorText || resPlaceholder.statusText}`);
                return;
            }

            const kb = await resPlaceholder.json();
            setKnowledgeList((prev) => [kb, ...prev]);
            
            // Clear input fields immediately
            const currentKbName = kbName;
            setKbName("");
            setUploadError(null);
            setUploadResult(null);

            // STEP 2: Trigger Ingestion based on Type
            if (kbType === "url") {
                const currentKbUrl = kbUrl;
                setKbUrl("");
                
                try {
                    const scrapeRes = await fetch(`${backendUrl}/api/v1/knowledge/${kb.id}/urls`, {
                        method: "POST",
                        headers: authHeaders
                    });
                    
                    if (scrapeRes.ok) {
                        const resultData = await scrapeRes.json();
                        setUploadResult(`Scraper triggered successfully for "${currentKbName}". Ingestion is processing in the background.`);
                    } else {
                        const errorText = await scrapeRes.text();
                        setUploadError(`Failed to trigger web scraper: ${errorText || scrapeRes.statusText}`);
                    }
                } catch (scrapeErr: unknown) {
                    const errMsg = scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr);
                    setUploadError(`Scraper request failed: ${errMsg}`);
                }
            } else if (kbType === "pdf") {
                if (!pdfFile) {
                    setUploadError("Please select a PDF file first.");
                    return;
                }
                setUploadingPdf(true);
                setUploadProgress(20);

                const formData = new FormData();
                formData.append("file", pdfFile);

                setUploadProgress(50);
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
                        setUploadResult(`PDF "${pdfFile.name}" indexed successfully! Created ${resultData.chunk_count} semantic segments.`);
                        setPdfFile(null);
                    } else {
                        const errorText = await uploadRes.text();
                        setUploadError(`Failed to index PDF: ${errorText || uploadRes.statusText}`);
                    }
                } catch (uploadErr: unknown) {
                    const errMsg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
                    setUploadError(`PDF network upload failed: ${errMsg}`);
                } finally {
                    setUploadingPdf(false);
                }
            } else {
                // Upload fallback plain text file
                try {
                    const textRes = await fetch(`${backendUrl}/api/v1/knowledge/${kb.id}/files`, {
                        method: "POST",
                        headers: {
                            ...authHeaders,
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: new URLSearchParams({
                            "kb_id": kb.id,
                        })
                    });
                    
                    if (textRes.ok) {
                        setUploadResult(`Text document source added successfully.`);
                    } else {
                        const errorText = await textRes.text();
                        setUploadError(`Failed to index text file: ${errorText || textRes.statusText}`);
                    }
                } catch (err: unknown) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    setUploadError(`Text ingestion request failed: ${errMsg}`);
                }
            }
            
            // Reload knowledge list to audit statuses
            loadKnowledge();
        } catch (err) {
            console.error("Error creating knowledge source placeholder", err);
            setUploadError("An unexpected error occurred. Please try again.");
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
                    <div className="flex items-center space-x-2 mb-8 h-8 overflow-hidden">
                        <span className="text-sm font-light tracking-[0.25em] text-[#e2e8f0] whitespace-nowrap">
                            <span className="font-extralight text-[#8892a4]">R</span>
                            <span className="md:hidden lg:inline group-hover:md:inline transition-all duration-300">IAM</span>
                        </span>
                    </div>

                    <nav className="space-y-1">
                        <button
                            onClick={() => window.location.href = '/dashboard'}
                            className="w-full flex items-center space-x-3 px-4 py-3.5 md:px-1.5 md:py-2.5 lg:px-4 lg:py-3.5 group-hover:md:px-4 group-hover:md:py-3.5 text-xs font-medium tracking-wide transition-all duration-300 border-l-2 border-transparent text-[#8892a4] hover:text-[#e2e8f0] min-h-[44px]"
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M21 12H3M12 3v18" />
                            </svg>
                            <span className="md:hidden lg:inline group-hover:md:inline transition-all duration-300 whitespace-nowrap">AGENTS DESIGNER</span>
                        </button>
                        
                        <button
                            onClick={() => {}}
                            className="w-full flex items-center space-x-3 px-4 py-3.5 md:px-1.5 md:py-2.5 lg:px-4 lg:py-3.5 group-hover:md:px-4 group-hover:md:py-3.5 text-xs font-medium tracking-wide transition-all duration-300 border-l-2 border-[#7c6af7] bg-[#7c6af7]/5 text-[#e2e8f0] min-h-[44px]"
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-16.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-16.25v16.25" />
                            </svg>
                            <span className="md:hidden lg:inline group-hover:md:inline transition-all duration-300 whitespace-nowrap">KNOWLEDGE HUB</span>
                        </button>

                        <button
                            onClick={() => window.location.href = '/dashboard/analytics'}
                            className="w-full flex items-center space-x-3 px-4 py-3.5 md:px-1.5 md:py-2.5 lg:px-4 lg:py-3.5 group-hover:md:px-4 group-hover:md:py-3.5 text-xs font-medium tracking-wide transition-all duration-300 border-l-2 border-transparent text-[#8892a4] hover:text-[#e2e8f0] min-h-[44px]"
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 18.375v-5.25zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-9.75zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                            </svg>
                            <span className="md:hidden lg:inline group-hover:md:inline transition-all duration-300 whitespace-nowrap">ANALYTICS</span>
                        </button>

                        <button
                            onClick={() => window.location.href = '/dashboard'}
                            className="w-full flex items-center space-x-3 px-4 py-3.5 md:px-1.5 md:py-2.5 lg:px-4 lg:py-3.5 group-hover:md:px-4 group-hover:md:py-3.5 text-xs font-medium tracking-wide transition-all duration-300 border-l-2 border-transparent text-[#8892a4] hover:text-[#e2e8f0] min-h-[44px]"
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
                        </button>
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
                            Knowledge Hub & Vectors
                        </h2>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"/>
                        <span className="text-[10px] tracking-wide text-[#8892a4] uppercase font-semibold">Connected</span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
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
                                    <div className="flex items-center space-x-6 border-b border-[#1e2330] pb-px overflow-x-auto whitespace-nowrap w-full scrollbar-none scroll-smooth">
                                        <button 
                                            type="button" onClick={() => setKbType("url")}
                                            className={`pb-2.5 text-[10px] font-bold tracking-widest uppercase transition-chic border-b-2 shrink-0 min-h-[44px] ${kbType === "url" ? "border-[#7c6af7] text-[#e2e8f0]" : "border-transparent text-[#8892a4] hover:text-[#e2e8f0]"}`}
                                        >
                                            Web URL
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
                                            
                                            {/* Ingestion status pills */}
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
                                    /* Stack document outline illustration */
                                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
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
                </div>
            </main>
        </div>
    );
}
