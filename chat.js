/* Claude terminal: ask about what you're watching, or press "summarize".
   It runs only where the page is opened inside Claude (a published artifact) and the viewer's
   Claude account can answer. Everywhere else (localhost, a saved copy, no plan) the terminal
   never appears and the stage simply takes its space. */
;(async () => {
  const term = document.querySelector('.term')
  if (!term || !window.SDE) return
  if (!window.claude || typeof window.claude.use !== 'function') return
  let sample = null
  try { sample = await window.claude.use('sample') } catch { sample = null }
  if (!sample) return
  let canTools = false
  try { canTools = !!(await sample.limits()).tools } catch { canTools = false }

  const log = term.querySelector('.term-log')
  const form = term.querySelector('.term-form')
  const input = term.querySelector('#term-input')
  const sendBtn = term.querySelector('.term-send')
  const ctx = term.querySelector('.term-ctx')
  const sumBtn = term.querySelector('[data-term="summarize"]')
  const clearBtn = term.querySelector('[data-term="clear"]')
  const expandBtn = term.querySelector('[data-term="expand"]')
  const col = document.querySelector('.stage-col')

  // codes that mean "this viewer can't use Claude here": remove the terminal for good, never re-ask
  const GONE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'])
  const show = (on) => { term.hidden = !on; window.dispatchEvent(new Event('resize')) }

  const RULES = `You are Claude, built into "System Design in Motion", a website that teaches system design by animating requests moving between components (load balancers, caches, databases, queues and so on), step by step, with a narration caption and a request feed. You answer inside a small terminal panel under the animation.

How to answer:
- Use the page context sent with each message: the lesson, the step the learner is on, the narration, the components on the diagram and the requests so far. Refer to those concrete things by name ("the Cache answered MISS in request #3").
- Plain, natural language for a beginner. Explain cause and effect: "when this happens, this happens because...". A short everyday analogy helps when it fits.
- Keep it short: 2 to 5 sentences, or a few "- " bullet points. **Bold** only key terms. No headings, no tables.
- If they ask about something outside the current lesson, answer briefly and point to the lesson on the site that covers it, if any.
- Don't invent numbers that contradict the page.
- On coding lessons the context includes the learner's code and test results. When they ask for help with it, point at the bug or give a hint first; give a full solution only if they ask for one.
- If the learner asks you to show, animate, visualize, simulate, create, build or make a lesson, animation or diagram (for example "show me the kinds of load balancers and their pros and cons"), call the build_lesson tool with a complete, self-contained topic description, then reply in one short sentence that the lesson is being built and will open on its own. Don't explain the topic at length in that case: the lesson will.`

  const SUMMARY_ASK = `Summarize this lesson for me as far as I've watched it. Give 3 to 6 "- " bullet points: what happened, in order, and why it matters. End with one line starting with "Key idea:" that I should remember. If I haven't started the lesson yet, summarize what the lesson will teach instead.`

  const turns = []
  const history = []
  let hIdx = -1
  let ctl = null
  let busy = false

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  function md(text) {
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
    const html = []
    let list = null
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
      if (m) { (list = list || []).push(`<li><span>${inline(m[1])}</span></li>`); continue }
      if (list) { html.push(`<ul>${list.join('')}</ul>`); list = null }
      if (line.trim()) html.push(`<p>${inline(line)}</p>`)
    }
    if (list) html.push(`<ul>${list.join('')}</ul>`)
    return html.join('')
  }
  function line(cls, html) {
    const d = document.createElement('div')
    d.className = `t-line ${cls}`
    d.innerHTML = html
    log.appendChild(d)
    log.scrollTop = log.scrollHeight
    return d
  }
  function greet() {
    log.textContent = ''
    line('sys', 'Ask about anything in this lesson, or run <b>summarize</b>. I can see the step you\'re on, the narration, the diagram and the requests.')
  }

  const refreshCtx = () => { ctx.textContent = '~ ' + window.SDE.lessonLabel() }
  refreshCtx()
  document.addEventListener('sde:lesson', refreshCtx)
  setInterval(refreshCtx, 1000)

  function setBusy(on) {
    busy = on
    sendBtn.textContent = on ? 'stop ■' : 'send ↵'
    sendBtn.classList.toggle('is-stop', on)
    sumBtn.disabled = on
    clearBtn.disabled = on
  }

  const COPY = {
    rate_limited: "usage limit reached for now. Try again in a little while.",
    session_expired: 'your Claude session expired. Sign in again, then retry.',
    refused: "Claude can't answer that one. Try asking it differently.",
    empty_completion: 'no answer came back. Try rephrasing.',
    prompt_too_large: 'that was too much text. Try a shorter question.',
  }
  const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

  async function ask(question, shownAs) {
    question = question.trim()
    if (!question || busy) return
    line('you', esc(shownAs || question))
    const out = line('claude', `<span class="t-who">claude</span><div class="t-body"><span class="t-spin">⠋ thinking</span></div>`)
    const body = out.querySelector('.t-body')
    let f = 0
    const spin = setInterval(() => { const s = body.querySelector('.t-spin'); if (s) s.textContent = `${SPIN[++f % SPIN.length]} thinking` }, 90)

    const message = `What I'm looking at on the page right now:\n---\n${window.SDE.context()}\n---\n\n${question}`
    ctl = new AbortController()
    setBusy(true)
    try {
      const opts = {
        modelTier: 'quick',
        cache: false,
        signal: ctl.signal,
        onText: ({ text }) => { body.innerHTML = md(text); log.scrollTop = log.scrollHeight },
      }
      if (canTools && window.SDE.build) opts.tools = [BUILD_TOOL]
      const { text, truncated } = await sample([{ role: 'user', content: RULES }, ...turns.slice(-8), { role: 'user', content: message }], opts)
      body.innerHTML = md(text) + (truncated ? '<p class="t-note">(cut short: ask a narrower question for the rest)</p>' : '')
      turns.push({ role: 'user', content: shownAs ? 'Summarize the lesson so far.' : question }, { role: 'assistant', content: text })
    } catch (e) {
      const code = e && e.code
      if (GONE.has(code)) { show(false); return }
      if (code === 'cancelled') body.innerHTML = (e.text ? md(e.text) : '') + '<p class="t-note">^C stopped</p>'
      else if (code === 'refused') { out.remove(); line('err', `error: ${COPY.refused}`) }
      else {
        body.innerHTML = e && e.text ? md(e.text) : ''
        if (!body.innerHTML) out.remove()
        line('err', `error: ${COPY[code] || 'could not reach Claude. Run it again to retry.'}`)
      }
    } finally {
      clearInterval(spin)
      setBusy(false)
      log.scrollTop = log.scrollHeight
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (busy) { ctl && ctl.abort(); return }
    const q = input.value.trim()
    if (!q) return
    history.unshift(q)
    hIdx = -1
    input.value = ''
    if (/^\/?summari[sz]e$/i.test(q)) return ask(SUMMARY_ASK, 'summarize')
    if (/^\/?clear$/i.test(q)) { turns.length = 0; greet(); return }
    if (!canTools && WANTS_LESSON.test(q) && window.SDE.build) { line('you', esc(q)); startBuild(q); return }
    ask(q)
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); hIdx = Math.min(history.length - 1, hIdx + 1); input.value = history[hIdx] }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx = Math.max(-1, hIdx - 1); input.value = hIdx < 0 ? '' : history[hIdx] }
    else if (e.key === 'Escape' && busy) ctl && ctl.abort()
  })
  sumBtn.addEventListener('click', () => ask(SUMMARY_ASK, 'summarize'))
  clearBtn.addEventListener('click', () => { if (!busy) { turns.length = 0; greet() } })

  /* ---------------- building lessons from the terminal ---------------- */
  const WANTS_LESSON = /^\s*(show me|animate|visuali[sz]e|simulate|demonstrate)\b|\b(show|animate|visuali[sz]e|simulate|create|build|make|generate)\b[\s\S]{0,60}\b(lesson|animation|diagram|simulation|visual|demo)\b/i
  function startBuild(topic) {
    if (!window.SDE.build) { line('err', 'error: lesson building is not available here.'); return 'Lesson building is not available on this page.' }
    if (window.SDE.isBuilding()) { line('err', 'a lesson is already being built. Wait for it to finish.'); return 'A lesson is already being built; ask the learner to wait for it.' }
    window.SDE.build(topic)
    return 'Started building the lesson. It takes about a minute; progress shows in the terminal and the lesson opens automatically when it is ready.'
  }
  const BUILD_TOOL = {
    name: 'build_lesson',
    description: 'Build a new animated lesson on the site (components, requests moving between them, narration, step by step) and open it when ready. Use it whenever the learner asks to show, animate, visualize, simulate, create or build something, or to go further into the current lesson (pros and cons, failure modes, internals, alternatives). Returns at once; the build takes about a minute.',
    inputSchema: {
      type: 'object',
      properties: { topic: { type: 'string', description: 'A complete, self-contained description of the lesson to build, e.g. "The kinds of load balancers (DNS, L4, L7, hardware vs software): how each routes traffic, their pros and cons, and how teams mitigate the cons".' } },
      required: ['topic'],
    },
    execute(input) {
      const topic = String((input && input.topic) || '').trim()
      if (!topic) throw new Error('Missing topic.')
      const r = startBuild(topic)
      if (!/^Started/.test(r)) throw new Error(r)
      return r
    },
  }
  // live build progress, whether the build was started here or from the left panel
  let buildLine = null
  document.addEventListener('sde:build', (e) => {
    const d = e.detail || {}
    if (d.state === 'start') {
      buildLine = line('build', `<span class="t-who">build</span> <span class="b-topic">${esc(d.topic || '')}</span><div class="b-status">${SPIN[0]} ${esc(d.text)}</div>`)
    } else if (buildLine) {
      const st = buildLine.querySelector('.b-status')
      if (d.state === 'progress') st.textContent = `${SPIN[Math.floor(Date.now() / 120) % SPIN.length]} ${d.text}`
      else if (d.state === 'done') { st.innerHTML = `<span class="b-ok">✓ built “${esc(d.title || '')}” · ${d.steps || ''} steps. It's open now: press <b>Space</b> or ▶ to watch.</span>`; buildLine = null }
      else if (d.state === 'error') { st.innerHTML = `<span class="b-err">✗ ${esc(d.text)}</span>`; buildLine = null }
      log.scrollTop = log.scrollHeight
    }
  })

  /* ---------------- expand / collapse ---------------- */
  function setExpanded(on) {
    col.classList.toggle('term-max', on)
    expandBtn.textContent = on ? 'Collapse' : 'Expand'
    expandBtn.setAttribute('aria-pressed', on)
    window.dispatchEvent(new Event('resize'))
    log.scrollTop = log.scrollHeight
  }
  expandBtn.addEventListener('click', () => setExpanded(!col.classList.contains('term-max')))
  term.querySelector('.panel-head').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) setExpanded(!col.classList.contains('term-max')) })

  greet()
  show(true)
})()
