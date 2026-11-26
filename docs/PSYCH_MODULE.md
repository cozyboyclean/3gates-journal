# Psychology & Peak Performance module (v1.9.0)

A complementary module for the 3 Gates Trade Journal. It reuses what the journal already captures and adds only what was missing. All code is in `app/psych.js`; hooks in `core.js` (settings merge), `forms.js` (trade form section, drawer) and `views.js` (daily journal banner).

## 1. Audit of the existing journal (v1.8.0)

| Already captured, reused | Gap the module fills |
|---|---|
| Trade P&L, R, MFE/MAE, layered entries/exits | Premarket readiness and the session's likely trap |
| 3-Gate playbook block: state, HTF setup, locations, triggers, G1/G2/G3, "written before entry" | Mental rehearsal (implementation intentions) |
| `pbClassify`: rule-based compliance, never P&L | Live, in-session emotional state and urges |
| Missed trades + reasons | Split of misses into psychological vs practical |
| Emotional-state tag, Mistakes tag, ± comments (chased / early / moved stop / fear exit) | Why you entered (motive), planned vs reactive, rationalization, emotional exit |
| Daily journal: plan, review, did well, do better, lesson | Resisted impulses, circuit breaker, daily process score, pattern maps, weekly review, development program |

Reused rather than duplicated: gate answers and compliance (validity comes from `pbClassify`), missed-trade reasons, the existing negative comments and Mistakes tags (feed execution flaws), the daily journal's `plan`, `right` and `lesson` fields (Premarket plan, "what I executed well", and the single adjustment for next session). Nothing was removed. Mood / Plan followed / Session grade in the daily journal stay, but the process score supersedes them.

## 2. Architecture

```
Today (A Readiness → B Rehearsal → C Live → D Trades → E Debrief)  ──writes──▶ S.journal[date].psy
Trade form · Psychology block                                       ──writes──▶ trade.psy
psyEval(date): playbook validity + trade.psy + day.psy  →  rows, circuit breaker, category scores, process score
Mind dashboard / Weekly review / 30-session program / Operating code  ←  psyAgg(psyEval over days)
Mental playbook · Settings  ──writes──▶ S.settings.psy
```

Data (additive; older `journal.json` loads unchanged):

- `S.journal[date].psy = { type: 'trade'|'off', pre: {sleep, energy, clarity, stable, conf, patience, uncert, stress, finp, urge, fearl, resid (1–5), trap, trig, resp, obj[], success, maxT}, reh: {scenarioId: 1}, ev: [{id, at(ms), tag, act}], post: {done, deep, chains: [{dev, label, pat, trigger, interp, emotion, urge, behavior, shortC, longC, belief, evidence, corrective}]} }`
- `S.journal[monday].psyWeek = { read, commit, target }`
- `trade.psy = { motive, origin: planned|reactive, conf 1–5, hes: none|ontime|late|size, urg: yes|no, risk: yes|no, rat: yes|no, exit: sys|emo }`
- `S.settings.psy = { maxTrades 3, maxDailyLoss 400, maxRiskTrade 150, cooldownMin 10, researchInPlan true, psychMiss [...], patterns [5], scen [8], programStart, since }`

`since` is set the first time Today is used. Days before it are not scored, so pre-module history doesn't drag averages down.

## 3. Workflow and fields

| Phase | Time | Inputs |
|---|---|---|
| A · Readiness | 3–5 min | 12 one-tap 1–5 scales; trap (5 loops, one suggested); trigger; if-then response (prefilled from the loop); 1–2 behavioral objectives; success without P&L; max trades (defaults from readiness); premarket plan |
| B · Rehearsal | 1–2 min | 8 scenarios with if-then responses, one tap each or "mark all". Collapses once done |
| C · Live | seconds | 12 tags (FOMO, hesitation, frustration, boredom, impatience, fear, overconfidence, revenge urge, married to direction, money urgency, lost focus, urge to deviate); quick Win/Loss/Rule break; each tag opens the 15-second reset, which ends with Resisted / Paused / Acted |
| D · Trades | per trade | Psychology block: motive, planned/reactive, confidence, hesitation, urgency, risk rules, rationalized, exit type |
| E · Debrief | 5–8 min | Auto summary; "executed well"; list of detected deviations, each with a one-click pattern map (placeholders prefilled from the loop); single adjustment; Finish. With no deviations, nothing to map (deep review is optional) |

## 4. Readiness classification

Index = mean of normalized answers ×100 (good items: (v−1)/4; risk items: (5−v)/4), with at least 6 of 12 answered. A red flag is any risk item at 5, or sleep / clarity / stability at 1.

| Level | Rule | Recommendation |
|---|---|---|
| Green | index ≥ 65, no flags | Normal plan and size; circuit starts Green |
| Yellow | 45–64 or 1 flag | A+ only, smallest size, max 2 trades, first rule break ends session; circuit starts Yellow |
| Red | < 45 or ≥ 2 flags | Observe / sim; if live, 1 A+ trade at minimum size; circuit starts Yellow |

## 5. Trade classification

Validity: `compliant` → valid; `research` → valid if `researchInPlan`, else unclear; `offplaybook` → invalid; undetermined/unreviewed → unclear. Overrides: rationalized = yes → invalid; the (max+1)th trade and beyond → invalid (overtrading).

Six classes: valid winner, valid loser, invalid winner, invalid loser, missed (psychological: reason in `psychMiss`), missed (practical). Unclear trades show as "not yet classifiable".

## 6. Process score (0–100)

Score = Σ wᶜ·sᶜ / Σ wᶜ over applicable categories, ×100. P&L is never an input except for the hard risk checks.

| Category | w | sᶜ |
|---|---|---|
| Preparation | 10 | .3·(answered/12) + .1·(trap, response, objective set)/3 + .3·rehearsed share + .3·(plan ≥ 20 chars) |
| Plan & 3 Gates selection | 25 | 1 − .5·(invalid trades charged here) − .15·(unclear trades) |
| Execution discipline | 15 | mean over non-invalid trades of 1 − .4·entry flaw − .3·off-plan management − .4·emotional exit; each psychologically missed setup = .25. N/A if none |
| Risk discipline | 20 | 0 if any risk rule broken, else 1. **Total capped at 49** |
| Emotional regulation & recovery | 15 | 1 − .5·(revenge/tilt trades) − .2 if Yellow reached with no reset logged; 0 if a trade was taken while Red. **Total capped at 59 when trading while Red** |
| Impulse control | 10 | (resisted + 1) / (resisted + acted + 1) |
| Post-session review | 5 | .6·debrief finished + .4·(≥1 deviation mapped, or no deviations) |

Risk rules: stop exists; risk ≤ maxRiskTrade +10%; result not worse than −1.25R (or "Let loser run past stop"); risk rules answered yes; no trade after cumulative loss ≤ −maxDailyLoss; not more than 10% past the limit.

No double counting: each invalid trade is charged to exactly one category, in this order: Risk (only reason was a missing stop) → Emotional (motive = make back a loss, or entered within the cooldown after a loss/invalid trade) → Impulse (over max, reactive, impulsive motive, or an urge marked "acted" within 5 min before entry) → Selection. Execution only judges non-invalid trades. A "Moved stop" is not charged to management when the same trade already broke the stop rule. Acted urges that became a trade count once (as the trade).

Bands: 90+ Elite · 80–89 Professional · 65–79 Developing · 50–64 Inconsistent · < 50 Compromised. Off days: no score.

### Worked examples (hypothetical test sessions, all verified in `tests`)

| Session | What happened | Score |
|---|---|---|
| Clean losing day | Full prep, 2 valid −1R losses, debrief done | 100 |
| Profitable, undisciplined | Valid loss → revenge trade 3 min later (+3R) → FOMO trade while Red (+2R) → 4th trade over max (+2R) | 59 (raw 78, capped) |
| Risk break, else perfect | 1 valid winner sized 10 MNQ ($400 risk vs $150 max) | 49 (raw 78) |
| Disciplined no-trade | Prep, FOMO and boredom urges resisted, no trades | 100 |
| Hesitation day | Readiness Yellow; late entry on a valid winner; 1 valid setup missed (hesitated), 1 missed (away); no debrief | 86 |
| Emotions handled | Fear noted, frustration resisted within 15 min → Yellow; valid trade after | 97 (emotions not penalized) |
| Rationalized trade | Valid trade with fear exit + a trade marked rationalized | 77 |

## 7. Circuit breaker

Replays the session in time order (tags, then logged trades; quick outcome taps count only while no trades are logged).

- Start: Green; Yellow if readiness is Yellow/Red or the previous session ended Red.
- → Yellow: 2+ tags within 15 min; an urge acted on; a revenge urge; 1 invalid trade; 2 losses in a row; down 50% of the daily limit.
- → Red: 2nd invalid trade; invalid trade while Yellow; revenge/tilt trade; any risk-rule break.
- Hard stop: cumulative loss ≥ daily limit. Financial limits always override.
- Yellow → Green: after a Resisted/Paused log, tap "back to Green". Red does not clear within the session.

Allowed / prohibited / required / resume / end for each level are in Mental playbook → Rehearsal & circuit breaker.

## 8. Pattern playbook

Your 17 listed problems are grouped into 5 root loops, so symptoms aren't treated separately: Missing-out (FOMO, chasing, early entries), Loss-repair (revenge, money pressure, recency), Certainty-seeking (hesitation, fear of loss, over-reading the DOM, constant tweaking), Narrative-attachment (direction bias, abandoning plan, rationalizing, inventing setups), Stimulation-seeking (boredom, overtrading). Each loop has symptoms, warnings, triggers, interpretation, emotion, urge, behavior, short/long consequence, belief, replacement belief, corrective, prevention and a rehearsed if-then. All of it is editable.

## 9. Weekly review

Mon–Sun vs the previous week: average score, adherence, 3-Gates all-yes, invalid trades, psychological misses, resisted vs acted, risk violations, next-trade validity after win / loss / mistake, top triggers, top loops, score by readiness. Bottleneck = category with the most score points lost; the review shows evidence, one behavior, one exercise and one measurable target, plus 3 reflection fields. A sample-size warning is always shown.

## 10. 30-session program

Six phases × blocks of 5 scored sessions. A phase advances only when its success condition is met; otherwise the block repeats.

1. Awareness: readiness + debrief on 4/5 sessions; 90% of trades have a motive.
2. Impulse control: ≤ 1 invalid trade; every urge tag gets a decision.
3. Execution confidence: ≥ 85% of valid opportunities taken (≥ 1); ≤ 1 hesitation-hurt entry.
4. Emotional regulation: 0 revenge/tilt trades, 0 emotional exits, every trade after a loss valid.
5. Consistency under pressure: average ≥ 80, minimum ≥ 65, after-red-day vs after-green-day within 10 points.
6. Integration: average ≥ 85, 0 risk violations, no invalid trades in 4/5.

## 11. Quality control: known limits

- Self-report fields (motive, hesitation, rationalized) can be shaded. Validity still comes from the gate answers, so honesty there decides everything.
- Unclear trades are penalized lightly (−15%) so leaving fields blank is never a way to dodge a −50%.
- A no-trade day can score 100. Psychological misses and the execution-confidence phase stop avoidance from looking good.
- All thresholds (weights, −1.25R, 15-min tag window, 5-min urge link) are coaching choices, not research constants. The underlying ideas (implementation intentions, process-over-outcome evaluation, urge awareness) are evidence-based; the numbers are not.
- Research-candidate setups count as in-plan by default because none of your setups are approved yet. Switch it off once you approve setups.
