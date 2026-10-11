# 27B vs Flash-Next: the 6 prompts + the grader

These are the exact six jobs I gave Qwen 3.8 27B and Strata's Flash-Next Coder on my 12GB card (RTX 4070 SUPER, 32GB RAM). Run them on your own model and card and compare.

## What's in here

| File | What it is |
|---|---|
| `prompts/1-cold-lead-text.txt` | Write one follow-up text to a quiet lead |
| `prompts/2-invoice-fix.txt` | Fix two bugs in an invoice page (the page is inside the prompt) |
| `prompts/3-transcript-description.txt` | YouTube description + chapters from a real transcript |
| `prompts/4-estimate-calculator.txt` | Build a job estimate calculator |
| `prompts/5-comment-replies.txt` | Reply to 11 real comments using only a facts list |
| `prompts/6-snake-game.txt` | Build Snake |
| `grade.mjs` | The robot that click-tests jobs 2, 4 and 6 in a real browser |
| `invoice-original.html` | The untouched invoice page, so the grader can check the design wasn't changed |

## How I ran them

- One run per job, thinking **off**, temperature 0.2.
- Context 8,192 on every job except the invoice, which got 16,384.
- Paste the whole prompt file in as one message. No system prompt.

## Grade the three web pages (jobs 2, 4, 6)

1. Install Node 18 or newer.
2. In this folder, run once:
   ```
   npm install
   npm run setup
   ```
3. Save the model's answers into the `outputs` folder with these exact names (HTML only, strip any ``` fences):
   - `2-invoice-fix.html`
   - `4-estimate-calculator.html`
   - `6-snake-game.html`
4. Run:
   ```
   npm run grade
   ```
   Or grade any folder: `node grade.mjs my-model-folder`

You get a score per job (invoice /6, calculator /5, Snake /6) and a `grades-outputs.json` with every check.

What it checks:
- **Invoice:** a huge discount can't push anything below $0, the money adds up to the penny (3 × 33.335 at 8.25% tax), $24,500.00 shows with the comma, the CSS is untouched, the file is complete, no console errors.
- **Calculator:** all ids there, two math cases come out to the cent, empty boxes never show NaN, no console errors.
- **Snake:** all ids there, starts "Playing" at score 0, shows "Game Over" when it hits the wall, Restart resets it, no console errors. (It doesn't check that eating food scores. It never steers onto the food.)

## Grade the three writing jobs by hand (jobs 1, 3, 5)

- **1. Cold lead text:** Pass if it's under 300 characters, has exactly one question and it's at the end, and has no prices, stats, made-up results or [brackets].
- **3. Description + chapters:** Pass if every fact in the description is actually said in the transcript, and the chapters follow the rules (start at 00:00, at least 4, in order, 10+ seconds apart, every time is a real moment). Partial if the chapters are fine but a fact is wrong.
- **5. Comment replies:** Pass if every number matches the facts list and it never says "I haven't tested" something the list says I did test. Fail if it contradicts the list.

## My results

| Job | Qwen 3.8 27B (8.2 GB, all on the card) | Flash-Next Coder via Strata |
|---|---|---|
| 1. Cold lead text | Pass, 9 s | Pass, 13 s |
| 2. Invoice fix | Fail (wrote the file twice and ran out of room) | Pass 6/6, under 2 min |
| 3. Description + chapters | Partial (4 chapters, one fact wrong) | Partial (9 chapters, one fact wrong) |
| 4. Calculator | Pass 5/5, 52 s | Pass 5/5, 141 s |
| 5. Comment replies | Fail (contradicted the facts in 5 of 11) | Pass |
| 6. Snake | Pass 6/6, 37 s | Pass 6/6, 48 s |

Tell me what card and model you ran it on. That's the next video.
