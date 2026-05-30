"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function RiamHome() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 30,
        stiffness: 120,
      },
    },
  } as const;

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-[#e2e8f0] flex flex-col justify-between relative overflow-hidden font-sans antialiased">
      {/* Grid background overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e2330_1px,transparent_1px),linear-gradient(to_bottom,#1e2330_1px,transparent_1px)] bg-[size:6rem_6rem] opacity-[0.12]"></div>
      
      {/* Decorative light ambient glow - Pulsing gently */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#7c6af7]/5 rounded-full blur-[120px] pointer-events-none ambient-pulse"></div>

      {/* Elegant Header Navbar */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 h-16 z-50 transition-chic ${
          scrolled || mobileMenuOpen
            ? "bg-[#0a0b0f]/80 backdrop-blur-md border-b border-[#1e2330]" 
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          {/* Logo Left */}
          <Link href="/" className="flex items-center space-x-2.5 z-50">
            <span className="text-sm font-light tracking-[0.25em] text-[#e2e8f0] hover:opacity-85 transition-opacity">
              <span className="font-extralight text-[#8892a4]">R</span>IAM
            </span>
          </Link>

          {/* Right Nav Links (Desktop) */}
          <div className="hidden md:flex items-center space-x-6">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold tracking-widest uppercase text-[#8892a4] hover:text-[#e2e8f0] transition-chic">
              Read API Docs
            </a>
            <Link href="/dashboard" className="text-[10px] font-bold tracking-widest uppercase text-[#8892a4] hover:text-[#e2e8f0] transition-chic">
              Sign In
            </Link>
            <Link href="/dashboard" className="px-4 py-2 bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-[10px] font-bold tracking-widest uppercase rounded transition-chic shadow-lg shadow-[#7c6af7]/10 hover-swipe">
              Get Started
            </Link>
          </div>

          {/* Hamburger Menu Icon (Mobile) */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden z-50 p-2 text-[#8892a4] hover:text-[#e2e8f0] transition-chic min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#0a0b0f] flex flex-col justify-between p-6 pt-24 animate-fadeIn md:hidden">
          <div className="space-y-6">
            <Link 
              href="/dashboard" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-bold tracking-widest uppercase text-[#8892a4] hover:text-[#e2e8f0] py-2"
            >
              Sign In
            </Link>
            <a 
              href="https://github.com" 
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-bold tracking-widest uppercase text-[#8892a4] hover:text-[#e2e8f0] py-2"
            >
              API Docs
            </a>
          </div>
          <Link 
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full py-4 bg-[#7c6af7] text-white text-center font-bold tracking-widest uppercase rounded shadow-lg shadow-[#7c6af7]/10 block min-h-[44px]"
          >
            Get Started
          </Link>
        </div>
      )}

      {/* Hero Section */}
      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 max-w-7xl mx-auto px-6 pt-20 md:pt-36 pb-20 relative z-10 w-full flex flex-col justify-center"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left copy column */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Eyebrow */}
            <motion.span 
              variants={itemVariants}
              className="inline-block text-[9px] font-bold tracking-[0.25em] text-[#7c6af7] uppercase"
            >
              AI-POWERED SUPPORT INFRASTRUCTURE
            </motion.span>

            {/* Headline */}
            <motion.h1 
              variants={itemVariants}
              style={{ fontSize: "clamp(32px, 6vw, 64px)" }}
              className="font-light tracking-tight leading-[1.1] text-[#e2e8f0]"
            >
              Deploy intelligent <br />
              <span className="font-bold">support <span className="text-[#7c6af7]">agents</span>.</span>
            </motion.h1>

            {/* Subtext */}
            <motion.p 
              variants={itemVariants}
              className="text-xs md:text-sm text-[#8892a4] max-w-lg leading-relaxed font-light"
            >
              Orchestrate self-improving RAG support agents with multi-tenant isolation, LangGraph workflows, and seamless live operator human handoffs.
            </motion.p>

            {/* CTAs */}
            <motion.div 
              variants={itemVariants}
              className="flex flex-col md:flex-row gap-4 items-stretch md:items-center pt-2"
            >
              <Link
                href="/dashboard"
                className="px-6 py-3 bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-[10px] font-bold tracking-widest uppercase rounded transition-chic shadow-lg shadow-[#7c6af7]/20 flex items-center justify-center space-x-2 min-h-[44px] hover-swipe hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Start Building</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>

              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-transparent border border-[#1e2330] hover:border-[#7c6af7]/50 text-[#8892a4] hover:text-[#e2e8f0] text-[10px] font-bold tracking-widest uppercase rounded transition-chic flex items-center justify-center min-h-[44px] hover:scale-[1.02] active:scale-[0.98]"
              >
                View Docs
              </a>
            </motion.div>

            {/* Subtle disclaimer */}
            <motion.p 
              variants={itemVariants}
              className="text-[10px] text-[#4a5568] tracking-wider uppercase font-semibold text-center md:text-left"
            >
              No credit card required
            </motion.p>
          </div>

          {/* Right SVG illustration column */}
          <motion.div 
            variants={itemVariants}
            className="lg:col-span-5 hidden min-[480px]:flex justify-center lg:justify-end"
          >
            <svg className="w-full max-w-[420px] aspect-[4/3]" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Outer Box / Chat Window Outline */}
              <rect x="10" y="10" width="380" height="280" rx="8" stroke="#1e2330" strokeWidth="1.5" />
              
              {/* Top window dots */}
              <circle cx="32" cy="28" r="4" fill="#1e2330" />
              <circle cx="48" cy="28" r="4" fill="#1e2330" />
              <circle cx="64" cy="28" r="4" fill="#1e2330" />
              <line x1="84" y1="28" x2="160" y2="28" stroke="#1e2330" strokeWidth="1.5" />

              {/* Bubble 1 (Left - Customer) */}
              <rect x="30" y="60" width="220" height="44" rx="6" stroke="#1e2330" strokeWidth="1.5" />
              <line x1="45" y1="76" x2="180" y2="76" stroke="#1e2330" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="45" y1="88" x2="120" y2="88" stroke="#1e2330" strokeWidth="1.5" strokeLinecap="round" />
              
              {/* Bubble 2 (Right - AI Agent) */}
              <rect x="150" y="125" width="220" height="52" rx="6" stroke="#7c6af7" strokeWidth="1.5" />
              <line x1="165" y1="141" x2="310" y2="141" stroke="#7c6af7" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="165" y1="153" x2="250" y2="153" stroke="#7c6af7" strokeWidth="1.5" strokeLinecap="round" />
              
              {/* Bubble 3 (Left - Handoff Request) */}
              <rect x="30" y="198" width="220" height="44" rx="6" stroke="#1e2330" strokeWidth="1.5" />
              <line x1="45" y1="214" x2="150" y2="214" stroke="#1e2330" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="45" y1="226" x2="200" y2="226" stroke="#1e2330" strokeWidth="1.5" strokeLinecap="round" />

              {/* Brain/Node Network graph Overlay in upper right */}
              <g transform="translate(305, 45)">
                {/* Brain node connections */}
                <line x1="20" y1="10" x2="5" y2="25" stroke="#7c6af7" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="20" y1="10" x2="35" y2="25" stroke="#7c6af7" strokeWidth="1" />
                <line x1="5" y1="25" x2="20" y2="40" stroke="#7c6af7" strokeWidth="1" />
                <line x1="35" y1="25" x2="20" y2="40" stroke="#7c6af7" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="20" y1="10" x2="20" y2="40" stroke="#7c6af7" strokeWidth="1" />

                {/* Circles/Nodes with interactive spring glows */}
                <motion.circle 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  cx="20" cy="10" r="3" fill="#7c6af7" 
                />
                <motion.circle 
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  cx="5" cy="25" r="3" fill="#0a0b0f" stroke="#7c6af7" strokeWidth="1" 
                />
                <motion.circle 
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  cx="35" cy="25" r="3" fill="#0a0b0f" stroke="#7c6af7" strokeWidth="1" 
                />
                <motion.circle 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                  cx="20" cy="40" r="3" fill="#7c6af7" 
                />
              </g>
            </svg>
          </motion.div>
        </div>

        {/* Features Section */}
        <div className="mt-32 space-y-12 text-left">
          <motion.h3 
            variants={itemVariants}
            className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#8892a4]"
          >
            Everything you need
          </motion.h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 — Tenant Isolation */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(124, 106, 247, 0.3)" }}
              className="p-4 sm:p-6 bg-[#111318] border border-[#1e2330] rounded-lg transition-chic group space-y-4 hover:shadow-lg hover:shadow-[#7c6af7]/5 gradient-border-hover cursor-pointer"
            >
              <div className="text-[#8892a4] group-hover:text-[#7c6af7] transition-chic">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#e2e8f0]">Tenant Isolation</h4>
                <p className="text-[11px] text-[#8892a4] leading-relaxed font-light">
                  Secure multi-tenant database partitioning scoped directly at the repository level.
                </p>
              </div>
            </motion.div>

            {/* Card 2 — LangGraph Orchestration */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(124, 106, 247, 0.3)" }}
              className="p-4 sm:p-6 bg-[#111318] border border-[#1e2330] rounded-lg transition-chic group space-y-4 hover:shadow-lg hover:shadow-[#7c6af7]/5 gradient-border-hover cursor-pointer"
            >
              <div className="text-[#8892a4] group-hover:text-[#7c6af7] transition-chic">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="6" r="3" fill="none" />
                  <circle cx="6" cy="18" r="3" fill="none" />
                  <circle cx="18" cy="18" r="3" fill="none" />
                  <line x1="11" y1="8.5" x2="7" y2="15.5" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="13" y1="8.5" x2="17" y2="15.5" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="9" y1="18" x2="15" y2="18" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#e2e8f0]">LangGraph Workflows</h4>
                <p className="text-[11px] text-[#8892a4] leading-relaxed font-light">
                  Advanced support graph with cognitive routing, reflection, and human-in-the-loop loops.
                </p>
              </div>
            </motion.div>

            {/* Card 3 — SSE Streaming */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.01, borderColor: "rgba(124, 106, 247, 0.3)" }}
              className="p-4 sm:p-6 bg-[#111318] border border-[#1e2330] rounded-lg transition-chic group space-y-4 hover:shadow-lg hover:shadow-[#7c6af7]/5 gradient-border-hover cursor-pointer md:col-span-2 lg:col-span-1"
            >
              <div className="text-[#8892a4] group-hover:text-[#7c6af7] transition-chic">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="2" />
                  <path strokeLinecap="round" d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
                </svg>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#e2e8f0]">SSE EventStreams</h4>
                <p className="text-[11px] text-[#8892a4] leading-relaxed font-light">
                  Ultra-fast token-by-token real-time streaming directly into floating frontend widgets.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.main>

      {/* Modern Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 h-24 flex flex-col md:flex-row items-center justify-between border-t border-[#1e2330] relative z-10 text-[10px] text-[#4a5568] gap-4 py-6 md:py-0 text-center md:text-left">
        <span>&copy; 2026 Riam &middot; Built for AI Engineers</span>
        <div className="flex space-x-6 uppercase tracking-wider font-semibold justify-center">
          <a href="#" className="hover:text-[#8892a4] transition-chic">Terms</a>
          <a href="#" className="hover:text-[#8892a4] transition-chic">Privacy</a>
          <a href="#" className="hover:text-[#8892a4] transition-chic">Status</a>
        </div>
      </footer>
    </div>
  );
}

