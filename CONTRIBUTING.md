# Contributing to signalroom

Thanks for wanting to help. New lessons, coding problems, bug fixes and UI polish are all welcome.

## Before you write code: open an issue

**Please open an issue before you start on a pull request** for anything bigger than a typo or an obvious one-line fix. That covers new features, new lessons, new problems, redesigns and refactors.

- **Feature or lesson idea:** use the *Feature request* template. Say what you want to add and why it helps someone learning.
- **Bug:** use the *Bug report* template. Include steps to reproduce it, what you expected, what happened, and your browser. Say whether you saw it on the published page or on localhost.

Wait for a maintainer to reply on the issue before you build it. That way nobody spends a weekend on a PR that clashes with something already in progress, or that doesn't fit the project. A quick "sounds good, go for it" is all you need.

Small fixes (typos, broken links, a clearly wrong test case) can go straight to a PR.

## Running it locally

There's no build step and no dependencies. You only need Python (or any static file server) and Node for the checks.

```sh
git clone https://github.com/bipuladk60/signalroom.git
cd signalroom
python -m http.server 8080
# open http://localhost:8080
```

Everything works locally except the Claude terminal and the lesson builder. Those only appear on the published claude.ai page, because they use the viewer's own Claude plan.

## Ground rules for code

- **Plain JavaScript, HTML and CSS.** No frameworks, bundlers or npm packages. The site has to run as a static page and as a claude.ai artifact, and both work best with zero dependencies.
- **No external requests at runtime.** The artifact host blocks most outside scripts and APIs, so everything the page needs has to ship in the repo. (Python runs on the bundled Pyodide in `pyodide/`.)
- **Keep to the existing style:** 2-space indent, no semicolons, single quotes. Look at the code around your change and match it.
- **Keep both themes working.** Check your change in night and day mode (the Day/Night key in the header).
- **Keep it readable at phone width.** Nothing should scroll sideways.
- `index.html` is the source of truth. Don't edit `artifact.html`; `node build-artifact.mjs` generates it.

## Adding a coding problem

Problems live in `dsa.js`. Copy an existing problem as a template; `two-sum` is the simplest.

Every problem needs:

1. **A full write-up:** statement, examples with explanations, constraints, and a follow-up, written the way an interviewer would give it. Write it in your own words; don't copy from LeetCode or other sites.
2. **A tracer:** the animation comes from running the real algorithm on a small example and recording events. Don't hand-write the steps.
3. **A reference solution in JavaScript and in Python** (`code.solution` and `code.py.solution`), plus starter code for both.
4. **Tests:** the examples (marked `sample`), edge cases, and at least one large generated input that a brute-force answer would fail on time.

Then run:

```sh
node tools/verify-dsa.js
```

It must print no failures. Also open the problem on localhost, load the Python solution with **Solution**, and press **Submit**. Every test should pass.

## Adding a system design lesson

Lessons live in `lessons.js`. Copy one (for example `lb`, the load balancer) and change the components, links and steps. Each step should have a `say()` line: plain-language narration of what just happened, written like you're explaining it to a friend.

## Pull requests

- Branch from `main` and name the branch after the change (`feat/heap-lesson`, `fix/zoom-jumps`).
- Keep one change per PR. Small PRs get reviewed faster.
- Link the issue (`Closes #12`).
- In the description, say what changed, why, and how you tested it. Add a screenshot or GIF if anything on screen changed.
- Before you open it, check that `node tools/verify-dsa.js` passes, that there are no errors in the browser console, and that both themes look right.

## Be nice

Be patient and kind in issues and reviews, especially with people who are new to open source. Critique the code, not the person.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
