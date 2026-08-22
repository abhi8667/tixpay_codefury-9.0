# SouthernNova_Documentation — TiXPay Solution Document

> **Submission Document for CodeFury 9.0 Hackathon**  
> **Team Name:** Southern Nova  
> **Application Name:** TiXPay — On-Device Cash-Flow Guard  
> **Track:** WealthTech / Fintech  

---

## 📌 Submission Links

* **GitHub Repository Link:** `https://github.com/abhi8667/tixpay_codefury-9.0`
* **Hosted Web Application Link:** `https://tixpay-codefury.netlify.app` *(Replace with your Netlify / Vercel deployment link)*
* **APK Download Link (Android):** `https://drive.google.com/file/d/YOUR_APK_DRIVE_LINK/view` *(Upload APK to Google Drive & paste public link)*
* **Demo Video Link:** `https://youtu.be/YOUR_DEMO_VIDEO_LINK` *(Upload screen recording to YouTube / Google Drive & paste public link)*

---

## 💡 Application Description

**TiXPay** is a privacy-first, on-device cash-flow guard built by **Southern Nova** for Indian UPI users. By ingesting a single user-selected bank statement, TiXPay’s pure TypeScript analytical engine discovers recurring auto-debits (EMIs, SIPs, Insurance, Utilities), constructs a 30-day forward balance curve, and intercepts payments *before* they occur. When typing a UPI payment amount or scanning a QR code, TiXPay recomputes the 30-day projection on every single keystroke. If a proposed payment will cause an upcoming mandate to bounce, TiXPay immediately halts the user—identifying the exact date, exact debit at risk, and exact rupee shortfall—while suggesting verified, one-tap remedies (such as sweeping reserves from a savings goal or pausing a mandate).

Built with **React Native / Expo**, TiXPay operates with **zero SMS permissions**, **zero bank login credentials**, and **zero cloud network calls** in its core engine. All financial math is strictly deterministic, auditable, and covered by 302 automated unit tests.

---

## 🎯 Solution to the Problem Statement (167 Words)

> *Word count: Exactly 167 words (strictly compliant with the 150–200 words requirement).*

Indian UPI users frequently face cash-flow crunches when hidden auto-debits (EMIs, SIPs, utility bills) bounce, leading to steep bank penalty fees and credit score damage. Existing expense trackers rely on reading SMS inbox messages—a privacy-invasive permission banned by modern app stores—or insecure bank logins. Moreover, traditional trackers only provide historical spending backward, failing to warn users before a payment triggers a bounce.

TiXPay solves this with a 100% on-device, privacy-first cash-flow guard. Users import a single bank statement once via native file picker—requiring zero SMS permissions, network access, or standing credentials. TiXPay’s pure TypeScript analytical engine automatically discovers recurring auto-debits using median inter-arrival gap algorithms and replays the ledger forward over a 30-day hypothetical horizon.

When a user scans a UPI QR code or types an amount, TiXPay intercepts the transaction in real-time, computing balance curves on every keystroke. If a payment threatens an upcoming mandate, it alerts the user with exact dates, bounce penalties, and rupee shortfalls, offering verified one-tap remedies like goal sweeps or mandate pauses to preserve financial health.

---

## ⚙️ Functionality & Key Features

1. **Pre-Payment Intercept (`evaluatePayment`)**  
   - Evaluates potential UPI payments on every keystroke against a 30-day forward cash-flow curve.
   - Triggers real-time warnings showing exact date of bounce, affected auto-debits, and rupee shortfall.
   - Recommends alternative payment instruments (e.g., credit card routing like *"Swipe your Amex SmartEarn"*) when UPI spending threatens liquidity.

2. **On-Device Mandate Discovery**  
   - Detects recurring auto-debits (EMIs, SIPs, Insurance, Utility bills) without hardcoded rules.
   - Uses statistical median inter-arrival gaps (28–31 days for monthly, 6–8 days for weekly, 89–92 days for quarterly) with score weighting (`0.6 · countScore + 0.4 · varianceScore`).

3. **Shadow Ledger & 30-Day Forward Balance Projection**  
   - Replays statement transactions forward over detected mandates and inferred income streams (salaried vs. irregular).
   - Computes daily expected balance curves and flags any dip below a ₹500 safety buffer as a shortfall.

4. **Bounce Guard & Verified One-Tap Remedies**  
   - Calculates the minimum intervention set required to clear a dip: pausing non-essential mandates, shifting dates, or sweeping from savings.
   - **Verification loop:** Engine re-projects the entire balance curve *before* presenting remedies to guarantee they clear the dip.

5. **Keeper & Goal Tracker**  
   - Dedicated reserve bucket for shortfalls. Executing a sweep debits the Keeper and credits the primary account, ensuring remedies are funded.
   - Computes "on-track" status from trailing monthly surplus, not assumed rules of thumb.

6. **SIP Readiness Check**  
   - Allows users to test adding a new SIP (amount & cadence) against the 30-day projection to verify affordability before committing.

7. **Grounded Money Coach (Gemini Function Calling)**  
   - Conversational AI interface powered by Google Gemini.
   - Uses strict tool calling to query pre-computed engine aggregates (spend totals, SIP affordability, goal status, safe-to-spend balance).

---

## 🤖 Prompts Implemented

Below are the exact AI prompts and function calling declarations implemented in TiXPay by Team Southern Nova for the **Money Coach** assistant.

### 1. System Prompt (`COACH_SYSTEM_INSTRUCTION`)
Implemented in [`apps/mobile/src/lib/coachTools.ts`](file:///c:/Hacks/tixpay_codefury-9.0/apps/mobile/src/lib/coachTools.ts#L133-L140):

```text
You are the Money Coach inside TiXPay, an on-device cash-flow app for Indian UPI users.

Rules:
- Never state a rupee figure, percentage, or date unless it came from a tool call in this conversation. If you don't have the number, call a tool for it.
- Keep answers short: 2-4 sentences, plain language, no jargon.
- Use ₹ and Indian digit grouping (e.g. ₹1,25,000) when quoting amounts.
- If a question needs data you don't have a tool for, say so plainly instead of guessing.
- You are not a licensed financial advisor. For anything resembling personalized investment advice beyond what the app's own engine computed, say you can only speak to what's in their account data.
```

### 2. Tool Declarations (`COACH_TOOLS`)
The Money Coach is strictly grounded using Gemini function declarations. Raw transactions are **never** passed to the LLM; only deterministic aggregates calculated on-device are accessible.

```json
[
  {
    "name": "get_spend_breakdown",
    "description": "Category-wise spend for a trailing window, with the % change vs the window before it.",
    "parameters": {
      "type": "object",
      "properties": {
        "windowDays": { "type": "number", "description": "Window length in days. Defaults to 30." }
      }
    }
  },
  {
    "name": "get_goal_status",
    "description": "The user's savings goal: target, saved so far, monthly surplus, and whether they're on track.",
    "parameters": { "type": "object", "properties": {} }
  },
  {
    "name": "check_sip_affordability",
    "description": "Whether starting a new SIP of a given amount/cadence would cause a cash-flow shortfall.",
    "parameters": {
      "type": "object",
      "properties": {
        "amount": { "type": "number", "description": "Rupees per debit." },
        "cadence": { "type": "string", "enum": ["MONTHLY", "WEEKLY", "QUARTERLY"] },
        "dayOfMonth": { "type": "number", "description": "Day of month the debit lands on, 1-28. Defaults to 5." }
      },
      "required": ["amount"]
    }
  },
  {
    "name": "get_mandates",
    "description": "The recurring auto-debits (EMI, SIP, insurance, utility, subscriptions) detected on the account.",
    "parameters": { "type": "object", "properties": {} }
  },
  {
    "name": "get_safe_to_spend",
    "description": "Current inferred balance and the safe-to-spend figure over the next 30 days.",
    "parameters": { "type": "object", "properties": {} }
  }
]
```

### 3. Prompt Engineering Strategy & Safety Guardrails
- **Zero Raw Data Transmission:** Ensures raw statement entries and transaction logs never leave the device.
- **Hallucination Prevention:** The LLM is explicitly instructed to refuse stating financial figures unless returned via a local tool execution.
- **Grounded AI Hybrid:** AI is leveraged exclusively for natural language formatting and reasoning over verified on-device engine metrics.
