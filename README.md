# signalroom

**System Design in Motion**: a control-room console for learning how big systems and interview algorithms actually behave, one request and one pointer move at a time.

Two sections, switched from the header:

- **System design**: animated lessons on load balancing, CDNs, rate limiting, caching, replication, sharding, message queues, circuit breakers, and a full URL-shortener walkthrough. Requests travel between components on a zoomable scope, a live narration types out what's happening, and a signal log records every request.
- **Coding (DSA)**: 13 problems in the style of Google's coding interviews (Two Sum, sliding window, intervals, heaps, binary search, BST validation, grid BFS, Dijkstra, tries, LRU cache, top-K, coin change). Each one is animated by running the real algorithm on a small example, then you solve it yourself in the **Code Lab**.

## Features

- **Scope**: smooth pan and zoom (wheel, drag with glide, pinch), diagram and sequence views, step-by-step playback with narration at reading speed.
- **Code Lab**: full problem statements with examples, constraints and follow-ups; a Python (default) or JavaScript editor; **Run** against the examples, **Submit** against the full suite including edge cases and large inputs with a time limit. Code runs in a Web Worker, so infinite loops are stopped instead of freezing the page.
- **Real Python**: CPython 3.12 via [Pyodide](https://pyodide.org), bundled in `pyodide/`. The standard library ships as plain source (`stdlib.json`) and is packed into an in-memory archive when Python starts.
- **Claude terminal**: ask about whatever is on screen, press **summarize**, or say "show me…" to have Claude build a brand-new animated lesson. When published as a Claude artifact, these use the viewer's own Claude plan; elsewhere they stay hidden.
- Night and day themes, progress tracking, and lessons you build saved privately to your Claude account.

## Run it locally

No build step and no dependencies. Serve the folder over HTTP (Python needs it for the Web Worker and WebAssembly):

```sh
python -m http.server 8080
# open http://localhost:8080
```

Everything works locally except the Claude terminal and the lesson builder, which need the claude.ai viewer.

## Publish as a Claude artifact

`index.html` is the source of truth. The artifact host wraps pages in its own document skeleton, so build the publishable page first:

```sh
node build-artifact.mjs   # writes artifact.html
```

Then publish `artifact.html` with the supporting files (`styles.css`, the `*.js` files and everything in `pyodide/`).

## Project layout

| File | What it is |
|---|---|
| `index.html`, `styles.css` | Page structure and the console look |
| `app.js` | Player, scope (pan/zoom), sequence view, narration, sections |
| `lessons.js` | System design lessons |
| `dsa.js` | Coding lessons: tracers that record each algorithm run, problem write-ups, tests, reference solutions (JS and Python) |
| `ide.js` | Code Lab: editor, Python/JS workers, test runner |
| `chat.js` | Claude terminal |
| `builder.js` | Claude-built lessons |
| `tools/verify-dsa.js` | Checks every reference solution against every test |

## Checking the tests

```sh
node tools/verify-dsa.js
```

Runs each JavaScript reference solution against its full test suite (including the generated large inputs) and checks that every animation event points at a real component.

## Credits

Python runs on [Pyodide](https://github.com/pyodide/pyodide) (MPL-2.0) with the CPython standard library (PSF License). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Problem statements and explanations are original; the problem selection follows patterns commonly reported from Google coding interviews.
