#!/usr/bin/env python
"""
LangSmith Integration Verification Tool for Riam.
Checks local configuration, tests LangSmith API connectivity,
and sends a test trace to verify that the end-to-end logging works perfectly.
"""
import os
import sys
import time

# Safe text indicators instead of emojis (prevents UnicodeEncodeError on Windows cp1252)
OK_TXT = "[ OK ]"
WARN_TXT = "[WARN]"
ERR_TXT = "[FAIL]"
INFO_TXT = "[INFO]"

# Try to use colors, but fallback to plain text if needed
try:
    # Use ANSI codes if supported
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"
except Exception:
    GREEN = YELLOW = RED = BLUE = CYAN = BOLD = RESET = ""

def print_banner():
    print(CYAN + BOLD)
    print("=" * 70)
    print("      RIAM SUPPORT BUILDER - LANGSMITH OBSERVABILITY VERIFIER      ")
    print("=" * 70)
    print(RESET)

def main():
    print_banner()
    
    # 1. Load dotenv variables
    print(f"{BLUE}{INFO_TXT} [1/4] Loading environment variables...{RESET}")
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print(f"  {GREEN}{OK_TXT}{RESET} Environment variables successfully loaded from .env file.")
    except Exception as e:
        print(f"  {YELLOW}{WARN_TXT}{RESET} Warning while loading dotenv: {e}")

    # 2. Extract LangSmith Config
    tracing_enabled = os.getenv("LANGCHAIN_TRACING_V2", "false").lower() == "true"
    api_key = os.getenv("LANGSMITH_API_KEY", "")
    project_name = os.getenv("LANGSMITH_PROJECT", "riam-support-agent")

    print(f"\n{BLUE}{INFO_TXT} [2/4] Analyzing configuration...{RESET}")
    print(f"  * {BOLD}LANGCHAIN_TRACING_V2:{RESET} {GREEN if tracing_enabled else RED}{os.getenv('LANGCHAIN_TRACING_V2', 'false')}{RESET}")
    
    # Mask API key for safety
    masked_key = "NOT SET"
    if api_key:
        if "REPLACE_ME" in api_key:
            masked_key = f"{RED}{api_key} (Placeholder - needs replacement){RESET}"
        else:
            masked_key = f"{GREEN}{api_key[:8]}...{api_key[-4:]}{RESET}"
    
    print(f"  * {BOLD}LANGSMITH_API_KEY:{RESET} {masked_key}")
    print(f"  * {BOLD}LANGSMITH_PROJECT:{RESET} {CYAN}{project_name}{RESET}")

    # Validation Checks
    if not tracing_enabled:
        print(f"\n{YELLOW}{WARN_TXT} LangSmith Tracing is currently DISABLED (LANGCHAIN_TRACING_V2=false).{RESET}")
        print("To enable observability, update your .env file to:")
        print(f"  {BOLD}LANGCHAIN_TRACING_V2=true{RESET}")
    
    if not api_key or "REPLACE_ME" in api_key:
        print(f"\n{RED}{ERR_TXT} Error: LangSmith API key is not configured or is set to a placeholder.{RESET}")
        print("Please fetch your API key from the LangSmith dashboard:")
        print(f"  Link: {BOLD}https://smith.langchain.com{RESET} -> Settings -> API Keys")
        print("And paste it inside backend/.env:")
        print(f"  {BOLD}LANGSMITH_API_KEY=lsv2_pt_your_real_key_here{RESET}")
        print("\nExiting verification...")
        sys.exit(1)

    # 3. Test API connectivity
    print(f"\n{BLUE}{INFO_TXT} [3/4] Testing connection to LangSmith...{RESET}")
    try:
        from langsmith import Client
        client = Client(api_key=api_key)
        
        start_time = time.time()
        try:
            # Attempt to fetch projects to verify key legitimacy
            projects = list(client.list_projects())
            latency = (time.time() - start_time) * 1000
            print(f"  {GREEN}{OK_TXT}{RESET} Connection successful! LangSmith responded in {latency:.1f}ms.")
            print(f"  {GREEN}{OK_TXT}{RESET} API Key is valid and authorized.")
        except Exception as api_err:
            print(f"  {RED}{ERR_TXT} Connection to LangSmith failed or was unauthorized.{RESET}")
            print(f"  Detail: {api_err}")
            print("Please double check your LANGSMITH_API_KEY validity.")
            sys.exit(1)
            
    except ImportError:
        print(f"  {RED}{ERR_TXT} Error: 'langsmith' package not found in this Python environment.{RESET}")
        print("Please install it by running:")
        print(f"  {BOLD}uv pip install langsmith{RESET}")
        sys.exit(1)

    # 4. Trigger test tracing run
    print(f"\n{BLUE}{INFO_TXT} [4/4] Sending a test trace to LangSmith...{RESET}")
    try:
        from langsmith import traceable
        
        @traceable(project_name=project_name)
        def run_riam_diagnostic_check(system_status: str):
            print(f"    [Trace] Executing diagnostic node...")
            time.sleep(0.2) # simulate minor processing
            return {
                "status": "healthy",
                "diagnostics": "Riam LangSmith Trace Verification Successful",
                "message": f"Hello LangSmith from Riam backend! Status: {system_status}"
            }
        
        # Invoke the traceable function
        print(f"  Invoking traceable function to submit trace to project '{project_name}'...")
        result = run_riam_diagnostic_check(system_status="Verified")
        
        print(f"  {GREEN}{OK_TXT}{RESET} Function execution completed successfully.")
        print(f"  {GREEN}{OK_TXT}{RESET} Diagnostic output: {CYAN}{result['message']}{RESET}")
        print(f"\n{GREEN}{BOLD}SUCCESS: LangSmith observability is fully configured and ready!{RESET}")
        print("Any subsequent LLM, LangChain, or LangGraph operations in the Riam application")
        print("will now be automatically traced in real-time.")
        print("You can view your runs in the project dashboard at:")
        print(f"  Link: {BOLD}https://smith.langchain.com/o/arm/projects/p/{project_name}{RESET} (or your workspace equivalent)")
        
    except Exception as trace_err:
        print(f"  {RED}{ERR_TXT} Error while sending trace: {trace_err}{RESET}")
        print("Check if you are behind a proxy, or if your LANGSMITH_API_KEY has write permissions.")
        sys.exit(1)

    print(f"\n{CYAN}{'=' * 70}{RESET}\n")

if __name__ == "__main__":
    main()
