# REDACT ZERO — AI Agent Rules & Engineering Directives (AS Studio)

## 1. Project Overview & Architecture
- **Purpose**: 100% Client-Side, Zero-Knowledge PDF / Document redaction & anonymization web tool.
- **Stack**: Vite, TypeScript / JavaScript, WebAssembly (PDF.js / Tesseract / Canvas), TailwindCSS.
- **Privacy Core**: Zero network requests for processing. All sanitization happens strictly in the client browser memory.

## 2. Universal Agent Directives
- **Language**: Hinglish (Roman script) ya English only.
- **Tone**: Direct, concise, engineering-first.
- **Plan & Verification**: Plan -> Surgical Code Changes -> Build/Test -> Auto-Cleanup.

## 3. Node Modules & Auto-Cleanup Protocol
- **Use & Throw**: Is repo mein `node_modules` ko persist rakhna laazmi nahi hai. Har session ke end par `dist/` aur temporary test bundles ko auto-clean kiya jaye.
- **Offline Install**: Jab bhi dependencies verify ya install karni hon, hamesha `npm install` (jo global cache se sub-second execute hota hai) use karein; internet se fresh packages fetch karna mana hai.

## 4. Privacy & Zero-Data-Leak Guardrail
- Code mein kabhi bhi tracking, external telemetry, third-party analytics scripts, ya cloud storage endpoints add nahi karne.
