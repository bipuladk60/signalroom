/* System Design in Motion: the player, the diagram, the sequence view, the stepper and the request feed. */
;(() => {
  const SVGNS = 'http://www.w3.org/2000/svg'
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(SVGNS, tag)
    for (const k in attrs) e.setAttribute(k, attrs[k])
    if (parent) parent.appendChild(e)
    return e
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const strip = (s) => String(s).replace(/<[^>]+>/g, '')
  const easeOut = (t) => 1 - Math.pow(1 - t, 3)
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

  const COLOR = {
    blue: 'var(--p-blue)', green: 'var(--p-green)', amber: 'var(--p-amber)', violet: 'var(--p-violet)',
    teal: 'var(--p-teal)', slate: 'var(--p-slate)', red: 'var(--p-red)', navy: 'var(--p-navy)',
  }
  const TONE = { navy: 'var(--p-navy)', green: 'var(--ok)', amber: 'var(--warn)', teal: 'var(--p-teal)', red: 'var(--bad)' }

  /* ---------------- persistence ---------------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sde:' + k); return v == null ? d : JSON.parse(v) } catch { return d } },
    set(k, v) { try { localStorage.setItem('sde:' + k, JSON.stringify(v)) } catch {} },
  }

  /* ---------------- state ---------------- */
  const S = {
    lesson: null,
    step: -1, // -1 = about the lesson, n = finished
    busy: false,
    playing: false,
    frozen: false,
    speed: 1,
    run: { cancelled: true },
    rows: [],
    current: -1,
    view: store.get('view', 'network'),
    progress: store.get('progress', {}),
    cam: null,
    vis: new Set(),
    down: new Set(),
    badges: {},
    pending: null,
    ds: { vals: {}, marks: {}, rows: {}, edges: {}, ptrs: {} },
  }
  const L = () => S.lesson
  const n = () => S.lesson.steps.length

  /* ---------------- component icons (24×24, stroked) ---------------- */
  const ICONS = {
    laptop: 'M4 6h16v10H4z M2 19.5h20',
    server: 'M5 4h14v6H5z M5 14h14v6H5z M8.5 7h.01 M8.5 17h.01 M12 7h4 M12 17h4',
    worker: 'M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1',
    lb: 'M3 12h5 M8 12l5-6h7 M8 12l5 6h7 M8 12h12 M18 4l2 2-2 2 M18 16l2 2-2 2',
    gateway: 'M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z M8.8 12l2.2 2.2 4.2-4.4',
    edge: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M3 12h18 M12 3c3.2 3 3.2 15 0 18 M12 3c-3.2 3-3.2 15 0 18',
    db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    cache: 'M13 2.5L4.5 13.5h6.5l-1 8 8.5-11h-6.5z',
    queue: 'M3 7h18v10H3z M7.5 7v10 M12 7v10 M16.5 7v10',
    counter: 'M9.5 3.5L7.5 20.5 M16.5 3.5l-2 17 M4.5 9h16 M3.5 15h16',
    ext: 'M7 18h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.2 9.6 4.3 4.3 0 0 0 7 18z',
    module: 'M7 7h10v10H7z M10 3.5V7 M14 3.5V7 M10 17v3.5 M14 17v3.5 M3.5 10H7 M3.5 14H7 M17 10h3.5 M17 14h3.5',
  }

  /* ---------------- DOM refs ---------------- */
  const net = $('#net')
  const lanesG = $('.lanes', net)
  const nodesG = $('.nodes', net)
  const fxG = $('.fx', net)
  const ptrLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  ptrLayer.setAttribute('class', 'ptrs')
  net.insertBefore(ptrLayer, fxG)
  const stage = $('.stage')
  const seqScroll = $('.seq-scroll')
  const seqSvg = $('.seq-svg')
  const seqTrack = $('.seq-head-track')
  const feed = $('.feed')
  const feedCount = $('.feed-count')
  const narrBox = $('.narrate')
  const narrList = $('.narrate-lines')
  const toggleBtn = $('[data-action="toggle"]')
  const startBtn = $('[data-action="start"]')
  const track = $('.step-track')

  // arrowheads for the sequence view, one per colour
  const seqDefs = el('defs', {}, seqSvg)
  for (const c of Object.keys(COLOR)) {
    const m = el('marker', { id: 'sq-' + c, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, seqDefs)
    el('path', { d: 'M0,0.6 L10,5 L0,9.4 Z', style: `fill:${COLOR[c]}` }, m)
  }

  /* ---------------- timing ---------------- */
  const PACE = 1.7 // everything plays this much slower than the raw timings at 1×
  function newRun() {
    S.run.cancelled = true
    S.run = { cancelled: false }
    return S.run
  }
  function tween(ms, run, fn) {
    ms *= PACE
    return new Promise((res) => {
      let t = 0, last = null
      const f = (now) => {
        if (run.cancelled) return res()
        if (last != null && !S.frozen) t += (now - last) * S.speed
        last = now
        const p = Math.min(1, t / Math.max(1, ms))
        if (fn) fn(p)
        if (p >= 1) return res()
        requestAnimationFrame(f)
      }
      requestAnimationFrame(f)
    })
  }
  const wait = (ms, run) => tween(ms, run)

  /* ---------------- diagram: station cards + lanes ---------------- */
  const CARD_H = 56
  const SMAX = 1.9 // cards keep a constant on-screen size, up to this zoom-out
  const nodeEls = {}
  const lanes = {}

  const textW = (s, per) => String(s || '').length * per

  function buildDiagram() {
    lanesG.textContent = ''
    nodesG.textContent = ''
    fxG.textContent = ''
    for (const k in nodeEls) delete nodeEls[k]
    for (const k in lanes) delete lanes[k]
    const lesson = L()

    // one line per link; both directions share it
    laneLabels.length = 0
    for (const [a, b, opt = {}] of lesson.links) {
      const A = lesson.nodes[a], B = lesson.nodes[b]
      if (!A || !B) continue
      const line = el('line', { class: 'lane is-hidden' + (opt.ghost ? ' ghost' : ''), x1: A.x, y1: A.y, x2: B.x, y2: B.y }, lanesG)
      const shared = { el: line, refs: 0, a, b, path: null }
      if (opt.label != null) {
        const t = el('text', { class: 'lane-label is-hidden', 'text-anchor': 'middle' }, lanesG)
        t.textContent = opt.label
        shared.label = t
        laneLabels.push({ el: t, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 })
      }
      lanes[`${a}>${b}`] = { shared, from: a, to: b }
      lanes[`${b}>${a}`] = { shared, from: b, to: a }
    }

    // instrument tiles: a header strip (name + status light), the component icon, its detail line and a load meter
    ptrLayer.textContent = ''
    for (const k in ptrs) delete ptrs[k]
    for (const [id, nd] of Object.entries(lesson.nodes).sort((p, q) => p[1].y - q[1].y)) {
      if (DS_TYPES.has(nd.type)) { drawDS(id, nd); continue }
      const name = String(nd.name).toUpperCase()
      const W = Math.max(150, Math.ceil(Math.max(textW(name, 8.6) + 48, (nd.sub ? textW(nd.sub, 6.5) : 0) + 34 + 52)))
      const H = CARD_H
      const x0 = -W / 2, y0 = -H / 2
      const g = el('g', { class: 'node is-hidden' + (nd.type === 'ext' ? ' is-ext' : ''), 'data-id': id }, nodesG)
      const tile = el('g', { class: 'tile' }, g)
      el('rect', { class: 'tile-bg', x: x0, y: y0, width: W, height: H, rx: 4 }, tile)
      el('path', { class: 'tile-head', d: `M${x0 + 1},${y0 + 21} V${y0 + 4} Q${x0 + 1},${y0 + 1} ${x0 + 4},${y0 + 1} H${-x0 - 4} Q${-x0 - 1},${y0 + 1} ${-x0 - 1},${y0 + 4} V${y0 + 21} Z` }, tile)
      el('text', { class: 'tile-name', x: x0 + 10, y: y0 + 15 }, tile).textContent = name
      el('text', { class: 'offline', x: W / 2 - 22, y: y0 + 15, 'text-anchor': 'end' }, tile).textContent = 'OFFLINE'
      el('circle', { class: 'tile-led', cx: W / 2 - 11, cy: y0 + 11, r: 3.6 }, tile)
      el('path', { class: 'icon', d: ICONS[nd.type] || ICONS.server, transform: `translate(${x0 + 9} ${y0 + 27}) scale(0.78)` }, tile)
      if (nd.sub) el('text', { class: 'tile-sub', x: x0 + 34, y: y0 + 41 }, tile).textContent = nd.sub
      const meter = el('g', { class: 'meter', transform: `translate(${W / 2 - 44} ${y0 + 33})` }, tile)
      const bars = [0, 1, 2, 3].map((i) => el('rect', { x: i * 9, y: 0, width: 7, height: 12, rx: 1 }, meter))
      const badgeG = el('g', { class: 'badge' }, g)
      nodeEls[id] = { g, badgeG, bars, level: 0, w: W, h: H, x: nd.x, y: nd.y }
    }
    // the largest card scale at which no two cards (plus room for a badge) overlap
    S.capS = SMAX
    const ids = Object.keys(nodeEls)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = nodeEls[ids[i]], b = nodeEls[ids[j]]
        const small = a.ds && a.ds !== 'box' && b.ds && b.ds !== 'box'
        const fitX = Math.abs(a.x - b.x) / ((a.w + b.w) / 2 + (small ? 10 : 24))
        const fitY = Math.abs(a.y - b.y) / ((a.h + b.h) / 2 + (small ? 22 : 44))
        S.capS = Math.min(S.capS, Math.max(fitX, fitY))
      }
    }
    S.capS = Math.max(0.55, S.capS)
    updateScales()
  }

  function setVisible(id, on) {
    const e = nodeEls[id]
    if (!e) return
    on ? S.vis.add(id) : S.vis.delete(id)
    e.g.classList.toggle('is-hidden', !on)
  }
  function updateLanes() {
    for (const k in lanes) {
      const s = lanes[k].shared
      s.el.classList.toggle('is-hidden', !(S.vis.has(s.a) && S.vis.has(s.b)))
      if (s.label) s.label.classList.toggle('is-hidden', !(S.vis.has(s.a) && S.vis.has(s.b)))
    }
  }
  function setDown(id, isDown) {
    isDown ? S.down.add(id) : S.down.delete(id)
    nodeEls[id] && nodeEls[id].g.classList.toggle('is-down', isDown)
  }
  function setBadge(id, text, tone = 'navy', animate = false) {
    const e = nodeEls[id]
    if (!e) return
    S.badges[id] = text ? { text, tone } : null
    e.badgeG.textContent = ''
    if (!text) return
    const w = textW(text, 6.8) + 18
    const y = -e.h / 2 - 16
    el('rect', { x: -w / 2, y: y - 10, width: w, height: 20, rx: 10, style: `stroke:${TONE[tone] || TONE.navy}` }, e.badgeG)
    el('text', { x: 0, y: y + 4, 'text-anchor': 'middle', style: `fill:${TONE[tone] || TONE.navy}` }, e.badgeG).textContent = text
    if (animate) e.badgeG.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' })
  }

  /* ---------------- data structures: array cells, tree/graph nodes, panels, pointers ---------------- */
  const DS_TYPES = new Set(['cell', 'vnode', 'box'])
  const laneLabels = []
  const ptrs = {}
  function drawDS(id, nd) {
    const g = el('g', { class: `node is-hidden ds ds-${nd.type}`, 'data-id': id }, nodesG)
    const tile = el('g', { class: 'tile' }, g)
    let W, H, valText = null, rowsG = null
    if (nd.type === 'cell') {
      W = Math.max(46, textW(nd.name, 10) + 20); H = 46
      el('rect', { class: 'ds-shape', x: -W / 2, y: -H / 2, width: W, height: H, rx: 5 }, tile)
      valText = el('text', { class: 'ds-val', x: 0, y: 6, 'text-anchor': 'middle' }, tile)
      if (nd.sub) el('text', { class: 'ds-idx', x: 0, y: H / 2 + 14, 'text-anchor': 'middle' }, tile).textContent = nd.sub
    } else if (nd.type === 'vnode') {
      W = H = 48
      el('circle', { class: 'ds-shape', r: 24 }, tile)
      valText = el('text', { class: 'ds-val', x: 0, y: 6, 'text-anchor': 'middle' }, tile)
      if (nd.sub) el('text', { class: 'ds-idx', x: 0, y: H / 2 + 14, 'text-anchor': 'middle' }, tile).textContent = nd.sub
    } else {
      W = nd.bw || 210; H = 32 + (nd.maxRows || 4) * 19 + 6
      const x0 = -W / 2, y0 = -H / 2
      el('rect', { class: 'tile-bg', x: x0, y: y0, width: W, height: H, rx: 4 }, tile)
      el('path', { class: 'tile-head', d: `M${x0 + 1},${y0 + 21} V${y0 + 4} Q${x0 + 1},${y0 + 1} ${x0 + 4},${y0 + 1} H${-x0 - 4} Q${-x0 - 1},${y0 + 1} ${-x0 - 1},${y0 + 4} V${y0 + 21} Z` }, tile)
      el('text', { class: 'tile-name', x: x0 + 10, y: y0 + 15 }, tile).textContent = String(nd.name).toUpperCase()
      rowsG = el('g', { class: 'ds-rows', transform: `translate(${x0 + 10} ${y0 + 30})` }, tile)
    }
    if (valText) valText.textContent = nd.name
    const badgeG = el('g', { class: 'badge' }, g)
    nodeEls[id] = { g, badgeG, bars: [], level: 0, w: W, h: H, x: nd.x, y: nd.y, ds: nd.type, valText, rowsG, maxRows: nd.maxRows || 4, orig: String(nd.name) }
    if (rowsG) setRows(id, [])
  }
  const MARKS = ['active', 'visited', 'done', 'dim', 'found', 'bad']
  function setVal(id, text, animate = false) {
    const e = nodeEls[id]
    if (!e || !e.valText) return
    S.ds.vals[id] = String(text)
    e.valText.textContent = String(text)
    if (animate) { e.g.classList.remove('is-changed'); void e.g.getBBox; requestAnimationFrame(() => e.g.classList.add('is-changed')) }
  }
  function setMark(ids, state) {
    for (const id of [].concat(ids)) {
      const e = nodeEls[id]
      if (!e) continue
      MARKS.forEach((m) => e.g.classList.remove('m-' + m))
      if (state) e.g.classList.add('m-' + state)
      if (state) S.ds.marks[id] = state
      else delete S.ds.marks[id]
    }
  }
  function setRows(id, rows, hl = -1) {
    const e = nodeEls[id]
    if (!e || !e.rowsG) return
    S.ds.rows[id] = rows.slice()
    e.rowsG.textContent = ''
    if (!rows.length) { el('text', { class: 'ds-empty', x: 0, y: 13 }, e.rowsG).textContent = '(empty)'; return }
    rows.slice(0, e.maxRows).forEach((r, i) => {
      if (i === hl) el('rect', { class: 'hl-bg', x: -6, y: i * 19, width: e.w - 8, height: 18, rx: 2 }, e.rowsG)
      el('text', { class: i === hl ? 'hl' : '', x: 0, y: i * 19 + 13 }, e.rowsG).textContent = String(r)
    })
    if (rows.length > e.maxRows) el('text', { class: 'ds-empty', x: e.w - 40, y: (e.maxRows - 1) * 19 + 13 }, e.rowsG).textContent = `+${rows.length - e.maxRows}`
  }
  function setEdge(a, b, color) {
    const ln = lanes[`${a}>${b}`]
    if (!ln) return
    const s = ln.shared
    s.path = color || null
    s.el.classList.toggle('is-path', !!color)
    if (!s.refs) s.el.style.stroke = color ? COLOR[color] : ''
    if (color) S.ds.edges[`${a}>${b}`] = color
    else delete S.ds.edges[`${a}>${b}`]
  }
  // pointers (i, j, lo, hi, mid…) slide between cells; several on one cell stack downwards
  function ptrAnchor(id) {
    const e = nodeEls[id], s = nodeScale()
    return [e.x, e.y + (e.h / 2 + (e.ds === 'box' ? 8 : 24)) * s]
  }
  function placePtrs() {
    const s = nodeScale()
    const stack = {}
    for (const name in ptrs) {
      const p = ptrs[name]
      if (!p.at || !nodeEls[p.at]) { p.g.style.display = 'none'; continue }
      p.g.style.display = ''
      const n = (stack[p.at] = (stack[p.at] || 0) + 1) - 1
      let [x, y] = ptrAnchor(p.at)
      if (p.from && p.p < 1 && nodeEls[p.from]) {
        const [x0, y0] = ptrAnchor(p.from), q = easeInOut(p.p)
        x = x0 + (x - x0) * q; y = y0 + (y - y0) * q
      }
      p.g.setAttribute('transform', `translate(${x.toFixed(1)} ${(y + n * 24 * s).toFixed(1)}) scale(${s.toFixed(3)})`)
    }
  }
  function ensurePtr(name, color) {
    if (ptrs[name]) return ptrs[name]
    const c = COLOR[color] || COLOR.amber
    const g = el('g', { class: 'ptr' }, ptrLayer)
    el('path', { d: 'M0,0 L6,8 L-6,8 Z', style: `fill:${c}` }, g)
    const t = el('text', { x: 0, y: 21, 'text-anchor': 'middle', style: `fill:${c}` }, g)
    t.textContent = name
    return (ptrs[name] = { g, at: null, from: null, p: 1 })
  }
  async function movePtr(ev, run, animate) {
    const p = ensurePtr(ev.name, ev.color)
    S.ds.ptrs[ev.name] = ev.at
    if (!animate || !p.at || !ev.at) { p.at = ev.at; p.from = null; p.p = 1; placePtrs(); return }
    p.from = p.at; p.at = ev.at; p.p = 0
    await tween(420, run, (q) => { p.p = q; placePtrs() })
    p.p = 1; p.from = null
    placePtrs()
  }
  function resetDS() {
    for (const id in nodeEls) {
      const e = nodeEls[id]
      if (!e.ds) continue
      if (e.valText) e.valText.textContent = e.orig
      if (e.rowsG) setRows(id, [])
      MARKS.forEach((m) => e.g.classList.remove('m-' + m))
    }
    for (const k in lanes) { lanes[k].shared.path = null; lanes[k].shared.el.classList.remove('is-path') }
    ptrLayer.textContent = ''
    for (const k in ptrs) delete ptrs[k]
    S.ds = { vals: {}, marks: {}, rows: {}, edges: {}, ptrs: {} }
  }

  /* ---------------- camera ---------------- */
  const camK = () => (S.cam ? S.cam.k : 1)
  // while the learner pans/zooms, cards keep the size they had when they took over, so zooming really magnifies
  const view = { user: false, s: 1, kFit: 1, target: null, vx: 0, vy: 0, raf: 0, last: 0 }
  const nodeScale = () => (view.user ? view.s : Math.min(camK(), SMAX, S.capS || SMAX))
  function targetCam() {
    const W = net.clientWidth || 800, H = net.clientHeight || 500
    const ids = [...S.vis].filter((id) => nodeEls[id])
    if (!ids.length) return null
    const top = 58
    // leave room for the caption at its tallest, so lines added later never cover a component
    const bottom = narrBox.offsetParent ? Math.max(narrBox.offsetHeight || 0, 118) + 20 : 16
    let k = 1.2, box
    for (let pass = 0; pass < 3; pass++) {
      const s = Math.min(k, SMAX, S.capS || SMAX)
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const id of ids) {
        const e = nodeEls[id]
        x0 = Math.min(x0, e.x - (e.w / 2 + 16) * s)
        x1 = Math.max(x1, e.x + (e.w / 2 + 16) * s)
        y0 = Math.min(y0, e.y - (e.h / 2 + 46) * s)
        y1 = Math.max(y1, e.y + (e.h / 2 + (e.ds && e.ds !== 'box' ? 50 : 14)) * s)
      }
      box = { x0, y0, x1, y1 }
      k = Math.max(0.85, (x1 - x0) / (W - 32), (y1 - y0) / Math.max(120, H - top - bottom))
    }
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2
    return { x: cx - (W / 2) * k, y: cy - (top + (H - top - bottom) / 2) * k, w: W * k, h: H * k, k }
  }
  function updateScales() {
    const s = nodeScale()
    for (const id in nodeEls) {
      const e = nodeEls[id]
      e.g.setAttribute('transform', `translate(${e.x} ${e.y}) scale(${s.toFixed(3)})`)
    }
    for (const l of laneLabels) l.el.setAttribute('transform', `translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) scale(${s.toFixed(3)})`)
    placePtrs()
  }
  let camAnim = 0
  // set the visible region: top-left corner (x, y) in world units and k = world units per screen pixel
  function applyCam(c) {
    const W = net.clientWidth || 800, H = net.clientHeight || 500
    const cam = { x: c.x, y: c.y, k: c.k, w: W * c.k, h: H * c.k }
    S.cam = cam
    net.setAttribute('viewBox', `${cam.x.toFixed(2)} ${cam.y.toFixed(2)} ${cam.w.toFixed(2)} ${cam.h.toFixed(2)}`)
    updateScales()
    if (view.user) zoomVal.textContent = Math.round((view.kFit / cam.k) * 100) + '%'
  }
  function fitCamera(animate) {
    if (view.user) {
      // the learner is steering: keep their view (re-measured for the panel size) and flag new content on FIT
      if (S.cam) applyCam(S.cam)
      if (animate) fitBtn.classList.add('attn')
      return
    }
    const to = targetCam()
    if (!to) return
    const apply = applyCam
    const from = S.cam
    const id = ++camAnim
    if (!animate || !from) return apply(to)
    const t0 = performance.now(), dur = 750
    const f = (now) => {
      if (id !== camAnim) return
      const p = easeInOut(Math.min(1, (now - t0) / dur))
      apply({ x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, w: from.w + (to.w - from.w) * p, h: from.h + (to.h - from.h) * p, k: from.k + (to.k - from.k) * p })
      if (p < 1) requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  }

  /* ---------------- pan & zoom (wheel, drag with glide, pinch, buttons, keys) ---------------- */
  const scopeEl = $('.scope')
  const zoomVal = $('.zoom-val')
  const fitBtn = $('[data-zoom="fit"]')
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  function takeOver() {
    if (view.user || !S.cam) return
    camAnim++ // stop any auto-framing animation
    view.s = nodeScale()
    view.kFit = S.cam.k
    view.user = true
    view.target = { x: S.cam.x, y: S.cam.y, k: S.cam.k }
    scopeEl.classList.add('is-user')
  }
  function resetView(animate = true) {
    view.user = false
    view.vx = view.vy = 0
    scopeEl.classList.remove('is-user')
    fitBtn.classList.remove('attn')
    zoomVal.textContent = 'AUTO'
    if (S.lesson) fitCamera(animate)
  }
  // ease the camera toward its target every frame; glide after a flick
  function frame(now) {
    view.raf = 0
    if (!view.user || !S.cam) return
    const dt = Math.min(48, now - (view.last || now))
    view.last = now
    const t = view.target
    let busy = false
    if (view.vx || view.vy) {
      t.x += view.vx * dt
      t.y += view.vy * dt
      const f = Math.pow(0.93, dt / 16)
      view.vx *= f
      view.vy *= f
      if (Math.hypot(view.vx, view.vy) < 0.004 * t.k) view.vx = view.vy = 0
      else busy = true
    }
    const c = S.cam
    const a = 1 - Math.exp(-dt / 65)
    const next = { x: c.x + (t.x - c.x) * a, y: c.y + (t.y - c.y) * a, k: c.k + (t.k - c.k) * a }
    if (Math.abs(t.k - next.k) / t.k < 0.0008 && Math.abs(t.x - next.x) < 0.15 * next.k && Math.abs(t.y - next.y) < 0.15 * next.k) {
      next.x = t.x; next.y = t.y; next.k = t.k
    } else busy = true
    applyCam(next)
    if (busy) kick()
  }
  function kick() {
    if (!view.raf) { view.last = performance.now(); view.raf = requestAnimationFrame(frame) }
  }
  // zoom by factor f (>1 = in) keeping the world point under (mx, my) fixed
  function zoomAt(mx, my, f) {
    takeOver()
    if (!view.user) return
    const t = view.target
    const k2 = clamp(t.k / f, view.kFit / 6, view.kFit * 2.5)
    const px = t.x + mx * t.k, py = t.y + my * t.k
    t.x = px - mx * k2
    t.y = py - my * k2
    t.k = k2
    kick()
  }
  const localPt = (e) => { const r = net.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }

  net.addEventListener('wheel', (e) => {
    e.preventDefault()
    const [mx, my] = localPt(e)
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
    zoomAt(mx, my, Math.exp(-dy * (e.ctrlKey ? 0.011 : 0.0016)))
  }, { passive: false })

  const pointers = new Map()
  let lastMove = null
  net.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!S.cam) return
    try { net.setPointerCapture(e.pointerId) } catch {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY })
    view.vx = view.vy = 0
    lastMove = { t: performance.now(), vx: 0, vy: 0 }
    scopeEl.classList.add('is-dragging')
  })
  net.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    if (!view.user) {
      // a plain click shouldn't take the camera; start steering once the hand has really moved
      if (pointers.size === 1 && Math.hypot(e.clientX - prev.sx, e.clientY - prev.sy) < 4) return
      takeOver()
    }
    const t = view.target
    if (pointers.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y
      pointers.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY })
      // 1:1 under the hand: move target and camera together, no easing lag
      t.x -= dx * t.k
      t.y -= dy * t.k
      applyCam({ x: S.cam.x - dx * S.cam.k, y: S.cam.y - dy * S.cam.k, k: S.cam.k })
      const now = performance.now(), dt = Math.max(1, now - lastMove.t)
      lastMove = { t: now, vx: 0.8 * ((-dx * t.k) / dt) + 0.2 * lastMove.vx, vy: 0.8 * ((-dy * t.k) / dt) + 0.2 * lastMove.vy }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const other = a === prev ? b : a
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y)
      const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      pointers.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY })
      const r = net.getBoundingClientRect()
      const m0 = [(prev.x + other.x) / 2 - r.left, (prev.y + other.y) / 2 - r.top]
      const m1 = [(e.clientX + other.x) / 2 - r.left, (e.clientY + other.y) / 2 - r.top]
      t.x -= (m1[0] - m0[0]) * t.k
      t.y -= (m1[1] - m0[1]) * t.k
      if (d0 > 0) zoomAt(m1[0], m1[1], d1 / d0)
      kick()
    }
  })
  const endPointer = (e) => {
    if (!pointers.delete(e.pointerId)) return
    if (pointers.size) return
    scopeEl.classList.remove('is-dragging')
    // flick: keep gliding if the hand was still moving when it let go
    if (lastMove && performance.now() - lastMove.t < 70) { view.vx = lastMove.vx; view.vy = lastMove.vy; kick() }
  }
  net.addEventListener('pointerup', endPointer)
  net.addEventListener('pointercancel', endPointer)
  net.addEventListener('dblclick', () => resetView(true))

  $('.zoom-ctl').addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]')
    if (!b) return
    const W = net.clientWidth / 2, H = net.clientHeight / 2
    if (b.dataset.zoom === 'in') zoomAt(W, H, 1.45)
    else if (b.dataset.zoom === 'out') zoomAt(W, H, 1 / 1.45)
    else resetView(true)
  })

  /* ---------------- requests moving along lanes ---------------- */
  function laneOn(key, color) {
    const ln = lanes[key]
    if (!ln) return
    ln.shared.refs++
    ln.shared.el.classList.add('is-active')
    ln.shared.el.style.stroke = COLOR[color]
  }
  function laneOff(key) {
    const ln = lanes[key]
    if (!ln) return
    const s = ln.shared
    s.refs = Math.max(0, s.refs - 1)
    if (!s.refs) { s.el.classList.remove('is-active'); s.el.style.stroke = s.path ? COLOR[s.path] : '' }
  }
  // the visible part of a hop: from the edge of one card to the edge of the next
  function hopGeom(a, b) {
    const A = nodeEls[a], B = nodeEls[b]
    const s = nodeScale()
    const dx = B.x - A.x, dy = B.y - A.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len, uy = dy / len
    const clip = (e) => Math.min(Math.abs(ux) > 1e-6 ? ((e.w / 2) * s + 6) / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? ((e.h / 2) * s + 6) / Math.abs(uy) : Infinity)
    const ta = Math.min(clip(A), len * 0.45), tb = Math.min(clip(B), len * 0.45)
    const x1 = A.x + ux * ta, y1 = A.y + uy * ta, x2 = B.x - ux * tb, y2 = B.y - uy * tb
    return { x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) || 1 }
  }

  // a request is a glowing diamond blip with a small readout tag above it
  function tokenGraphic(color, label) {
    const c = COLOR[color]
    const g = el('g', { class: `blip ${color}` }, fxG)
    el('circle', { r: 15, style: `fill:${c}`, opacity: 0.14 }, g)
    el('rect', { x: -6, y: -6, width: 12, height: 12, transform: 'rotate(45)', style: `fill:${c};filter:drop-shadow(0 0 5px ${c})` }, g)
    const tag = el('g', { class: 'blip-tag', transform: 'translate(0 -22)' }, g)
    const w = textW(label, 6.9) + 16
    el('rect', { x: -w / 2, y: -10, width: w, height: 19, rx: 2, style: `stroke:${c}` }, tag)
    el('text', { x: 0, y: 4, 'text-anchor': 'middle', style: `fill:${c}` }, tag).textContent = label
    return g
  }
  const place = (g, x, y, s) => g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(s * nodeScale()).toFixed(3)})`)

  async function sendPacket(ev, run) {
    addRow(ev, true)
    const hops = []
    for (let i = 0; i < ev.path.length - 1; i++) if (nodeEls[ev.path[i]] && nodeEls[ev.path[i + 1]]) hops.push([ev.path[i], ev.path[i + 1]])
    if (!hops.length) return
    hops.forEach(([a, b]) => laneOn(`${a}>${b}`, ev.color))
    const tok = tokenGraphic(ev.color, ev.label)
    const release = () => { tok.remove(); hops.forEach(([a, b]) => laneOff(`${a}>${b}`)) }
    let geo = hopGeom(...hops[0])
    let x = geo.x1, y = geo.y1
    const speed = ev.quick ? 0.95 : 0.6 // screen px per ms
    await tween(ev.quick ? 140 : 220, run, (p) => place(tok, x, y, easeOut(p)))
    for (const [i, hop] of hops.entries()) {
      if (run.cancelled) return release()
      geo = hopGeom(...hop)
      const lastHop = i === hops.length - 1
      const reach = ev.lost && lastHop ? 0.55 : 1
      const dur = Math.min(1300, Math.max(320, (geo.len * reach) / (speed * camK())))
      await tween(dur, run, (p) => {
        const q = p * reach
        x = geo.x1 + (geo.x2 - geo.x1) * q
        y = geo.y1 + (geo.y2 - geo.y1) * q
        place(tok, x, y, 1)
      })
      if (run.cancelled) return release()
      if (ev.lost && lastHop) {
        const c = el('path', { class: 'drop-cross', d: 'M-8,-8 L8,8 M8,-8 L-8,8', transform: `translate(${x} ${y}) scale(${nodeScale()})` }, fxG)
        await tween(520, run, (p) => { tok.style.opacity = 1 - p })
        c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 200, fill: 'forwards' }).onfinish = () => c.remove()
        return release()
      }
      if (!lastHop) { hit(hop[1]); await wait(ev.quick ? 40 : 90, run) }
    }
    hit(hops[hops.length - 1][1])
    await tween(180, run, (p) => place(tok, x, y, 1 - easeOut(p)))
    release()
    await wait(120, run)
  }
  // a request arriving lights the tile and pushes its load meter up; the meter drains on its own
  function setMeter(e, level) {
    e.level = Math.max(0, Math.min(4, level))
    e.bars.forEach((b, i) => { b.classList.toggle('on', i < e.level); b.classList.toggle('hi', e.level >= 4) })
  }
  function hit(id) {
    const e = nodeEls[id]
    if (!e) return
    e.g.classList.add('is-hit')
    setMeter(e, e.level + 1)
    clearTimeout(e.hitT)
    e.hitT = setTimeout(() => e.g.classList.remove('is-hit'), 650)
  }
  setInterval(() => {
    if (S.frozen) return
    for (const id in nodeEls) if (nodeEls[id].level) setMeter(nodeEls[id], nodeEls[id].level - 1)
  }, 1400)

  async function showNote(ev, run) {
    const e = nodeEls[ev.at]
    if (!e) return
    const s = nodeScale()
    const g = el('g', { class: 'note' }, fxG)
    const inner = el('g', {}, g)
    const color = TONE[ev.tone] || TONE.navy
    const w = textW(ev.text, 7.4) + 34
    const d = `M${-w / 2},-38 h${w} v26 h${-w / 2 + 7} l-7,8 l-7,-8 h${-w / 2 + 7} z`
    el('path', { class: 'note-box', d, style: `stroke:${color}` }, inner)
    el('circle', { cx: -w / 2 + 13, cy: -25, r: 3.5, style: `fill:${color}` }, inner)
    el('text', { class: 'note-text', x: -w / 2 + 23, y: -21, style: `fill:${color}` }, inner).textContent = ev.text
    const lift = -e.h / 2 - (S.badges[ev.at] ? 30 : 2)
    g.setAttribute('transform', `translate(${e.x} ${e.y + lift * s}) scale(${s})`)
    const hold = ev.hold || 1500
    ;(async () => {
      await tween(300, run, (p) => inner.setAttribute('transform', `scale(${(0.6 + 0.4 * easeOut(p)).toFixed(3)})`))
      await wait(hold, run)
      await tween(220, run, (p) => { inner.style.opacity = 1 - p })
      g.remove()
    })()
  }

  /* ---------------- events ---------------- */
  async function doEvent(ev, run) {
    if (run.cancelled) return
    switch (ev.type) {
      case 'show':
        ev.nodes.forEach((id) => setVisible(id, true))
        updateLanes()
        fitCamera(true)
        renderSeq()
        await wait(600, run)
        break
      case 'packet':
        await sendPacket(ev, run)
        break
      case 'par': {
        const all = []
        for (const [i, it] of ev.items.entries()) {
          if (i) await wait(ev.gap ?? 240, run)
          if (run.cancelled) return
          all.push(doEvent(it, run))
        }
        await Promise.all(all)
        break
      }
      case 'note':
        showNote(ev, run)
        await wait(700, run)
        break
      case 'badge':
        setBadge(ev.at, ev.text, ev.tone, true)
        await wait(420, run)
        break
      case 'state':
        setDown(ev.at, ev.state === 'down')
        await wait(450, run)
        break
      case 'wait':
        await wait(ev.ms, run)
        break
      case 'val':
        setVal(ev.at, ev.text, true)
        await wait(260, run)
        break
      case 'mark':
        setMark(ev.at, ev.state)
        await wait(160, run)
        break
      case 'rows':
        setRows(ev.at, ev.rows, ev.hl)
        await wait(320, run)
        break
      case 'edge':
        setEdge(ev.a, ev.b, ev.color)
        await wait(220, run)
        break
      case 'ptr':
        await movePtr(ev, run, true)
        break
      case 'say':
        // the sentence finishes typing before the action it describes starts
        await narrate(ev.text, run)
        await wait(200, run)
        break
    }
  }
  function applyInstant(ev, stepIdx) {
    switch (ev.type) {
      case 'show': ev.nodes.forEach((id) => setVisible(id, true)); break
      case 'packet': addRow(ev, false, stepIdx); break
      case 'par': ev.items.forEach((it) => applyInstant(it, stepIdx)); break
      case 'badge': setBadge(ev.at, ev.text, ev.tone, false); break
      case 'state': setDown(ev.at, ev.state === 'down'); break
      case 'val': setVal(ev.at, ev.text); break
      case 'mark': setMark(ev.at, ev.state); break
      case 'rows': setRows(ev.at, ev.rows, ev.hl); break
      case 'edge': setEdge(ev.a, ev.b, ev.color); break
      case 'ptr': { const p = ensurePtr(ev.name, ev.color); p.at = ev.at; p.from = null; p.p = 1; S.ds.ptrs[ev.name] = ev.at; break }
    }
  }

  /* ---------------- request feed ---------------- */
  const fmtT = (t) => (typeof t === 'string' ? t : t.toFixed(3) + ' s')
  function addRow(ev, live, stepIdx = S.step) {
    const row = {
      no: S.rows.length + 1,
      step: stepIdx,
      from: ev.path[0],
      to: ev.path[ev.path.length - 1],
      path: ev.path,
      color: ev.color,
      label: ev.label,
      payload: ev.payload || [],
      lost: !!ev.lost,
      ...ev.row,
    }
    S.rows.push(row)
    if (live) {
      S.current = S.rows.length - 1
      feed.querySelector('.feed-empty')?.remove()
      feed.querySelector('.is-current')?.classList.remove('is-current')
      const li = rowEl(row)
      li.classList.add('is-current', 'is-new')
      feed.appendChild(li)
      feedCount.textContent = `${S.rows.length}`
      requestAnimationFrame(() => feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' }))
      renderSeq()
    }
    return row
  }
  function rowEl(row) {
    const lesson = L()
    const li = document.createElement('li')
    li.className = `feed-item c-${row.color}` + (row.lost ? ' is-lost' : '')
    li.dataset.step = row.step
    li.innerHTML =
      `<span class="fi-no"><b>◆</b> ${String(row.no).padStart(3, '0')}</span>` +
      `<div class="fi-main">` +
      `<div class="fi-route">${esc(lesson.nodes[row.from].name)}<span class="arrow">→</span>${esc(lesson.nodes[row.to].name)}</div>` +
      `<div class="fi-info" title="${esc(row.info)}"><span class="lbl">${esc(row.label)}</span> ${esc(row.info)}${row.lost ? ' · NO REPLY' : ''}</div>` +
      `<div class="fi-meta">${[fmtT(row.t), row.kind, row.size].filter(Boolean).map(esc).join(' · ')}</div>` +
      `</div>` +
      `<div class="fi-payload">${row.payload.map(esc).join('\n')}</div>`
    return li
  }
  function renderFeed() {
    feed.textContent = ''
    feedCount.textContent = S.rows.length ? `${S.rows.length}` : ''
    if (!S.rows.length) {
      feed.innerHTML = `<li class="feed-empty">Requests will appear here as the lesson plays.</li>`
      return
    }
    for (const r of S.rows) feed.appendChild(rowEl(r))
    const cur = feed.children[S.current]
    if (cur) cur.classList.add('is-current')
    feed.scrollTop = feed.scrollHeight
  }
  feed.addEventListener('click', (e) => {
    const li = e.target.closest('.feed-item')
    if (li) jump(+li.dataset.step)
  })

  /* ---------------- sequence view ---------------- */
  function renderSeq() {
    if (!S.lesson) return
    const lesson = L()
    const ids = Object.keys(lesson.nodes).filter((id) => S.vis.has(id) || lesson.start.includes(id))
    const W = seqScroll.clientWidth || 600
    const left = 72
    const colW = Math.max(112, (W - left - 24) / Math.max(1, ids.length))
    const X = {}
    ids.forEach((id, i) => (X[id] = left + colW * (i + 0.5)))
    const width = Math.max(W, left + colW * ids.length + 12)
    seqTrack.style.width = width + 'px'
    seqTrack.innerHTML = ids.map((id) => `<div class="seq-who" style="left:${X[id]}px"><b>${esc(lesson.nodes[id].name)}</b><i>${esc(lesson.nodes[id].sub || '')}</i></div>`).join('')

    while (seqSvg.lastChild && seqSvg.lastChild !== seqDefs) seqSvg.removeChild(seqSvg.lastChild)
    const R = 34
    let y = 14
    const items = []
    let lastStep = null
    S.rows.forEach((row, ri) => {
      if (row.step !== lastStep) {
        y += lastStep === null ? 4 : 12
        items.push({ kind: 'step', y, step: row.step })
        y += 26
        lastStep = row.step
      }
      for (let i = 0; i < row.path.length - 1; i++) {
        items.push({ kind: 'arrow', row, ri, a: row.path[i], b: row.path[i + 1], y: y + R / 2, first: i === 0, last: i === row.path.length - 2 })
        y += R
      }
    })
    const height = Math.max(y + 24 + (narrBox.offsetHeight || 120) + 10, seqScroll.clientHeight || 300)
    seqSvg.setAttribute('width', width)
    seqSvg.setAttribute('height', height)
    for (const id of ids) el('line', { class: 'seq-life', x1: X[id], y1: 0, x2: X[id], y2: height }, seqSvg)
    if (!S.rows.length) el('text', { class: 'seq-empty', x: left, y: 40 }, seqSvg).textContent = 'Requests will appear here as the lesson plays.'
    let curY = null
    for (const it of items) {
      if (it.kind === 'step') {
        const g = el('g', { class: 'seq-step' + (it.step === S.step ? ' is-active' : '') }, seqSvg)
        el('line', { class: 'seq-step-line', x1: 0, y1: it.y + 10, x2: width, y2: it.y + 10 }, g)
        const st = lesson.steps[it.step]
        el('text', { class: 'seq-step-text', x: 12, y: it.y + 10 }, g).textContent = `Step ${it.step + 1} · ${st ? st.title : ''}`
        continue
      }
      const { row, a, b } = it
      if (X[a] == null || X[b] == null) continue
      const cur = it.ri === S.current
      const g = el('g', { class: `seq-arrow c-${row.color}${cur ? ' is-current' : ''}${row.lost && it.last ? ' is-lost' : ''}` }, seqSvg)
      const dir = X[b] > X[a] ? 1 : -1
      const x1 = X[a] + dir * 4
      let x2 = X[b] - dir * 6
      if (row.lost && it.last) x2 = x1 + (x2 - x1) * 0.6
      el('line', { class: 'seq-line', x1, y1: it.y, x2, y2: it.y, 'marker-end': row.lost && it.last ? '' : `url(#sq-${row.color})` }, g)
      if (row.lost && it.last) el('path', { class: 'seq-cross', d: `M${x2 - 5},${it.y - 5} l10,10 M${x2 + 5},${it.y - 5} l-10,10` }, g)
      if (it.first) el('text', { class: 'seq-time', x: left - 18, y: it.y }, g).textContent = fmtT(row.t)
      const lw = row.label.length * 7 + 16
      const mx = (x1 + x2) / 2
      el('rect', { class: 'seq-label-bg', x: mx - lw / 2, y: it.y - 9, width: lw, height: 18, rx: 9 }, g)
      el('text', { class: 'seq-label-text', x: mx, y: it.y }, g).textContent = row.label
      if (cur && curY == null) curY = it.y
    }
    if (curY != null && stage.classList.contains('is-sequence')) {
      const want = curY - seqScroll.clientHeight * 0.5
      if (want > seqScroll.scrollTop || curY < seqScroll.scrollTop) seqScroll.scrollTo({ top: Math.max(0, want), behavior: 'smooth' })
    }
  }
  seqScroll.addEventListener('scroll', () => { seqTrack.style.transform = `translateX(${-seqScroll.scrollLeft}px)` })

  /* ---------------- progress ---------------- */
  const prog = (id) => S.progress[id] || 0
  const status = (lesson) => { const p = prog(lesson.id); return p >= lesson.steps.length ? 'done' : p > 0 ? 'progress' : 'new' }
  function saveProgress(done) {
    const id = L().id
    if (done > prog(id)) {
      S.progress[id] = done
      store.set('progress', S.progress)
      renderRing()
      renderRail()
    }
  }

  /* ---------------- player ---------------- */
  async function runFrom(k) {
    const run = newRun()
    S.frozen = false
    for (let i = k; i < n(); i++) {
      S.step = i
      S.busy = true
      renderStepUI()
      for (const ev of L().steps[i].events) {
        await doEvent(ev, run)
        if (run.cancelled) return
      }
      S.busy = false
      saveProgress(i + 1)
      renderStepUI()
      if (!S.playing) return
      await wait(1900, run)
      if (run.cancelled || !S.playing) return
    }
    if (S.playing) showOutro()
  }

  function rebuild(k) {
    newRun()
    S.busy = false
    S.frozen = false
    fxG.textContent = ''
    for (const key in lanes) lanes[key].shared.refs = 0
    for (const key in lanes) { lanes[key].shared.el.classList.remove('is-active'); lanes[key].shared.el.style.stroke = '' }
    S.vis.clear()
    for (const id in nodeEls) { setVisible(id, false); setDown(id, false); setBadge(id, null); setMeter(nodeEls[id], 0) }
    resetDS()
    L().start.forEach((id) => setVisible(id, true))
    S.rows = []
    S.current = -1
    for (let i = 0; i < k; i++) L().steps[i].events.forEach((ev) => applyInstant(ev, i))
    S.current = S.rows.length - 1
    updateLanes()
    fitCamera(true)
    renderFeed()
    renderSeq()
  }

  function selectLesson(id, { keepDrawer = false } = {}) {
    const lesson = LESSONS.find((l) => l.id === id) || LESSONS[0]
    newRun()
    S.lesson = lesson
    S.playing = false
    S.step = -1
    S.cam = null
    view.user = false
    scopeEl.classList.remove('is-user')
    fitBtn.classList.remove('attn')
    zoomVal.textContent = 'AUTO'
    narrKey = ''
    buildDiagram()
    rebuild(0)
    S.step = -1
    renderRail()
    renderStepper()
    renderStepUI()
    renderLegend()
    fitCamera(false)
    if (location.hash !== '#' + lesson.id) history.replaceState(null, '', '#' + lesson.id)
    store.set('last', lesson.id)
    S.section = secOf(lesson)
    store.set('last-' + S.section, lesson.id)
    document.body.classList.toggle('sec-dsa', S.section === 'dsa')
    document.querySelectorAll('[data-section]').forEach((b) => { const on = b.dataset.section === S.section; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on) })
    $('.channels .label').textContent = S.section === 'dsa' ? 'Problems' : 'Channels'
    renderRing()
    renderRail()
    if (!keepDrawer) setRail(false)
    document.dispatchEvent(new CustomEvent('sde:lesson', { detail: { id: lesson.id } }))
  }

  function jump(i) {
    if (i < 0) return overview()
    narrKey = ''
    rebuild(i)
    runFrom(i)
  }
  function showOutro() {
    newRun()
    S.busy = false
    S.playing = false
    S.step = n()
    saveProgress(n())
    renderStepUI()
    renderSeq()
  }
  function overview() {
    S.playing = false
    rebuild(0)
    S.step = -1
    renderStepUI()
  }
  function play() {
    if (S.step >= n()) { S.playing = true; narrKey = ''; rebuild(0); runFrom(0); return renderControls() }
    S.playing = true
    if (S.busy) S.frozen = false
    else if (S.step < 0) runFrom(0)
    else if (S.step < n() - 1) runFrom(S.step + 1)
    else showOutro()
    renderStepUI()
  }
  function pauseIt() {
    S.playing = false
    if (S.busy) S.frozen = true
    renderStepUI()
  }
  function toggle() { S.playing && !S.frozen ? pauseIt() : play() }
  function stepFwd() {
    if (S.busy) { S.playing = false; S.frozen = false; renderControls(); return }
    S.playing = false
    if (S.step >= n()) { narrKey = ''; rebuild(0); runFrom(0); return }
    if (S.step < n() - 1) runFrom(S.step + 1)
    else showOutro()
    renderControls()
  }
  function stepBack() {
    if (S.step >= n()) return jump(n() - 1)
    if (S.step <= 0) return S.busy ? jump(0) : overview()
    jump(S.step - 1)
  }

  /* ---------------- lesson rail ---------------- */
  const GROUPS = [
    ['mine', 'Your lessons'],
    ['traffic', 'Traffic'],
    ['data', 'Data'],
    ['reliability', 'Reliability'],
    ['design', 'Design walkthroughs'],
    ['dsa', 'Coding interviews'],
  ]
  // the site has two separate sections; each keeps its own lesson list, progress and last lesson
  const secOf = (l) => (l && l.cat === 'dsa' ? 'dsa' : 'sd')
  const DSA_GROUPS = ['Arrays & hashing', 'Sorting & intervals', 'Binary search', 'Stacks, queues & design', 'Trees & graphs', 'Dynamic programming', 'More problems']
  function switchSection(sec) {
    if (sec === S.section) return
    const last = store.get('last-' + sec, null)
    const pick = LESSONS.find((l) => l.id === last && secOf(l) === sec) || LESSONS.find((l) => secOf(l) === sec)
    if (pick) selectLesson(pick.id, { keepDrawer: true })
  }
  document.querySelectorAll('[data-section]').forEach((b) => b.addEventListener('click', () => switchSection(b.dataset.section)))
  function renderRail() {
    const nav = $('.lesson-groups')
    let ch = 0
    const groups = S.section === 'dsa'
      ? DSA_GROUPS.map((g) => [g, g, (l) => l.cat === 'dsa' && (l.group || 'More problems') === g])
      : GROUPS.filter(([c]) => c !== 'dsa').map(([c, label]) => [c, label, (l) => l.cat === c])
    nav.innerHTML = groups.map(([, label, match]) => {
      const items = LESSONS.filter(match)
      if (!items.length) return ''
      return `<section class="group"><div class="group-head"><span class="label">${label}</span><span class="count">${items.length}</span></div><ul>${items
        .map((l) => {
          const st = status(l)
          const active = S.lesson && S.lesson.id === l.id
          const code = l.generated ? 'USR' : 'CH' + String(++ch).padStart(2, '0')
          return `<li class="li-wrap"><button type="button" class="lesson-item${active ? ' is-active' : ''}" data-id="${l.id}"${active ? ' aria-current="true"' : ''}>
            <span class="li-ch">${code}</span>
            <span class="li-text"><span class="li-title">${esc(l.title)}</span><span class="li-meta">${window.SDE_IDE && window.SDE_IDE.isSolved(l.id) ? '<b class="solved">✓ solved</b> · ' : ''}${esc(l.steps.length)} steps · ${esc(l.overview.full)}</span></span>
            <span class="li-led ${st}" title="${st === 'done' ? 'Completed' : st === 'progress' ? 'In progress' : 'Not started'}"></span>
          </button>${l.generated ? `<button type="button" class="li-del" data-del="${l.id}" aria-label="Delete ${esc(l.title)}">Delete</button>` : ''}</li>`
        })
        .join('')}</ul></section>`
    }).join('')
    $('.channel-count').textContent = `${LESSONS.filter((l) => secOf(l) === S.section).length} ${S.section === 'dsa' ? 'PROBLEMS' : 'CH'}`
  }
  $('.lesson-groups').addEventListener('click', (e) => {
    const del = e.target.closest('.li-del')
    if (del) {
      if (del.classList.contains('is-armed')) document.dispatchEvent(new CustomEvent('sde:delete', { detail: { id: del.dataset.del } }))
      else {
        del.classList.add('is-armed')
        del.textContent = 'Confirm?'
        setTimeout(() => { if (del.isConnected) { del.classList.remove('is-armed'); del.textContent = 'Delete' } }, 4000)
      }
      return
    }
    const item = e.target.closest('.lesson-item')
    if (item) selectLesson(item.dataset.id)
  })

  /* ---------------- stepper ---------------- */
  function renderStepper() {
    track.innerHTML = L().steps
      .map((s, i) => `<li class="step-seg" data-i="${i}"><button type="button" title="${esc(s.title)}: ${esc(s.desc)}"><span class="seg-bar"></span><span class="seg-label"><b>${i + 1}</b><span>${esc(s.title)}</span></span></button></li>`)
      .join('')
  }
  track.addEventListener('click', (e) => {
    const seg = e.target.closest('.step-seg')
    if (seg) jump(+seg.dataset.i)
  })
  function paintStepper() {
    $$('.step-seg', track).forEach((s, i) => {
      const done = i < S.step || (i === S.step && !S.busy) || S.step >= n()
      const active = i === S.step && S.busy
      s.classList.toggle('is-done', done)
      s.classList.toggle('is-active', active)
      s.classList.toggle('is-paused', active && S.frozen)
    })
  }

  /* ---------------- app bar ---------------- */
  function renderCrumb() {
    const lesson = L()
    $('.r-lesson .val').textContent = lesson.title.toUpperCase()
    $('.r-step .val').textContent = S.step < 0 ? `00/${String(n()).padStart(2, '0')}` : S.step >= n() ? `${String(n()).padStart(2, '0')}/${String(n()).padStart(2, '0')}` : `${String(S.step + 1).padStart(2, '0')}/${String(n()).padStart(2, '0')} ${lesson.steps[S.step].title.toUpperCase()}`
    $('.r-state .val').textContent = S.step < 0 ? 'STANDBY' : S.step >= n() ? 'COMPLETE' : S.busy ? (S.frozen ? 'PAUSED' : 'LIVE') : 'HOLD'
  }
  function renderRing() {
    const pool = LESSONS.filter((l) => secOf(l) === (S.section || 'sd'))
    const vals = pool.map((l) => Math.min(1, prog(l.id) / l.steps.length))
    const done = vals.filter((v) => v >= 1).length
    $('.gauge-segs').innerHTML = vals
      .slice()
      .sort((a, b) => b - a)
      .map((v) => `<i class="${v >= 1 ? 'on' : v > 0 ? 'part' : ''}"></i>`)
      .join('')
    $('.gauge-val').textContent = `${String(done).padStart(2, '0')}/${String(pool.length).padStart(2, '0')}`
  }

  /* ---------------- caption: about / what's happening / summary ---------------- */
  let narrKey = ''
  const MS_PER_CHAR = 29 // × PACE ≈ 50 ms per character at 1×, about average reading speed
  const charWeight = (ch) => (/[.!?]/.test(ch) ? 7 : /[,:;]/.test(ch) ? 3.5 : ch === '…' ? 5 : 1)
  function narrate(text, run = S.run) {
    narrList.querySelectorAll('li.is-current, li.is-typing').forEach((x) => x.classList.remove('is-current', 'is-typing'))
    const li = document.createElement('li')
    li.className = 'is-current is-typing'
    li.innerHTML = `<span class="narrate-n">${narrList.children.length + 1}</span><span class="narrate-text"><span class="typed"></span><span class="rest">${esc(text)}</span></span>`
    narrList.appendChild(li)
    narrList.scrollTop = narrList.scrollHeight
    const typed = li.querySelector('.typed'), rest = li.querySelector('.rest')
    const at = []
    let total = 0
    for (let i = 0; i < text.length; i++) { at.push(total); total += i === text.length - 1 ? 1 : charWeight(text[i]) }
    let shown = 0
    return tween(total * MS_PER_CHAR, run, (p) => {
      const now = p * total
      let c = shown
      while (c < text.length && at[c] <= now) c++
      if (p >= 1) c = text.length
      if (c === shown) return
      shown = c
      typed.textContent = text.slice(0, c)
      rest.textContent = text.slice(c)
    }).then(() => {
      typed.textContent = text
      rest.textContent = ''
      li.classList.remove('is-typing')
    })
  }
  function staticCaption(label, step, text) {
    narrBox.classList.add('is-about')
    $('.narrate-label').textContent = label
    $('.narrate-step').textContent = step
    narrList.innerHTML = `<li class="is-current"><span class="narrate-n"></span><span class="narrate-text">${esc(text)}</span></li>`
  }
  function renderNarration() {
    const key = `${L().id}:${S.step}`
    narrBox.hidden = false
    if (key === narrKey) return
    narrKey = key
    narrList.textContent = ''
    const lesson = L()
    if (S.step < 0) staticCaption('Briefing', `${n()} steps`, strip(lesson.overview.description))
    else if (S.step >= n()) staticCaption('Debrief', lesson.outro.title, `${strip(lesson.outro.desc ? lesson.outro.desc + '. ' : '')}${strip(lesson.outro.text)}`)
    else {
      narrBox.classList.remove('is-about')
      $('.narrate-label').textContent = 'Live narration'
      $('.narrate-step').textContent = `Step ${S.step + 1} of ${n()}`
    }
    requestAnimationFrame(() => fitCamera(true))
  }

  /* ---------------- controls & legend ---------------- */
  const ICON_PLAY = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 3l10 6-10 6Z" fill="currentColor"/></svg>'
  const ICON_PAUSE = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4.5 3h3.2v12H4.5zM10.3 3h3.2v12h-3.2z" fill="currentColor"/></svg>'
  const ICON_REPLAY = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9a5.5 5.5 0 1 0 1.7-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4.5 1.8v3.6h3.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  function renderControls() {
    const playingNow = S.playing && !S.frozen
    const done = S.step >= n()
    toggleBtn.innerHTML = done ? ICON_REPLAY : playingNow ? ICON_PAUSE : ICON_PLAY
    toggleBtn.setAttribute('aria-label', done ? 'Replay' : playingNow ? 'Pause' : S.busy && S.frozen ? 'Resume' : 'Play')
    $('[data-action="prev"]').disabled = S.step < 0
    $('[data-action="step"]').disabled = done
    startBtn.hidden = !(S.step < 0 || (done && !S.busy))
    $('.start-label').textContent = done ? 'Run again' : 'Start lesson'
    $('.stage-led').classList.toggle('blink', playingNow && S.busy)
    $('.feed-led').classList.toggle('amber', S.busy && !S.frozen)
  }
  function renderLegend() {
    $('.packet-legend').innerHTML = L()
      .legend.map(([c, t]) => (c ? `<span class="legend-item c-${c}"><i></i>${esc(t)}</span>` : `<span class="legend-item legend-note">${esc(t)}</span>`))
      .join('')
  }
  function renderStepUI() {
    renderNarration()
    renderCrumb()
    paintStepper()
    renderControls()
  }

  /* ---------------- view switch, theme, rail drawer ---------------- */
  function setView(v) {
    S.view = v
    store.set('view', v)
    stage.classList.toggle('is-sequence', v === 'sequence')
    $$('.view-switch button').forEach((b) => {
      const on = b.dataset.view === v
      b.classList.toggle('is-active', on)
      b.setAttribute('aria-selected', on)
    })
    const a = $('.view-switch button.is-active'), ind = $('.view-indicator')
    ind.style.left = a.offsetLeft + 'px'
    ind.style.width = a.offsetWidth + 'px'
    if (v === 'sequence') renderSeq()
  }
  $$('.view-switch button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)))

  function setTheme(t, save = true) {
    document.documentElement.dataset.theme = t
    if (save) try { localStorage.setItem('sde:theme', t) } catch {}
    $('.theme-label').textContent = t === 'dark' ? 'Day' : 'Night'
  }
  setTheme(document.documentElement.dataset.theme || 'dark', false)
  $('.theme-btn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'))

  const railBtn = $('.rail-toggle')
  function setRail(open) {
    document.body.classList.toggle('rail-open', open)
    railBtn.setAttribute('aria-expanded', open)
  }
  railBtn.addEventListener('click', () => setRail(!document.body.classList.contains('rail-open')))
  $('.scrim').addEventListener('click', () => setRail(false))

  /* ---------------- buttons & keys ---------------- */
  toggleBtn.addEventListener('click', toggle)
  startBtn.addEventListener('click', play)
  $('[data-action="step"]').addEventListener('click', stepFwd)
  $('[data-action="prev"]').addEventListener('click', stepBack)
  const SPEEDS = [1, 2, 0.5]
  $('[data-action="speed"]').addEventListener('click', (e) => {
    S.speed = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length]
    e.currentTarget.textContent = (S.speed === 0.5 ? '½' : S.speed) + '×'
  })
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.target.closest('input, textarea, [contenteditable]')) return
    if (e.key === ' ') { e.preventDefault(); toggle() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepFwd() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepBack() }
    else if (e.key === 'v' || e.key === 'V') setView(S.view === 'network' ? 'sequence' : 'network')
    else if (e.key === 'Escape') setRail(false)
    else if ((e.key === '+' || e.key === '=') && !stage.classList.contains('is-sequence')) zoomAt(net.clientWidth / 2, net.clientHeight / 2, 1.45)
    else if ((e.key === '-' || e.key === '_') && !stage.classList.contains('is-sequence')) zoomAt(net.clientWidth / 2, net.clientHeight / 2, 1 / 1.45)
    else if (e.key === '0') resetView(true)
  })

  document.addEventListener('sde:solved', () => renderRail())
  let resizeT
  const relayout = () => { clearTimeout(resizeT); resizeT = setTimeout(() => { fitCamera(false); renderSeq(); setView(S.view) }, 80) }
  window.addEventListener('resize', relayout)
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(stage)
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1)
    if (id && (!S.lesson || S.lesson.id !== id) && LESSONS.some((l) => l.id === id)) selectLesson(id)
  })

  /* ---------------- API for the Claude features (chat.js, builder.js) ---------------- */
  window.SDE = {
    current: () => L(),
    addLessons(list, { select = false } = {}) {
      let pick = null
      for (const lesson of list) {
        const i = LESSONS.findIndex((l) => l.id === lesson.id)
        if (i >= 0) LESSONS[i] = lesson
        else LESSONS.push(lesson)
        if (select || S.pending === lesson.id) { pick = lesson.id; S.pending = null }
      }
      renderRing()
      if (pick && (!S.lesson || S.lesson.id !== pick || select)) selectLesson(pick, { keepDrawer: true })
      else renderRail()
    },
    removeLesson(id) {
      const i = LESSONS.findIndex((l) => l.id === id)
      if (i < 0) return
      LESSONS.splice(i, 1)
      delete S.progress[id]
      store.set('progress', S.progress)
      renderRing()
      if (S.lesson && S.lesson.id === id) selectLesson(LESSONS[0].id, { keepDrawer: true })
      else renderRail()
    },
    lessonLabel() {
      const lesson = L()
      const where = S.step < 0 ? 'overview' : S.step >= n() ? 'complete' : `step ${S.step + 1}/${n()} · ${lesson.steps[S.step].title}`
      return `${lesson.title} · ${where}`
    },
    // a plain-text snapshot of what the learner is looking at right now
    context() {
      const lesson = L()
      const name = (id) => (lesson.nodes[id] ? lesson.nodes[id].name : id)
      const out = []
      out.push(`Lesson: "${lesson.title}" (${lesson.overview.full}).`)
      out.push(`What the lesson is about: ${strip(lesson.overview.description)}`)
      out.push(`Lesson steps: ${lesson.steps.map((s, i) => `${i + 1}. ${s.title}`).join(' | ')}`)
      if (S.step < 0) out.push('Where the learner is: the start of the lesson. They have not played it yet.')
      else if (S.step >= n()) out.push(`Where the learner is: finished the lesson. Recap: ${strip(lesson.outro.text)}`)
      else {
        const s = lesson.steps[S.step]
        const state = S.busy ? (S.frozen ? 'paused in the middle of this step' : 'this step is playing right now') : 'this step has finished playing'
        out.push(`Where the learner is: step ${S.step + 1} of ${n()}, "${s.title}" (${s.desc}); ${state}.`)
        out.push(`Background for this step: ${strip(s.detail)}`)
        out.push(`Key facts for this step: ${s.facts.map(([k, v]) => `${k}: ${v}`).join('; ')}`)
      }
      if (S.step >= 0 && S.step < n()) {
        const said = $$('.narrate-lines li .narrate-text').map((e) => e.textContent.trim()).filter(Boolean)
        if (said.length) out.push(`Narration shown so far in this step:\n${said.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`)
      }
      const parts = [...S.vis].map((id) => {
        const extra = []
        if (S.down.has(id)) extra.push('DOWN')
        if (S.badges[id]) extra.push(`label "${S.badges[id].text}"`)
        return name(id) + (extra.length ? ` (${extra.join(', ')})` : '')
      })
      if (parts.length) out.push(`Components on the diagram: ${parts.join(', ')}.`)
      if (lesson.cat === 'dsa' && S.ds) {
        const show = (id) => `${name(id)}${S.ds.vals[id] != null && S.ds.vals[id] !== lesson.nodes[id].name ? `=${S.ds.vals[id]}` : ''}${S.ds.marks[id] ? `(${S.ds.marks[id]})` : ''}`
        const cells = Object.keys(lesson.nodes).filter((id) => lesson.nodes[id].type !== 'box' && S.vis.has(id))
        if (cells.length) out.push(`Data on screen: ${cells.map(show).join(', ')}.`)
        for (const id in S.ds.rows) if (S.ds.rows[id].length) out.push(`${lesson.nodes[id].name}: ${S.ds.rows[id].join(' | ')}`)
        const ps = Object.entries(S.ds.ptrs).filter(([, at]) => at).map(([p, at]) => `${p}→${name(at)}`)
        if (ps.length) out.push(`Pointers: ${ps.join(', ')}.`)
      }
      if (window.SDE_IDE && lesson.code) out.push(window.SDE_IDE.context())
      const rows = S.rows.slice(-24)
      if (rows.length) {
        out.push(`Requests so far (oldest first):\n${rows
          .map((r) => `  #${r.no} [step ${r.step + 1}] ${r.path.map(name).join(' → ')}: ${r.label} (${r.kind}: ${r.info}, ${r.size}, t=${fmtT(r.t)})${r.lost ? ', got no reply' : ''}`)
          .join('\n')}`)
      }
      const done = LESSONS.filter((l) => status(l) === 'done').map((l) => l.title)
      out.push(`Lessons the learner has completed: ${done.length ? done.join(', ') : 'none yet'}. All lessons on the site: ${LESSONS.map((l) => l.title).join(', ')}.`)
      return out.join('\n')
    },
  }

  /* ---------------- boot ---------------- */
  renderRing()
  const first = location.hash.slice(1) || store.get('last', LESSONS[0].id)
  // a lesson you built loads a moment later (from your account); remember it and open it when it arrives
  if (!LESSONS.some((l) => l.id === first) && /^g-/.test(first)) S.pending = first
  selectLesson(LESSONS.some((l) => l.id === first) ? first : LESSONS[0].id, { keepDrawer: true })
  setView(S.view)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setView(S.view))
})()
