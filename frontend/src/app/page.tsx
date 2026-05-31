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

  const scrollContainerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  } as const;

  const scrollItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 100,
      },
    },
  } as const;

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-[#e2e8f0] flex flex-col justify-between relative overflow-hidden font-sans antialiased">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .floating {
          animation: float 4s ease-in-out infinite;
        }
      `}} />

      {/* Grid background overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e2330_1px,transparent_1px),linear-gradient(to_bottom,#1e2330_1px,transparent_1px)] bg-[size:6rem_6rem] opacity-[0.12]"></div>
      
      {/* Decorative light ambient glow - Pulsing gently */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#7c6af7]/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Elegant Header Navbar */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 h-16 z-50 transition-all duration-300 ${
          scrolled || mobileMenuOpen
            ? "bg-[#0a0b0f]/90 backdrop-blur-sm border-b border-[#1e2330]" 
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
            <a 
              href="https://github.com/mariiammaysara/RIAM" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center space-x-2 text-[10px] font-bold tracking-widest uppercase text-[#8892a4] hover:text-[#e2e8f0] transition-colors duration-200"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span>GitHub</span>
            </a>
            <Link 
              href="/dashboard/knowledge" 
              className="text-[10px] font-bold tracking-widest uppercase text-[#8892a4] hover:text-[#e2e8f0] px-3 py-1.5 rounded transition-colors duration-200"
            >
              Sign In
            </Link>
            <Link 
              href="/dashboard/knowledge" 
              className="px-4 py-2 bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-[10px] font-bold tracking-widest uppercase rounded transition-all duration-200 shadow-lg shadow-[#7c6af7]/10 hover:scale-[1.02] active:scale-[0.98] transform"
            >
              Get Started
            </Link>
          </div>

          {/* Hamburger Menu Icon (Mobile) */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden z-50 p-2 text-[#8892a4] hover:text-[#e2e8f0] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
            <a 
              href="https://github.com/mariiammaysara/RIAM" 
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-2 text-sm font-bold tracking-widest uppercase text-[#8892a4] hover:text-[#e2e8f0] py-2"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <span>GitHub</span>
            </a>
            <Link 
              href="/dashboard/knowledge" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-bold tracking-widest uppercase text-[#8892a4] hover:text-[#e2e8f0] py-2"
            >
              Sign In
            </Link>
          </div>
          <Link 
            href="/dashboard/knowledge"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full py-4 bg-[#7c6af7] text-white text-center font-bold tracking-widest uppercase rounded shadow-lg shadow-[#7c6af7]/10 block min-h-[44px] flex items-center justify-center"
          >
            Get Started
          </Link>
        </div>
      )}

      {/* Hero Section */}
      <motion.main 
        className="flex-1 max-w-7xl mx-auto px-6 pt-28 md:pt-40 pb-20 relative z-10 w-full flex flex-col justify-center"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left copy column */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0 }}
            className="lg:col-span-7 space-y-6 text-left"
          >
            {/* Eyebrow */}
            <span className="inline-block text-[9px] font-bold tracking-[0.25em] text-[#7c6af7] uppercase">
              AI CUSTOMER SUPPORT INFRASTRUCTURE
            </span>

            {/* Headline */}
            <h1 
              style={{ fontSize: "clamp(32px, 6vw, 64px)" }}
              className="font-light tracking-tight leading-[1.1] text-[#e2e8f0]"
            >
              Deploy intelligent <br />
              <span className="font-bold bg-gradient-to-r from-[#7c6af7] via-[#a892ff] to-[#60a5fa] bg-clip-text text-transparent">support agents.</span>
            </h1>

            {/* Subtext */}
            <p className="text-xs md:text-sm text-[#8892a4] max-w-lg leading-relaxed font-light">
              Upload your docs, configure your agent, and embed a chat widget on any website in minutes.
            </p>

            {/* CTAs */}
            <div className="pt-2">
              <Link
                href="/dashboard/knowledge"
                className="inline-flex px-8 py-3.5 bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-[10px] font-bold tracking-widest uppercase rounded transition-all duration-200 shadow-lg shadow-[#7c6af7]/20 items-center justify-center space-x-2 min-h-[44px] hover:scale-[1.02] active:scale-[0.98] transform"
              >
                <span>Start Building &rarr;</span>
              </Link>
            </div>

            {/* Subtle disclaimer */}
            <p className="text-[10px] text-[#4a5568] tracking-wider uppercase font-semibold">
              No credit card required
            </p>
          </motion.div>

          {/* Right illustration column - Premium Glassmorphism Chat Widget Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="lg:col-span-5 hidden min-[480px]:flex justify-center lg:justify-end"
          >
            <div className="w-full max-w-[440px] bg-[#111318]/60 border border-[#1e2330] backdrop-blur-xl rounded-2xl p-6 shadow-2xl relative overflow-hidden floating hover:border-[#7c6af7]/30 transition-colors duration-500">
              {/* Radial gradient background inside the card */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#7c6af7]/10 rounded-full blur-[40px] pointer-events-none"></div>
              
              {/* Window Controls */}
              <div className="flex items-center justify-between pb-4 border-b border-[#1e2330]/60 mb-5">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]/60"></div>
                  <div className="w-3 h-3 rounded-full bg-[#eab308]/60"></div>
                  <div className="w-3 h-3 rounded-full bg-[#22c55e]/60"></div>
                </div>
                <div className="text-[9px] font-mono tracking-widest text-[#8892a4] uppercase bg-[#0a0b0f] px-2.5 py-1 rounded border border-[#1e2330]/40">
                  widget.js &bull; sandbox
                </div>
              </div>

              {/* Chat Simulation Area */}
              <div className="space-y-5">
                {/* Customer Bubble 1 */}
                <div className="flex items-start space-x-2.5 justify-start">
                  <div className="w-6 h-6 rounded-full bg-[#1e2330] border border-[#2d3446] text-[9px] font-bold text-[#8892a4] flex items-center justify-center flex-shrink-0 select-none">
                    US
                  </div>
                  <div className="bg-[#181c24] border border-[#1e2330] rounded-2xl rounded-tl-none px-4 py-3 text-[11px] text-[#e2e8f0] max-w-[80%] leading-relaxed shadow-sm">
                    <span className="text-[8px] font-bold block text-[#8892a4] uppercase tracking-widest mb-1 select-none">Customer</span>
                    How do I connect my custom knowledge source?
                  </div>
                </div>

                {/* AI Agent Response */}
                <div className="flex items-start space-x-2.5 justify-end">
                  <div className="bg-gradient-to-br from-[#7c6af7]/15 via-[#b57efd]/10 to-transparent border border-[#7c6af7]/40 rounded-2xl rounded-br-none px-4 py-3 text-[11px] text-[#e2e8f0] max-w-[80%] leading-relaxed shadow-md relative overflow-hidden backdrop-blur-md">
                    <span className="text-[8px] font-bold block text-[#7c6af7] uppercase tracking-widest mb-1 select-none">Riam Assistant</span>
                    <p className="mb-2.5">Simply upload your PDFs or paste any website URL into the Knowledge Hub.</p>
                    <div className="flex items-center space-x-2 text-[9px] text-[#8892a4] bg-[#0a0b0f]/60 p-1.5 rounded border border-[#1e2330]/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></span>
                      <span>Ingestion Status: Ready</span>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#7c6af7] to-[#b57efd] text-[9px] font-bold text-white flex items-center justify-center flex-shrink-0 select-none shadow-md shadow-[#7c6af7]/20">
                    AI
                  </div>
                </div>

                {/* Customer Bubble 2 (Triggering Handoff) */}
                <div className="flex items-start space-x-2.5 justify-start">
                  <div className="w-6 h-6 rounded-full bg-[#1e2330] border border-[#2d3446] text-[9px] font-bold text-[#8892a4] flex items-center justify-center flex-shrink-0 select-none">
                    US
                  </div>
                  <div className="bg-[#181c24] border border-[#1e2330] rounded-2xl rounded-bl-none px-4 py-3 text-[11px] text-[#e2e8f0] max-w-[80%] leading-relaxed shadow-sm">
                    <span className="text-[8px] font-bold block text-[#8892a4] uppercase tracking-widest mb-1 select-none">Customer</span>
                    I need to talk to a human operator.
                  </div>
                </div>

                {/* Live Human Handoff Notification */}
                <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 backdrop-blur-md rounded-2xl p-3.5 flex items-center justify-between text-[10px] text-[#ef4444] shadow-lg shadow-[#ef4444]/5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#ef4444]"></div>
                  <div className="flex items-center space-x-2.5 pl-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]"></span>
                    </span>
                    <span className="font-light tracking-wide">AI paused. Routing to live human operator...</span>
                  </div>
                  <span className="text-[8px] uppercase tracking-widest font-extrabold bg-[#ef4444]/20 border border-[#ef4444]/30 px-2 py-1 rounded text-red-400 select-none shadow-sm">
                    Handoff Active
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* How it Works Section */}
        <div className="mt-48 md:mt-56 space-y-16 text-left relative">
          <div className="space-y-4 max-w-xl">
            <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#7c6af7] border-l-2 border-[#7c6af7] pl-3">
              How it works
            </h3>
            <h2 className="text-2xl md:text-3xl font-light text-[#e2e8f0] tracking-tight">
              Simple steps to automated <span className="font-semibold bg-gradient-to-r from-[#7c6af7] to-[#a892ff] bg-clip-text text-transparent">customer support.</span>
            </h2>
          </div>
          
          <motion.div 
            variants={scrollContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 relative"
          >
            {/* Desktop Connector Lines */}
            <div className="hidden md:block absolute top-[2.5rem] left-[25%] right-[25%] h-[1px] bg-gradient-to-r from-[#7c6af7]/20 via-[#a892ff]/40 to-[#7c6af7]/20 border-dashed border-t border-[#7c6af7]/30 z-0 pointer-events-none"></div>

            {/* Step 1 */}
            <motion.div 
              variants={scrollItemVariants} 
              className="relative flex flex-col space-y-6 bg-gradient-to-b from-[#111318]/50 to-[#0e1014]/20 border border-[#1e2330] rounded-2xl p-8 backdrop-blur-xl transition-all duration-300 hover:border-[#7c6af7]/40 hover:bg-[#111318]/70 hover:shadow-[0_0_30px_-5px_rgba(124,106,247,0.15)] group cursor-pointer z-10"
            >
              {/* Subtle top light accent line */}
              <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#7c6af7]/35 to-transparent"></div>
              
              <div className="flex items-center justify-between">
                <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#7c6af7]/60 group-hover:text-[#7c6af7] transition-colors duration-300">01</span>
                <div className="p-3 bg-[#181c24] border border-[#2d3446] rounded-xl text-[#8892a4] group-hover:text-[#7c6af7] group-hover:border-[#7c6af7]/40 transition-all duration-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2.5">
                <h4 className="text-sm font-semibold tracking-wide text-[#e2e8f0]">Upload your knowledge</h4>
                <p className="text-[12px] text-[#8892a4] leading-relaxed font-light">
                  Add PDFs, URLs, or text files as your agent&apos;s knowledge base.
                </p>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div 
              variants={scrollItemVariants} 
              className="relative flex flex-col space-y-6 bg-gradient-to-b from-[#111318]/50 to-[#0e1014]/20 border border-[#1e2330] rounded-2xl p-8 backdrop-blur-xl transition-all duration-300 hover:border-[#7c6af7]/40 hover:bg-[#111318]/70 hover:shadow-[0_0_30px_-5px_rgba(124,106,247,0.15)] group cursor-pointer z-10"
            >
              {/* Subtle top light accent line */}
              <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#a892ff]/35 to-transparent"></div>

              <div className="flex items-center justify-between">
                <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#7c6af7]/60 group-hover:text-[#a892ff] transition-colors duration-300">02</span>
                <div className="p-3 bg-[#181c24] border border-[#2d3446] rounded-xl text-[#8892a4] group-hover:text-[#a892ff] group-hover:border-[#7c6af7]/40 transition-all duration-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2.5">
                <h4 className="text-sm font-semibold tracking-wide text-[#e2e8f0]">Configure your agent</h4>
                <p className="text-[12px] text-[#8892a4] leading-relaxed font-light">
                  Set your agent&apos;s name, personality, and LLM provider.
                </p>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div 
              variants={scrollItemVariants} 
              className="relative flex flex-col space-y-6 bg-gradient-to-b from-[#111318]/50 to-[#0e1014]/20 border border-[#1e2330] rounded-2xl p-8 backdrop-blur-xl transition-all duration-300 hover:border-[#7c6af7]/40 hover:bg-[#111318]/70 hover:shadow-[0_0_30px_-5px_rgba(124,106,247,0.15)] group cursor-pointer z-10"
            >
              {/* Subtle top light accent line */}
              <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#60a5fa]/35 to-transparent"></div>

              <div className="flex items-center justify-between">
                <span className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#7c6af7]/60 group-hover:text-[#60a5fa] transition-colors duration-300">03</span>
                <div className="p-3 bg-[#181c24] border border-[#2d3446] rounded-xl text-[#8892a4] group-hover:text-[#60a5fa] group-hover:border-[#7c6af7]/40 transition-all duration-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2.5">
                <h4 className="text-sm font-semibold tracking-wide text-[#e2e8f0]">Embed anywhere</h4>
                <p className="text-[12px] text-[#8892a4] leading-relaxed font-light">
                  Copy one script tag and paste it on your website.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Features Section */}
        <div className="mt-48 md:mt-56 space-y-16 text-left">
          <div className="space-y-4 max-w-xl">
            <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#7c6af7] border-l-2 border-[#7c6af7] pl-3">
              Everything you need
            </h3>
            <h2 className="text-2xl md:text-3xl font-light text-[#e2e8f0] tracking-tight">
              Robust capabilities engineered for <span className="font-semibold bg-gradient-to-r from-[#7c6af7] to-[#a892ff] bg-clip-text text-transparent">reliability.</span>
            </h2>
          </div>

          <motion.div 
            variants={scrollContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {/* Card 1 — Tenant Isolation (Cyan Glow) */}
            <motion.div 
              variants={scrollItemVariants}
              whileHover={{ y: -6, borderColor: "rgba(6, 182, 212, 0.4)", backgroundColor: "#111318/60" }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="p-8 bg-[#111318]/40 border border-[#1e2330] rounded-2xl transition-all duration-300 group space-y-6 hover:shadow-[0_0_40px_-10px_rgba(6,182,212,0.2)] cursor-pointer backdrop-blur-xl relative overflow-hidden"
            >
              {/* Radial gradient glow halo */}
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#06b6d4]/5 rounded-full blur-[20px] pointer-events-none group-hover:bg-[#06b6d4]/10 transition-all duration-300"></div>
              {/* Top Accent line matching Cyan */}
              <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#06b6d4]/30 to-transparent"></div>

              <div className="p-3 bg-[#06b6d4]/5 text-[#8892a4] group-hover:text-[#06b6d4] group-hover:bg-[#06b6d4]/10 rounded-xl transition-all duration-300 w-fit border border-[#06b6d4]/10">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div className="space-y-2.5">
                <h4 className="text-sm font-semibold tracking-wide text-[#e2e8f0]">Tenant Isolation</h4>
                <p className="text-[12px] text-[#8892a4] leading-relaxed font-light">
                  Secure multi-tenant database partitioning scoped directly at the repository level.
                </p>
              </div>
            </motion.div>

            {/* Card 2 — LangGraph Orchestration (Violet Glow) */}
            <motion.div 
              variants={scrollItemVariants}
              whileHover={{ y: -6, borderColor: "rgba(124, 106, 247, 0.4)", backgroundColor: "#111318/60" }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="p-8 bg-[#111318]/40 border border-[#1e2330] rounded-2xl transition-all duration-300 group space-y-6 hover:shadow-[0_0_40px_-10px_rgba(124,106,247,0.2)] cursor-pointer backdrop-blur-xl relative overflow-hidden"
            >
              {/* Radial gradient glow halo */}
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#7c6af7]/5 rounded-full blur-[20px] pointer-events-none group-hover:bg-[#7c6af7]/10 transition-all duration-300"></div>
              {/* Top Accent line matching Violet */}
              <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#7c6af7]/30 to-transparent"></div>

              <div className="p-3 bg-[#7c6af7]/5 text-[#8892a4] group-hover:text-[#7c6af7] group-hover:bg-[#7c6af7]/10 rounded-xl transition-all duration-300 w-fit border border-[#7c6af7]/10">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="6" r="3" fill="none" />
                  <circle cx="6" cy="18" r="3" fill="none" />
                  <circle cx="18" cy="18" r="3" fill="none" />
                  <line x1="11" y1="8.5" x2="7" y2="15.5" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="13" y1="8.5" x2="17" y2="15.5" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="9" y1="18" x2="15" y2="18" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="space-y-2.5">
                <h4 className="text-sm font-semibold tracking-wide text-[#e2e8f0]">LangGraph Workflows</h4>
                <p className="text-[12px] text-[#8892a4] leading-relaxed font-light">
                  Advanced support graph with cognitive routing, reflection, and human-in-the-loop loops.
                </p>
              </div>
            </motion.div>

            {/* Card 3 — SSE Streaming (Emerald Glow - Nested Div Bug Fixed) */}
            <motion.div 
              variants={scrollItemVariants}
              whileHover={{ y: -6, borderColor: "rgba(16, 185, 129, 0.4)", backgroundColor: "#111318/60" }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="p-8 bg-[#111318]/40 border border-[#1e2330] rounded-2xl transition-all duration-300 group space-y-6 hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.2)] cursor-pointer md:col-span-2 lg:col-span-1 backdrop-blur-xl relative overflow-hidden"
            >
              {/* Radial gradient glow halo */}
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#10b981]/5 rounded-full blur-[20px] pointer-events-none group-hover:bg-[#10b981]/10 transition-all duration-300"></div>
              {/* Top Accent line matching Emerald */}
              <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#10b981]/30 to-transparent"></div>

              <div className="p-3 bg-[#10b981]/5 text-[#8892a4] group-hover:text-[#10b981] group-hover:bg-[#10b981]/10 rounded-xl transition-all duration-300 w-fit border border-[#10b981]/10">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="2" />
                  <path strokeLinecap="round" d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
                </svg>
              </div>
              <div className="space-y-2.5">
                <h4 className="text-sm font-semibold tracking-wide text-[#e2e8f0]">SSE EventStreams</h4>
                <p className="text-[12px] text-[#8892a4] leading-relaxed font-light">
                  Ultra-fast token-by-token real-time streaming directly into floating frontend widgets.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.main>

      {/* Modern Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 h-24 flex items-center justify-between border-t border-[#1e2330] relative z-10 text-[10px] text-[#4a5568] py-6">
        <span>&copy; 2026 Riam &middot; Built for AI Engineers</span>
        <a 
          href="https://github.com/mariiammaysara/RIAM" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[#4a5568] hover:text-[#8892a4] transition-colors duration-200"
          aria-label="GitHub Repository"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
        </a>
      </footer>
    </div>
  );
}
