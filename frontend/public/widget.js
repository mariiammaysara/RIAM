/**
 * Riam Embeddable Chat Widget v1.1 - Production Ready
 * Copyright (c) 2026 Riam Support. All rights reserved.
 * 
 * Dynamic Floating Chat Bubble and IFrame Sandbox Bridge loader.
 */
(function () {
    // 1. Extract dynamic configurations from current script tag
    const scriptTag = document.currentScript;
    if (!scriptTag) {
        console.error("Riam Widget: Script tag initialization context not found.");
        return;
    }

    const agentId = scriptTag.getAttribute("data-agent-id");
    const backendUrl = scriptTag.getAttribute("data-backend-url");
    const primaryColor = scriptTag.getAttribute("data-primary-color") || "#6366f1";
    const position = scriptTag.getAttribute("data-position") || "bottom-right";

    // 2. Strict Production Error Handling
    if (!agentId || !backendUrl) {
        console.error(
            "Riam Widget Error: Missing required script attribute parameters.\n" +
            "Please ensure you provide:\n" +
            "  - 'data-agent-id' (Unique identifier for your support agent)\n" +
            "  - 'data-backend-url' (Backend API service endpoint)\n" +
            "Aborting Riam widget loading."
        );
        return;
    }

    // Convert backend endpoint port 8000 to standard frontend port 3000 for local sandboxing
    const frontendHost = backendUrl.includes("localhost:8000") 
        ? "http://localhost:3000" 
        : backendUrl; // In production, frontend and backend often share domain or point correctly
    
    const embedUrl = `${frontendHost}/embed/${agentId}?color=${encodeURIComponent(primaryColor)}`;

    // 3. Coordinate CSS layout coordinates dynamically based on position settings
    const isLeft = position === "bottom-left";
    const alignmentStyle = isLeft 
        ? `
            left: 24px; right: auto; align-items: flex-start;
        `
        : `
            right: 24px; left: auto; align-items: flex-end;
        `;
    
    const wrapperOrigin = isLeft 
        ? "bottom left" 
        : "bottom right";

    // 4. Inject Premium Responsive Styles
    const style = document.createElement("style");
    style.innerHTML = `
        .riam-widget-container {
            position: fixed;
            bottom: 24px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            ${alignmentStyle}
        }
        
        .riam-widget-bubble {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, ${primaryColor} 0%, #1e1b4b 100%);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            animation: riam-float-pulse 2s infinite alternate;
        }

        .riam-widget-bubble:hover {
            transform: scale(1.08) rotate(3deg);
            box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
        }

        .riam-widget-bubble svg {
            width: 26px;
            height: 26px;
            fill: none;
            stroke: #ffffff;
            stroke-width: 2.2;
            stroke-linecap: round;
            stroke-linejoin: round;
        }

        .riam-widget-iframe-wrapper {
            position: absolute;
            bottom: 80px;
            width: 420px;
            height: 620px;
            border-radius: 20px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.08);
            opacity: 0;
            transform: scale(0.85) translateY(30px);
            transform-origin: ${wrapperOrigin};
            pointer-events: none;
            transition: all 0.35s cubic-bezier(0.165, 0.84, 0.44, 1);
            background: #ffffff;
        }

        .riam-widget-iframe-wrapper.active {
            opacity: 1;
            transform: scale(1) translateY(0);
            pointer-events: auto;
        }

        .riam-widget-iframe {
            width: 100%;
            height: 100%;
            border: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .riam-widget-iframe.loaded {
            opacity: 1;
        }

        /* Loading Spinner State */
        .riam-widget-spinner-container {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #f8fafc;
            z-index: 10;
            transition: opacity 0.3s ease;
        }
        
        .riam-widget-spinner-container.fade-out {
            opacity: 0;
            pointer-events: none;
        }

        .riam-widget-loader {
            width: 40px;
            height: 40px;
            border: 3.5px solid rgba(0, 0, 0, 0.06);
            border-top-color: ${primaryColor};
            border-radius: 50%;
            animation: riam-spin 0.8s linear infinite;
        }

        @keyframes riam-float-pulse {
            0% { transform: translateY(0); }
            100% { transform: translateY(-5px); }
        }

        @keyframes riam-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
            .riam-widget-container {
                bottom: 16px;
                left: 16px;
                right: 16px;
                width: calc(100% - 32px);
            }
            .riam-widget-iframe-wrapper {
                width: 100%;
                height: calc(100vh - 110px);
                bottom: 76px;
            }
        }
    `;
    document.head.appendChild(style);

    // 5. Build Floating UI Elements
    const container = document.createElement("div");
    container.className = "riam-widget-container";

    const bubble = document.createElement("div");
    bubble.className = "riam-widget-bubble";
    bubble.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
    `;

    const iframeWrapper = document.createElement("div");
    iframeWrapper.className = "riam-widget-iframe-wrapper";

    // Centered loading spinner
    const spinnerContainer = document.createElement("div");
    spinnerContainer.className = "riam-widget-spinner-container";
    const loader = document.createElement("div");
    loader.className = "riam-widget-loader";
    spinnerContainer.appendChild(loader);
    iframeWrapper.appendChild(spinnerContainer);

    // Secure IFrame Chat window
    const iframe = document.createElement("iframe");
    iframe.className = "riam-widget-iframe";
    iframe.src = embedUrl;
    iframe.setAttribute("allow", "clipboard-write");

    // Hide loader and show iframe when fully rendered
    iframe.onload = function () {
        spinnerContainer.classList.add("fade-out");
        iframe.classList.add("loaded");
        // Clean up loader from DOM after transitions
        setTimeout(() => spinnerContainer.remove(), 400);
    };

    iframeWrapper.appendChild(iframe);
    container.appendChild(iframeWrapper);
    container.appendChild(bubble);
    document.body.appendChild(container);

    // 6. Interactive Click Listeners
    let isOpen = false;

    bubble.addEventListener("click", () => {
        isOpen = !isOpen;
        if (isOpen) {
            iframeWrapper.classList.add("active");
            bubble.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            // Securely transmit trigger to iframe
            iframe.contentWindow.postMessage({ type: "riam-open" }, "*");
        } else {
            iframeWrapper.classList.remove("active");
            bubble.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            `;
        }
    });

    // 7. Receive postMessage signals from embedded page
    window.addEventListener("message", (event) => {
        if (event.data && event.data.type === "riam-close-widget") {
            isOpen = false;
            iframeWrapper.classList.remove("active");
            bubble.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            `;
        }
    });
})();
