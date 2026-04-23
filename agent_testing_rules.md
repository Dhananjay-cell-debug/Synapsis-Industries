# MANDATORY AGENT TESTING PROTOCOL

**Author:** Kontentwala User & Antigravity Lead
**Enforcement:** STRICT AND MANDATORY

## Rule 1: The "Show, Don't Tell" Policy
Never assume that a successful terminal build (`npm run dev` success) means the UI is functioning correctly. Before handing over *any* response, fix, or feature to the user, the agent **MUST** deploy the `browser_subagent` to visually test the changes on `localhost`.

## Rule 2: Subagent Visual Verification
The subagent must be instructed to:
1. Navigate to the local server.
2. Scroll to the specific component that was modified.
3. Check for any React error overlays (like WebGL crashes or hydration errors).
4. Confirm the presence of the new DOM elements.

## Rule 3: Error Transparency
If the subagent encounters an environment-specific error (e.g., headless browser lacking WebGL), the agent must explicitly state this context to the user *alongside* the confirmation that the code syntax itself compiled flawlessly.

**Failure to follow these protocols will result in immediate rejection of the agent's work.**
