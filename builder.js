/* Lesson builder: ask for any system design topic and Claude designs a lesson that this site
   then lays out and animates, exactly like the built-in ones.
   - Runs only where the page is opened inside Claude and the viewer's account can answer;
     everywhere else the builder never appears.
   - Lessons you build are saved privately to your own account (db capability, your private
     subtree), with the browser's storage as a fallback, and appear under the MINE tab. */
;(async () => {
  const form = document.querySelector('.builder')
  if (!form || !window.SDE) return
  if (!window.claude || typeof window.claude.use !== 'function') return

  /* ---------------- storage: your saved lessons ---------------- */
  const LOCAL_KEY = 'sde:mylessons'
  let col = null // db collection for this viewer, or null → browser storage
  async function openStore() {
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')])
      if (!db || !user) return
      const uid = await user.id()
      if (uid) col = db.collection('data/users/' + uid)
    } catch { col = null }
  }
  const localAll = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') } catch { return [] } }
  const localPut = (list) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)) } catch {} }

  async function loadSaved() {
    if (col) {
      try {
        const snap = await Promise.race([col.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))])
        return snap.docs
          .map((d) => d.data())
          .filter((d) => d && d.kind === 'lesson' && typeof d.json === 'string')
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
          .map((d) => { try { return JSON.parse(d.json) } catch { return null } })
          .filter(Boolean)
      } catch { /* fall through to browser storage */ }
    }
    return localAll()
  }
  async function saveLesson(lesson) {
    if (col) {
      try { await col.doc(lesson.id).set({ kind: 'lesson', title: lesson.title, createdAt: lesson.createdAt, json: JSON.stringify(lesson) }); return 'account' } catch { /* fall back */ }
    }
    localPut([...localAll().filter((l) => l.id !== lesson.id), lesson])
    return 'browser'
  }
  async function deleteLesson(id) {
    if (col) { try { await col.doc(id).delete() } catch {} }
    localPut(localAll().filter((l) => l.id !== id))
  }
  document.addEventListener('sde:delete', async (e) => {
    const id = e.detail && e.detail.id
    if (!id) return
    await deleteLesson(id)
    window.SDE.removeLesson(id)
  })

  await openStore()
  const saved = await loadSaved()
  if (saved.length) window.SDE.addLessons(saved)

  /* ---------------- can this viewer ask Claude? ---------------- */
  let sample = null
  try { sample = await window.claude.use('sample') } catch { sample = null }
  if (!sample) return // no Claude here: saved lessons still play, but no builder
  const GONE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'])

  const input = form.querySelector('#build-input')
  const goBtn = form.querySelector('.builder-go')
  const chips = form.querySelector('.builder-chips')
  const status = form.querySelector('.builder-status')
  const msg = form.querySelector('.builder-msg')
  const stopBtn = form.querySelector('.builder-stop')
  form.hidden = false

  function renderChips() {
    const cur = window.SDE.current()
    const t = cur ? cur.title : 'Load Balancing'
    const ideas = [
      `Go further: pros and cons of ${t}`,
      `Low-level design of ${t}`,
      'Consistent hashing',
      'How a chat app delivers messages',
    ]
    chips.innerHTML = ideas.map((s) => `<button type="button" class="builder-chip">${s.replace(/[&<>"]/g, '')}</button>`).join('')
  }
  renderChips()
  document.addEventListener('sde:lesson', renderChips)
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.builder-chip')
    if (b && !busy) { input.value = b.textContent; build(b.textContent) }
  })

  /* ---------------- the request to Claude ---------------- */
  const SPEC = `You design lessons for "System Design Explorer", a website that teaches system design by animating requests moving between components on an isometric diagram, step by step. Each step has a short explanation panel, a plain-language narration box that types out one sentence at a time, and a request log. The site lays out the diagram itself; you only describe the content.

Reply with ONLY one JSON object, no prose, in exactly this shape:
{
  "name": "SHORT NAME",                 // uppercase, max 18 characters, e.g. "LB INTERNALS"
  "title": "Lesson Title",              // 2-4 words
  "full": "One-line subtitle",
  "tier": "EDGE" | "APP" | "CACHE" | "DATA" | "ASYNC",
  "summary": "2-4 sentences: what this is and why it matters.",
  "facts": [["Label", "Value"], ...],   // 4-6 short facts
  "nodes": [{"id": "client", "type": "laptop", "name": "Clients", "sub": "short detail"}, ...],   // 3-7 nodes
  "links": [["client", "lb"], ...],     // the lanes requests can travel along
  "start": ["client"],                  // nodes visible before step 1
  "legend": [["blue", "Request"], ["green", "Response"], ...],
  "steps": [                            // 4-6 steps
    {
      "title": "Step Title", "desc": "one short line",
      "detail": "3-5 sentences explaining this step, concrete and correct.",
      "facts": [["Label", "Value"], ...],   // 2-3 facts
      "events": [ ...see below... ]
    }
  ],
  "outro": {"title": "...", "desc": "...", "text": "3-4 sentence recap.", "facts": [["Label","Value"], ...]}
}

Node "type" is one of: laptop (users/clients), server, worker, lb (load balancer), gateway, edge (CDN/edge), db (database), cache, queue, counter (ID/sequence service), ext (third-party service), module (an internal component such as a listener, router, health checker, scheduler, hash ring, connection pool). For a low-level design ("how it works inside", "LLD", "internals"), show the internal parts as module nodes, with the outside world at the edges.

Events, played in order:
- {"say": "one narration sentence"}  — put one BEFORE every action it describes. Natural, plain language, present tense, like "When the health checker gets no reply, it marks Server 2 as down." 1-2 sentences, under 220 characters.
- {"show": ["node_id", ...]}  — reveal nodes (everything not in "start" must be shown before it is used).
- {"send": ["from", "via", ..., "to"], "color": "blue", "label": "GET /feed", "payload": ["line 1", "line 2"], "kind": "HTTP", "info": "what the log row says", "size": "412 B", "lost": false}
    one request or response moving along links. label max 16 characters; payload 0-2 lines, each under 40 characters; kind is a protocol or short type (HTTP, TCP, SQL, REDIS, GRPC, QUEUE, WAL, INTERNAL...); "lost": true means it never arrives (timeout/crash).
- {"together": [send, send, ...]}  — sends that happen at the same moment.
- {"note": "node_id", "text": "MISS", "tone": "amber"}  — a short callout that pops up for a moment (max 22 characters).
- {"badge": "node_id", "text": "IN POOL", "tone": "green"}  — a label that stays on a node; "text": null removes it (max 22 characters).
- {"down": "node_id"} / {"up": "node_id"}  — a component fails or recovers.
Colors: blue (request), green (success/response), amber (miss/redirect/warning), violet (write/message), teal (replication/background), slate (health check/internal), red (error/rejection). Tones: navy, green, amber, teal, red.

Quality rules:
- Be technically correct and specific: real protocols, real numbers, realistic timings and sizes.
- Each step: 3-10 events; start with a "say". Show the mechanism, not just a description of it.
- Every send must follow links (add the links you need). Use only node ids you defined.
- Teach for a beginner who wants to really understand: cause and effect, why it is designed this way, what would break without it.`

  function briefOf(lesson) {
    if (!lesson) return ''
    const strip = (s) => String(s || '').replace(/<[^>]+>/g, '')
    return `"${lesson.name} · ${lesson.title}": ${strip(lesson.overview && lesson.overview.description)} Steps: ${lesson.steps.map((s) => s.title).join(', ')}. Components: ${Object.values(lesson.nodes).map((n) => n.name).join(', ')}.`
  }

  let busy = false
  let ctl = null
  stopBtn.addEventListener('click', () => ctl && ctl.abort())

  function setBusy(on) {
    busy = on
    input.disabled = on
    goBtn.disabled = on
    chips.classList.toggle('is-busy', on)
    status.hidden = !on && !status.dataset.keep
  }
  // status line in the builder panel; also broadcast so the Claude terminal can show build progress
  function say(text, tone = '', state = 'progress', extra = {}) {
    msg.textContent = text
    status.dataset.tone = tone
    document.dispatchEvent(new CustomEvent('sde:build', { detail: { state, text, tone, ...extra } }))
  }

  async function build(topic) {
    topic = String(topic || '').trim()
    if (!topic || busy) return false
    const cur = window.SDE.current()
    const all = (typeof LESSONS !== 'undefined' ? LESSONS : []).map((l) => `${l.name} (${l.title})`).join(', ')
    const prompt = `${SPEC}

The learner is currently viewing this lesson: ${briefOf(cur)}
Lessons that already exist on the site: ${all}.
If the request builds on the current lesson ("go further", "now its flaws", "deeper", "what about..."), make a follow-up lesson that starts where it left off and reuses its components where it makes sense. Otherwise make a fresh lesson on the topic.

The learner asks: ${topic}`

    ctl = new AbortController()
    delete status.dataset.keep
    setBusy(true)
    stopBtn.hidden = false
    const t0 = Date.now()
    let written = ''
    const tick = setInterval(() => {
      const secs = Math.round((Date.now() - t0) / 1000)
      const steps = (written.match(/"events"\s*:/g) || []).length
      say(written ? `Writing the lesson… step ${Math.max(1, steps)} · ${secs}s` : `Designing your lesson… ${secs}s (usually under a minute)`)
    }, 500)
    say('Designing your lesson…', '', 'start', { topic })
    try {
      const raw = await sample.json(prompt, { signal: ctl.signal, onText: ({ text }) => { written = text } })
      const lesson = normalize(raw, topic)
      const where = await saveLesson(lesson)
      window.SDE.addLessons([lesson], { select: true })
      input.value = ''
      status.dataset.keep = '1'
      say(`Built “${lesson.title}” · ${lesson.steps.length} steps · saved to your ${where === 'account' ? 'account' : 'browser'}. Press PLAY.`, 'ok', 'done', { title: lesson.title, steps: lesson.steps.length })
      return true
    } catch (e) {
      const code = e && e.code
      if (GONE.has(code)) { form.hidden = true; say('Lesson building is not available here.', 'warn', 'error'); return false }
      status.dataset.keep = '1'
      if (code === 'cancelled') say('Stopped.', '', 'error')
      else if (code === 'rate_limited') say("You've hit a usage limit for now. Try again in a little while.", 'warn', 'error')
      else if (code === 'session_expired') say('Your Claude session expired. Sign in again, then retry.', 'warn', 'error')
      else if (code === 'refused') say("Claude can't build that one. Try asking it a different way.", 'warn', 'error')
      else if (code === 'invalid_json' || (e && e.lessonError)) say("The lesson came back incomplete. Try again, or make the topic more specific.", 'warn', 'error')
      else say('Something went wrong reaching Claude. Try again.', 'warn', 'error')
      return false
    } finally {
      clearInterval(tick)
      stopBtn.hidden = true
      setBusy(false)
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); build(input.value) })
  // let the Claude terminal start a build ("show me…", "animate…", "make a lesson on…")
  window.SDE.build = (topic) => build(topic)
  window.SDE.isBuilding = () => busy
  window.SDE.stopBuild = () => ctl && ctl.abort()
  document.dispatchEvent(new CustomEvent('sde:builder-ready'))

  /* ---------------- turning Claude's JSON into a playable lesson ---------------- */
  const TYPES_OK = new Set(['laptop', 'server', 'worker', 'lb', 'gateway', 'edge', 'db', 'cache', 'queue', 'counter', 'ext', 'module'])
  const COLORS_OK = new Set(['blue', 'green', 'amber', 'violet', 'teal', 'slate', 'red'])
  const TONES_OK = new Set(['navy', 'green', 'amber', 'teal', 'red'])
  const TIERS_OK = new Set(['EDGE', 'APP', 'CACHE', 'DATA', 'ASYNC'])
  const LEGEND_DEFAULT = { blue: 'Request', green: 'Response', amber: 'Miss / warning', violet: 'Write / message', teal: 'Background', slate: 'Internal', red: 'Error' }
  const str = (v, max = 400) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, max)
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const rich = (v, max) => esc(str(v, max)).replace(/`([^`]+)`/g, '<code>$1</code>')
  const facts = (f, n = 6) => (Array.isArray(f) ? f : []).filter((x) => Array.isArray(x) && x.length >= 2).slice(0, n).map(([k, v]) => [str(k, 40), str(v, 90)])
  const fail = (m) => { const e = new Error(m); e.lessonError = true; throw e }

  function normalize(raw, topic) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('not an object')
    // nodes
    const nodes = {}
    for (const n of (Array.isArray(raw.nodes) ? raw.nodes : []).slice(0, 9)) {
      const id = str(n && n.id, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_')
      if (!id || nodes[id]) continue
      nodes[id] = { type: TYPES_OK.has(n.type) ? n.type : 'server', name: str(n.name, 28) || id, sub: str(n.sub, 34) }
    }
    const ids = Object.keys(nodes)
    if (ids.length < 2) fail('too few nodes')
    // links (deduped, undirected)
    const linkSet = new Set()
    const links = []
    const addLink = (a, b) => {
      if (a === b || !nodes[a] || !nodes[b]) return
      const k = [a, b].sort().join('|')
      if (!linkSet.has(k)) { linkSet.add(k); links.push([a, b]) }
    }
    for (const l of Array.isArray(raw.links) ? raw.links : []) if (Array.isArray(l)) addLink(str(l[0], 40), str(l[1], 40))
    let start = (Array.isArray(raw.start) ? raw.start : []).map((s) => str(s, 40)).filter((s) => nodes[s])
    if (!start.length) start = [ids[0]]

    // events
    const shown = new Set(start)
    let clock = 0
    const used = new Set()
    function convSend(ev, out) {
      const path = (Array.isArray(ev.send) ? ev.send : []).map((s) => str(s, 40)).filter((s) => nodes[s])
      if (path.length < 2) return null
      for (let i = 0; i < path.length - 1; i++) addLink(path[i], path[i + 1])
      const hidden = path.filter((p) => !shown.has(p))
      if (hidden.length) { hidden.forEach((p) => shown.add(p)); out.push({ type: 'show', nodes: [...new Set(hidden)] }) }
      const color = COLORS_OK.has(ev.color) ? ev.color : 'blue'
      used.add(color)
      clock += 0.004 + Math.random() * 0.01
      const payload = (Array.isArray(ev.payload) ? ev.payload : []).slice(0, 3).map((p) => str(p, 48)).filter(Boolean)
      return {
        type: 'packet', path, color,
        label: str(ev.label, 18) || 'REQUEST',
        payload,
        row: { t: +clock.toFixed(3), kind: str(ev.kind, 8).toUpperCase() || 'MSG', info: str(ev.info, 90) || str(ev.label, 40), size: str(ev.size, 10) || '—' },
        ...(ev.lost ? { lost: true } : {}),
        ...(ev.quick ? { quick: true } : {}),
      }
    }
    function convEvents(list) {
      const out = []
      for (const ev of (Array.isArray(list) ? list : []).slice(0, 24)) {
        if (!ev || typeof ev !== 'object') continue
        if (typeof ev.say === 'string' && ev.say.trim()) out.push({ type: 'say', text: str(ev.say, 260) })
        else if (Array.isArray(ev.show)) {
          const ns = ev.show.map((s) => str(s, 40)).filter((s) => nodes[s] && !shown.has(s))
          ns.forEach((s) => shown.add(s))
          if (ns.length) out.push({ type: 'show', nodes: ns })
        } else if (Array.isArray(ev.send)) {
          const p = convSend(ev, out)
          if (p) out.push(p)
        } else if (Array.isArray(ev.together)) {
          const pre = []
          const items = ev.together.slice(0, 6).map((s) => (s && Array.isArray(s.send) ? convSend(s, pre) : null)).filter(Boolean)
          out.push(...pre)
          if (items.length === 1) out.push(items[0])
          else if (items.length) out.push({ type: 'par', gap: 240, items })
        } else if (typeof ev.note === 'string' && nodes[str(ev.note, 40)]) {
          const at = str(ev.note, 40)
          if (!shown.has(at)) { shown.add(at); out.push({ type: 'show', nodes: [at] }) }
          out.push({ type: 'note', at, text: str(ev.text, 24).toUpperCase() || 'NOTE', tone: TONES_OK.has(ev.tone) ? ev.tone : 'navy' })
        } else if (typeof ev.badge === 'string' && nodes[str(ev.badge, 40)]) {
          const at = str(ev.badge, 40)
          if (!shown.has(at)) { shown.add(at); out.push({ type: 'show', nodes: [at] }) }
          out.push({ type: 'badge', at, text: ev.text == null || ev.text === '' ? null : str(ev.text, 24).toUpperCase(), tone: TONES_OK.has(ev.tone) ? ev.tone : 'navy' })
        } else if (typeof ev.down === 'string' && nodes[str(ev.down, 40)]) out.push({ type: 'state', at: str(ev.down, 40), state: 'down' })
        else if (typeof ev.up === 'string' && nodes[str(ev.up, 40)]) out.push({ type: 'state', at: str(ev.up, 40), state: 'up' })
        else if (typeof ev.wait === 'number') out.push({ type: 'wait', ms: Math.max(100, Math.min(2000, ev.wait)) })
      }
      return out
    }
    const steps = []
    for (const s of (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 8)) {
      if (!s || typeof s !== 'object') continue
      clock = Math.ceil(clock) + steps.length * 0.5
      const events = convEvents(s.events)
      if (!events.length) continue
      steps.push({ title: str(s.title, 40) || `Step ${steps.length + 1}`, desc: str(s.desc, 70), detail: rich(s.detail, 900), facts: facts(s.facts, 4), events })
    }
    if (steps.length < 2) fail('too few steps')

    // the components that appear anywhere get a place on the diagram; unused ones are dropped
    const appear = new Set(start)
    const walk = (evs) => evs.forEach((e) => { if (e.type === 'show') e.nodes.forEach((n) => appear.add(n)); if (e.path) e.path.forEach((n) => appear.add(n)); if (e.items) walk(e.items) })
    steps.forEach((s) => walk(s.events))
    for (const id of ids) if (!appear.has(id)) delete nodes[id]
    const finalLinks = links.filter(([a, b]) => nodes[a] && nodes[b])

    const placed = layout(nodes, finalLinks, start)
    let legend = (Array.isArray(raw.legend) ? raw.legend : []).filter((x) => Array.isArray(x) && COLORS_OK.has(x[0]) && used.has(x[0])).slice(0, 5).map(([c, t]) => [c, str(t, 24)])
    for (const c of used) if (!legend.some(([lc]) => lc === c) && legend.length < 5) legend.push([c, LEGEND_DEFAULT[c]])
    const outro = raw.outro && typeof raw.outro === 'object' ? raw.outro : {}
    const name = str(raw.name, 18).toUpperCase() || str(raw.title, 18).toUpperCase() || 'MY LESSON'
    return {
      id: 'g-' + Date.now().toString(36),
      generated: true,
      prompt: str(topic, 140),
      createdAt: Date.now(),
      name,
      title: str(raw.title, 32) || name,
      cat: 'mine',
      tier: TIERS_OK.has(raw.tier) ? raw.tier : 'APP',
      nodes: placed,
      links: finalLinks,
      start,
      legend,
      overview: { full: str(raw.full, 70) || str(raw.title, 70), description: rich(raw.summary, 700), facts: facts(raw.facts) },
      steps,
      outro: {
        title: str(outro.title, 40) || 'Lesson complete',
        desc: str(outro.desc, 70),
        text: rich(outro.text, 700) + ' Press REPLAY to watch it again.',
        facts: facts(outro.facts, 4),
      },
    }
  }

  // Layered layout: left to right by distance from the starting nodes, with a slight diagonal
  // inside each column so the isometric diagram reads like the built-in lessons.
  function layout(nodes, links, start) {
    const adj = {}
    for (const id in nodes) adj[id] = []
    for (const [a, b] of links) { adj[a].push(b); adj[b].push(a) }
    const layer = {}
    const queue = []
    for (const s of start) if (nodes[s] && layer[s] == null) { layer[s] = 0; queue.push(s) }
    while (queue.length) {
      const c = queue.shift()
      for (const nb of adj[c]) if (layer[nb] == null) { layer[nb] = layer[c] + 1; queue.push(nb) }
    }
    let max = Math.max(0, ...Object.values(layer))
    for (const id in nodes) if (layer[id] == null) layer[id] = ++max
    const cols = []
    for (const id in nodes) (cols[layer[id]] = cols[layer[id]] || []).push(id)
    const out = {}
    const last = cols.length - 1
    cols.forEach((col, L) => {
      if (!col) return
      const k = col.length
      col.forEach((id, i) => {
        const off = i - (k - 1) / 2
        // labels: first column below, last column to the right; single nodes alternate above/below
        // so neighbours' labels never meet; stacked nodes put labels on their outer sides
        let lab
        if (L === 0) lab = 'b'
        else if (L === last) lab = 'r'
        else if (k === 1) lab = L % 2 ? 'b' : 't'
        else lab = i === 0 ? 't' : i === k - 1 ? 'b' : 'r'
        out[id] = { ...nodes[id], x: Math.round(140 + L * 360 + off * 40), y: Math.round(340 + off * 170), lab }
      })
    })
    return out
  }
})()
