# Person B — Feature Logic & Engine Lead

**TiXPay UPI · 24h hackathon · `packages/engine` · pure TypeScript**

You never open Android Studio. You never wait for a build. Everything you write runs in `vitest` in under a second.

---

## 0. Your one job

Turn a raw SMS inbox into: *"you'll be ₹3,200 short on the 12th, your SIP will bounce, pausing Netflix fixes it."*

No network. No React. No native bridges. No database. Pure functions in, pure data out.

---

## 1. Rules of engagement

**Golden rule:** zero platform dependencies. If a function can't run under `vitest` on a laptop with no emulator, it's in the wrong package.

**Never call `new Date()` inside engine logic.** Every function that touches time takes `now: Date` as a parameter. This is what makes Person C's World Clock work — the simulator advances "today" by passing a different `now`. One stray `new Date()` and the slider silently does nothing, and it will be found at hour 18 by someone who isn't you.

```ts
// ✅
export function projectBalance(ledger: ShadowLedger, mandates: Mandate[],
                                income: IncomeEvent[], now: Date, days = 30): BalanceCurve

// ❌
export function projectBalance(ledger, mandates, income) {
  const today = new Date();  // breaks the entire simulator
}
```

**Never throw.** Malformed SMS returns `null`. A mandate with garbage timestamps gets `confidence: 0` and is filtered. Person C's store has no error boundary and a throw at hour 22 is a crashed demo.

**Import types from the shared contract only.** After hour 3, `types.ts` is additive-only. Need a new field? Add it optional and tell C.

---

## 2. Hour 0: write the fixtures first

Before any implementation. This is 40 minutes that saves three hours.

`fixtures/sms_cases.json` — ~30 hand-labelled cases:

```json
[
  {
    "name": "hdfc_upi_debit",
    "raw": {
      "address": "AD-HDFCBK",
      "body": "Rs.649.00 debited from a/c **4471 on 15-03-26 to VPA netflix.rzp@icici. Ref 507412889231. Avl Bal Rs.18,204.55. Not you? Call 18002586161",
      "date": 1773532800000
    },
    "expect": {
      "direction": "DEBIT", "amount": 649, "vpa": "netflix.rzp@icici",
      "accountTail": "4471", "balanceHint": 18204.55,
      "refNo": "507412889231", "bank": "HDFC", "isFailure": false
    }
  }
]
```

Cover: debit, credit, salary credit, failed autopay, mandate registration, OTP (must return `null`), promotional (must return `null`), balance enquiry, ATM withdrawal, card transaction (not UPI).

Then:

```ts
// test/parse.test.ts
import cases from '../fixtures/sms_cases.json';
describe.each(cases)('$name', ({ raw, expect: want }) => {
  it('parses', () => expect(parseSms(raw)).toMatchObject(want ?? null));
});
```

Run `vitest --watch` and leave it running for 24 hours.

---

## 3. `parse/` — SMS → Transaction

```ts
export function parseSms(raw: RawSms): Transaction | null
```

### Sender identification

Indian bank SMS arrive as `AD-HDFCBK`, `VM-SBIINB`, `JD-ICICIB`, `AX-KOTAKB`, `VK-AXISBK`, `BP-PNBSMS`.

**Match on the trailing 6-character entity code, never the full header.** The two-letter operator prefix varies by telecom circle, and DLT adds `-S` / `-T` / `-P` suffixes. Matching the whole string will silently drop half the inbox on a different SIM.

```ts
const entity = address.toUpperCase().match(/([A-Z]{6})(?:-[STP])?$/)?.[1];
const BANKS: Record<string, BankCode> = {
  HDFCBK: 'HDFC', SBIINB: 'SBI', ICICIB: 'ICICI',
  KOTAKB: 'KOTAK', AXISBK: 'AXIS', PNBSMS: 'PNB',
};
```

### Extraction, in order

1. **Reject early** — OTP, promotional, "will be debited" (future notice, not a transaction). Cheap keyword filter, run first.
2. **Direction** — `debited|withdrawn|paid|spent` → DEBIT; `credited|received|deposited` → CREDIT
3. **Amount** — `/(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i`, strip commas
4. **VPA** — `/([a-z0-9._-]+@[a-z]{3,})/i`
5. **Account tail** — `/(?:a\/c|account)\s*(?:no\.?)?\s*[x*]*(\d{4})/i`
6. **Balance hint** — `/(?:avl|available)\s*bal(?:ance)?\s*(?:is)?\s*(?:rs\.?)?\s*([\d,]+\.?\d*)/i`
7. **Failure flag** — `insufficient|could not be processed|failed|declined|returned|bounce`
8. **Merchant hint** — free text after `to` / `at`, before the ref number

Build it as a **registry with a shared fallback**, not six independent parsers. Most Indian bank SMS follow a similar shape; write generic extractors and let bank-specific overrides handle the exceptions. Six bespoke parsers is six times the surface area for a demo that only runs on one phone.

### Target

Person C dumps the real inbox at hour 2 and runs `measure.ts`. Your number is **>70% of financial SMS parsed**. Below that, drop to the top two banks by volume in that inbox and hardcode. Breadth is worthless when only one device is being demoed.

---

## 4. `detect/` — Transaction → Mandate

```ts
export function detectMandates(txns: Transaction[], now: Date): Mandate[]
```

### The algorithm — read this carefully

The spec elsewhere calls this "time-delta autocorrelation." **Do not implement autocorrelation.** With 3–6 observations per mandate the ACF is numerically fragile and will eat four hours for no accuracy gain. The phrase is for the pitch; this is the implementation:

1. **Normalise the VPA** — lowercase, strip numeric order IDs, strip common suffixes:
   `netflix.rzp@icici` → `netflix`, `swiggy.payu.12345@hdfc` → `swiggy`
2. **Bucket** by `(normalizedVpa, amount ±2%)`
3. **Sort timestamps**, compute consecutive inter-arrival gaps in days
4. **Take the median gap** (median, not mean — one missed month shouldn't destroy the signal) and classify:
   - 28–31 → `MONTHLY`
   - 6–8 → `WEEKLY`
   - 89–92 → `QUARTERLY`
   - anything else → discard
5. **Confidence:**
   ```ts
   const countScore = Math.min(occurrences / 6, 1);
   const varScore   = 1 - Math.min(stdDev(gaps) / 5, 1);
   const confidence = 0.6 * countScore + 0.4 * varScore;
   ```
6. **Require ≥3 occurrences** to surface at all
7. **`nextDebit`** — last occurrence + median gap, projected forward past `now`

### Categorisation

Keyword table on the normalised VPA and merchant hint:

```ts
const CATEGORY: Array<[RegExp, Category, Priority]> = [
  [/emi|loan|finserv|bajaj|hdb/i,          'EMI',       'CRITICAL'],
  [/sip|mutual|groww|zerodha|kuvera|nippon/i,'SIP',      'CRITICAL'],
  [/insur|lic|policy|premium|term/i,        'INSURANCE', 'HIGH'],
  [/electric|gas|water|broadband|bses|jio/i,'UTILITY',   'MEDIUM'],
  [/netflix|hotstar|prime|spotify|zee/i,    'OTT',       'LOW'],
];
```

Priority order for interventions: `EMI > SIP > INSURANCE > UTILITY > OTT > OTHER`.

**Detect quarterly mandates even though the 30-day curve won't show them.** Person A's Hub displays them; the projection just won't include them. Don't filter them out at detection.

---

## 5. `project/` — the shadow ledger

We cannot read the real account balance — that requires a UPI PIN inside a licensed PSP app. We reconstruct it.

```ts
export function buildLedger(txns: Transaction[]): ShadowLedger
export function inferIncomeEvents(txns: Transaction[]): IncomeEvent[]
export function projectBalance(ledger: ShadowLedger, mandates: Mandate[],
                                income: IncomeEvent[], now: Date, days = 30): BalanceCurve
```

### `buildLedger`

Walk transactions chronologically, accumulating. **Whenever `balanceHint` is present, snap to it** and record the drift between your running figure and the stated one.

Expose `drift` on the ledger — it's a genuinely good diagnostic and makes a nice honest line in the pitch: *"our inferred balance tracks the bank's stated balance to within ₹X."*

```ts
balanceAt(date: Date): number   // ledger needs this for classifyFailure
```

### `inferIncomeEvents`

Recurring large credits. Handle two patterns, because the synthetic corpus contains both:
- **Salaried** — same amount ±5%, same day of month ±2 days
- **Irregular** — variable amounts, variable dates (freelance). Use a rolling 90-day mean and median gap; lower confidence.

### `projectBalance`

Start from `ledger.balanceAt(now)`. Step one day at a time for `days`. On each day, apply any mandate whose `nextDebit` falls there (skip `isPaused === true`) and any projected income. Emit a `BalancePoint` per day with its `events[]` so Person A can render markers.

Always emit exactly `days` points — Person A's morph animation interpolates point-by-point and requires both curves to have identical length.

---

## 6. `guard/` — shortfalls and interventions

```ts
export function findShortfalls(curve: BalanceCurve, buffer = 500): Shortfall[]
export function rankByPriority(mandates: Mandate[]): Mandate[]
export function proposeInterventions(shortfall: Shortfall, mandates: Mandate[],
                                      ledger: ShadowLedger, now: Date): Intervention[]
```

`findShortfalls` — any day where `balance < buffer`. Group contiguous days into one `Shortfall`. `deficit` is the magnitude of the worst point.

`proposeInterventions` — generate **2–3 maximum**, ranked by `penaltyAvoided`:

- **`PAUSE`** — pause the lowest-priority at-risk mandate. Only propose if pausing actually clears the deficit.
- **`SWEEP`** — move `deficit + buffer` in from elsewhere. Round up to the nearest ₹500 (a real human instruction, not `₹3,247`).
- **`SHIFT`** — move a mandate's debit date past the next income event.

**Penalty model:**
```ts
const PENALTY: Record<Category, number> = {
  EMI: 500, SIP: 250, INSURANCE: 250, UTILITY: 100, OTT: 0, OTHER: 100,
};
```
Note `OTT: 0` — a failed UPI Autopay on Netflix costs nothing but a service pause. The money is in NACH and EMI bounces. Being accurate here is what survives a judge who works in fintech.

**Precompute `resultingCurve` on every intervention.** Person A's morph animation must be instant; it cannot wait for a recalculation on tap.

---

## 7. `attribute/` — cause attribution

```ts
export function classifyFailure(failed: Transaction, ledger: ShadowLedger): FailureCause
```

Cheap, because the ledger already exists:

- `ledger.balanceAt(failed.timestamp) < failed.amount` → **`LIQUIDITY`** (needs a calendar shift)
- Balance was healthy → **`INTENTIONAL`** (user actively stopped it; needs a value/reminder prompt)
- No reliable balance within 7 days → **`UNKNOWN`** (say so; don't guess)

That third branch matters. A confident wrong classification is worse than an honest gap.

---

## 8. `route/` — instrument router

```ts
export function resolveMcc(vpa: string, qrPayload?: UpiIntent): { mcc: string; confidence: number }
export function recommendInstrument(mcc: string, amount: number, cards: Card[],
                                     mtdSpend: Record<string, number>): Recommendation
```

### Context you need

Only **RuPay** credit cards can be linked to UPI. Visa/Mastercard/Amex cannot. So the interesting recommendation isn't "card A over card B" — it's *"don't pay this by UPI at all, swipe your Visa."* Your `Recommendation` carries `rail: 'UPI' | 'CARD_SWIPE'` and that's the differentiated output.

### `resolveMcc`

The UPI deep link spec has an `mc` field — use it when `qrPayload` provides one (`confidence: 1.0`). Otherwise fall back to `vpa_patterns.json` regex matching (`confidence: 0.6`). Unknown → generic MCC, `confidence: 0.2`. **Always return a confidence**; Person A renders it and we never present a guess as certain.

### `recommendInstrument`

Evaluate in this order:
1. Filter out cards where `mccExclusions` includes this MCC
2. Check `monthlyRewardCap` headroom against `mtdSpend` — a capped-out card is worth its base rate, not its headline rate
3. Check `feeWaiverThreshold` proximity — being ₹4,000 from a waiver on a ₹5,000 annual fee dominates any reward-rate difference
4. Compute effective ₹ value, rank
5. If the winner isn't `upiLinkable`, set `rail: 'CARD_SWIPE'` and put the reason in plain language

`reason` is rendered verbatim on stage. Write it as a sentence a person would say: *"You're ₹4,000 from your fee waiver"*, not *"waiver_delta: 4000"*.

---

## 9. Static data — author this in hour 1

`data/cards.json` — 8–10 cards. Mix of RuPay (UPI-linkable) and Visa/Amex (swipe-only). Include at least one card that is **capped out** and one that is **near its fee waiver** — those two produce the interesting recommendations.

`data/vpa_patterns.json` — regex → MCC:
```json
{ "swiggy|zomato|eatsure": "5814", "bses|torrent|adani|tatapower": "4900",
  "netflix|hotstar|primevideo|spotify": "4899", "croma|reliancedigital": "5732" }
```

`data/mcc_map.json` — MCC → human label.

---

## 10. `generate.ts` — synthetic corpus

You own this because you need the fixtures at hour 0.

```bash
pnpm tsx scripts/generate.ts --seed 42 --out fixtures/demo_inbox.json
```

Must produce:
- ~400 messages across 6 bank sender formats
- **8 seeded mandates** — at least one EMI, one SIP, two OTT, one insurance, one utility
- One **salaried** income pattern and one **irregular** freelance pattern
- **One guaranteed shortfall on day 12** where a SIP fails and pausing an OTT saves it
- 2–3 historical failures: one liquidity, one intentional (for `classifyFailure`)
- Realistic noise: OTPs, promos, balance enquiries that must parse to `null`

**Deterministic seed.** The demo must be byte-identical every run. A stage demo that produces different numbers on the second run is a demo that gets a question you can't answer.

---

## 11. Hour plan

| Hour | Do |
|---|---|
| 0–1 | Repo, workspace, vitest, **`sms_cases.json` fixtures first**, `data/*.json` |
| 1–2 | `generate.ts` → `demo_inbox.json` |
| 2–3 | `parseSms` registry → run against C's real-inbox dump, report coverage |
| 3–7 | `detectMandates` + categorisation |
| 7–12 | `buildLedger`, `inferIncomeEvents`, `projectBalance` |
| 12–16 | `findShortfalls`, `proposeInterventions`, precomputed curves |
| 16–19 | `recommendInstrument`, `classifyFailure` |
| 19–21 | Bug support for C's integration |
| 21+ | Freeze |

---

## 12. Traps

- **`new Date()` inside a function.** The one bug that costs the demo. Grep for it before every commit.
- **Over-engineering the parser.** Six bespoke bank parsers is a trap. Generic extractors plus overrides.
- **Autocorrelation.** Don't. Median gap. See §4.
- **Timezone drift.** All timestamps epoch-ms UTC internally; format at the UI boundary only. IST is +5:30 and a naive day-boundary calculation will put a debit on the wrong day.
- **Mutating inputs.** C's Zustand store will re-render unpredictably. Return new objects, always.
- **Floating-point rupees.** `0.1 + 0.2` problems will show up in a balance curve. Round to 2dp at every boundary, or work in paise integers internally.
- **Waiting to integrate.** Export a `runPipeline(inbox, now)` convenience function early so C can wire the whole chain before the individual pieces are finished.
