/* Code lab: an in-browser IDE for the coding lessons, Python (default) or JavaScript.
   - Python is real CPython (Pyodide, bundled with the site, loaded once and cached by the browser).
   - Each test runs in a Web Worker with a time limit, so an infinite loop is stopped instead of
     freezing the page. Run = example tests, Submit = the full test suite.
   - Full problem write-up (statement, examples, constraints, follow-up) in a scrollable pane with a
     draggable divider. Works everywhere, localhost included; it doesn't need Claude. */
;(() => {
  const panel = document.querySelector('.ide')
  if (!panel || !window.SDE) return
  const $ = (s) => panel.querySelector(s)
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sde:' + k); return v == null ? d : v } catch { return d } },
    set(k, v) { try { localStorage.setItem('sde:' + k, v) } catch {} },
  }
  const solved = (() => { try { return JSON.parse(store.get('solved', '{}')) } catch { return {} } })()

  const ta = $('.ed-input'), hl = $('.ed-hl code'), gutter = $('.ed-gutter'), con = $('.ide-console')
  const statusEl = $('.ide-status'), engineEl = $('.ide-engine')
  let lesson = null, spec = null, lastRun = null, saveT = 0
  let lang = store.get('lang', 'py') === 'js' ? 'js' : 'py'

  // language view of the current problem: Python fields override the shared JavaScript ones
  const cur = () => (lang === 'py' ? { ...spec, ...spec.py, statement: (spec.py && spec.py.statement) || spec.statement } : spec)
  const unit = () => (lang === 'py' ? '    ' : '  ')
  const pyText = (s) => (lang === 'py' ? String(s).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None').replace(/"startsWith"/g, '"starts_with"') : String(s))

  /* ---------------- syntax highlighting ---------------- */
  const KW = {
    js: new Set('const let var function return if else for while do break continue new class constructor this of in switch case default try catch finally throw typeof instanceof null undefined true false extends super static async await yield delete void'.split(' ')),
    py: new Set('def class return if elif else for while in not and or is None True False import from as with try except finally raise lambda yield pass break continue global nonlocal del assert async await self'.split(' ')),
  }
  const TOKENS = {
    js: /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(`(?:\\[\s\S]|[^`\\])*`?|'(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g,
    py: /(#[^\n]*)|((?:[rRbBfFuU]{1,2})?(?:'''[\s\S]*?(?:'''|$)|"""[\s\S]*?(?:"""|$)|'(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?))|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)(?=\s*\()|([A-Za-z_][\w]*)/g,
  }
  function highlight(src) {
    const re = TOKENS[lang], kw = KW[lang]
    let out = '', last = 0, m
    re.lastIndex = 0
    while ((m = re.exec(src))) {
      if (!m[0]) { re.lastIndex++; continue }
      out += esc(src.slice(last, m.index))
      const [t, com, str, num, call, word] = m
      if (com) out += `<span class="tk-com">${esc(t)}</span>`
      else if (str) out += `<span class="tk-str">${esc(t)}</span>`
      else if (num) out += `<span class="tk-num">${t}</span>`
      else if (call) out += kw.has(call) ? `<span class="tk-kw">${call}</span>` : `<span class="tk-fn">${call}</span>`
      else out += kw.has(word) ? `<span class="tk-kw">${word}</span>` : esc(word)
      last = m.index + t.length
    }
    return out + esc(src.slice(last)) + '\n'
  }
  function paint() {
    hl.innerHTML = highlight(ta.value)
    const n = ta.value.split('\n').length
    if (gutter.childElementCount !== n) gutter.innerHTML = Array.from({ length: n }, (_, i) => `<span>${i + 1}</span>`).join('')
    syncScroll()
  }
  function syncScroll() {
    hl.parentElement.scrollTop = ta.scrollTop
    hl.parentElement.scrollLeft = ta.scrollLeft
    gutter.scrollTop = ta.scrollTop
  }
  const codeKey = () => `code:${lang}:${lesson.id}`
  ta.addEventListener('input', () => { paint(); clearTimeout(saveT); saveT = setTimeout(() => lesson && store.set(codeKey(), ta.value), 400) })
  ta.addEventListener('scroll', syncScroll)

  // editing comforts: Tab / Shift+Tab indent, Enter keeps indentation (and indents after ':' or '{'),
  // Backspace removes a whole indent step, Ctrl/Cmd+Enter runs, Ctrl/Cmd+Shift+Enter submits
  function replaceSel(text, selStart, selEnd) {
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end')
    if (selStart != null) ta.setSelectionRange(selStart, selEnd)
    ta.dispatchEvent(new Event('input'))
  }
  ta.addEventListener('keydown', (e) => {
    const U = unit()
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.shiftKey ? submit() : run(); return }
    const v = ta.value, s = ta.selectionStart, en = ta.selectionEnd
    const ls = v.lastIndexOf('\n', s - 1) + 1
    if (e.key === 'Tab') {
      e.preventDefault()
      if (s === en && !e.shiftKey) return replaceSel(U)
      const le = v.indexOf('\n', en - (en > s && v[en - 1] === '\n' ? 1 : 0)); const end = le < 0 ? v.length : le
      const block = v.slice(ls, end)
      const changed = e.shiftKey ? block.replace(new RegExp(`^ {1,${U.length}}`, 'gm'), '') : block.replace(/^/gm, U)
      ta.setSelectionRange(ls, end)
      replaceSel(changed, ls, ls + changed.length)
      return
    }
    if (e.key === 'Backspace' && s === en && s > ls) {
      const before = v.slice(ls, s)
      if (/^ +$/.test(before) && before.length % U.length === 0) { e.preventDefault(); ta.setSelectionRange(s - U.length, s); replaceSel(''); return }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const line = v.slice(ls, s)
      let ind = line.match(/^\s*/)[0]
      if (lang === 'py') {
        if (/:\s*(#.*)?$/.test(line)) ind += U
        else if (/^\s*(return|pass|break|continue|raise)\b/.test(line)) ind = ind.slice(0, Math.max(0, ind.length - U.length))
        replaceSel('\n' + ind)
        return
      }
      const opener = /[{[(]\s*$/.test(line)
      const closer = /^[ \t]*[}\])]/.test(v.slice(s))
      if (opener && closer) { const inner = ind + U; replaceSel('\n' + inner + '\n' + ind); ta.setSelectionRange(s + 1 + inner.length, s + 1 + inner.length); return }
      if (opener) ind += U
      replaceSel('\n' + ind)
      return
    }
    if (lang === 'js' && e.key === '}' && /^\s*$/.test(v.slice(ls, s)) && s - ls >= 2) { e.preventDefault(); ta.setSelectionRange(s - 2, s); replaceSel('}') }
  })

  /* ---------------- JavaScript engine ---------------- */
  const JS_WORKER = `
const fmt = (v) => { if (typeof v === 'string') return v; try { return JSON.stringify(v) } catch { return String(v) } }
const buildTree = (a) => { if (!a || !a.length || a[0] == null) return null; const ns = a.map((v) => (v == null ? null : { val: v, left: null, right: null })); let i = 1; for (const n of ns) { if (!n) continue; if (i < ns.length) n.left = ns[i++]; if (i < ns.length) n.right = ns[i++] } return ns[0] }
let cached = null, cachedCode = null, logs = []
const push = (p) => (...a) => { if (logs.length < 100) logs.push(p + a.map(fmt).join(' ').slice(0, 500)) }
console.log = push(''); console.info = push(''); console.warn = push('warn: '); console.error = push('error: ')
self.onmessage = (e) => {
  const { code, fn, kind, test, argTypes } = e.data
  logs = []
  if (code !== cachedCode) {
    cachedCode = code; cached = null
    try { cached = new Function(code + '\\n;return typeof ' + fn + " !== 'undefined' ? " + fn + ' : undefined')() }
    catch (err) { postMessage({ fatal: (err.name || 'Error') + ': ' + err.message, logs }); return }
    if (typeof cached !== 'function') { postMessage({ fatal: fn + ' is not defined. Keep the name ' + fn + ' so the tests can find it.', logs }); return }
  }
  const t0 = performance.now()
  try {
    let out
    if (kind === 'class') {
      let obj
      out = test.ops.map(([m, ...a], i) => {
        if (i === 0) { obj = new cached(...a); return null }
        if (typeof obj[m] !== 'function') throw new Error('method ' + m + '() is missing')
        const r = obj[m](...a)
        return r === undefined ? null : r
      })
    } else {
      out = cached(...test.args.map((a, i) => (argTypes && argTypes[i] === 'tree' ? buildTree(a) : a)))
      if (out === undefined) out = null
    }
    postMessage({ out: JSON.parse(JSON.stringify(out)), ms: performance.now() - t0, logs })
  } catch (err) {
    postMessage({ error: (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err)), ms: performance.now() - t0, logs })
  }
}`

  /* ---------------- Python engine (Pyodide) ---------------- */
  const PY_HARNESS = String.raw`
import json, sys, io, time, traceback
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val, self.left, self.right = val, left, right
    def __repr__(self):
        return "TreeNode(" + repr(self.val) + ")"
def _build(a):
    if not a or a[0] is None:
        return None
    ns = [None if v is None else TreeNode(v) for v in a]
    i = 1
    for n in ns:
        if n is None:
            continue
        if i < len(ns):
            n.left = ns[i]; i += 1
        if i < len(ns):
            n.right = ns[i]; i += 1
    return ns[0]
def _plain(x):
    if isinstance(x, bool) or x is None or isinstance(x, (int, str)):
        return x
    if isinstance(x, float):
        return None if (x != x or x in (float('inf'), float('-inf'))) else x
    if isinstance(x, (list, tuple)):
        return [_plain(v) for v in x]
    if isinstance(x, dict):
        return {str(k): _plain(v) for k, v in x.items()}
    if isinstance(x, (set, frozenset)):
        return sorted(_plain(v) for v in x)
    return repr(x)
def _err(e):
    tb = traceback.extract_tb(e.__traceback__)
    lines = [fr.lineno for fr in tb if fr.filename == 'solution.py']
    return type(e).__name__ + ': ' + str(e) + (' (line ' + str(lines[-1]) + ')' if lines else '')
_cache = {'code': None, 'ns': None}
def _run(code, fn, kind, test_json, types_json, rename_json):
    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    def done(d):
        d['logs'] = buf.getvalue().splitlines()[:100]
        return json.dumps(d)
    try:
        if _cache['code'] != code:
            ns = {'TreeNode': TreeNode, '__name__': 'solution'}
            try:
                exec(compile(code, 'solution.py', 'exec'), ns)
            except SyntaxError as e:
                return done({'fatal': 'SyntaxError: ' + str(e.msg) + ' (line ' + str(e.lineno) + ')'})
            except Exception as e:
                return done({'fatal': _err(e)})
            _cache['code'], _cache['ns'] = code, ns
        f = _cache['ns'].get(fn)
        if f is None:
            return done({'fatal': fn + ' is not defined. Keep the name ' + fn + ' so the tests can find it.'})
        t = json.loads(test_json)
        types = json.loads(types_json)
        ren = json.loads(rename_json)
        t0 = time.perf_counter()
        try:
            if kind == 'class':
                obj = None
                out = []
                for j, op in enumerate(t['ops']):
                    m, a = op[0], op[1:]
                    if j == 0:
                        obj = f(*a)
                        out.append(None)
                        continue
                    name = ren.get(m, m)
                    meth = getattr(obj, name, None)
                    if meth is None:
                        raise AttributeError('method ' + name + '() is missing')
                    out.append(meth(*a))
            else:
                args = [_build(a) if j < len(types) and types[j] == 'tree' else a for j, a in enumerate(t['args'])]
                out = f(*args)
        except RecursionError:
            return done({'error': 'RecursionError: maximum recursion depth exceeded. Try an iterative approach (a queue or an explicit stack).', 'ms': (time.perf_counter() - t0) * 1000})
        except Exception as e:
            return done({'error': _err(e), 'ms': (time.perf_counter() - t0) * 1000})
        return done({'out': _plain(out), 'ms': (time.perf_counter() - t0) * 1000})
    finally:
        sys.stdout = old
`
  // Python's standard library is served as plain source in stdlib.json (data the page can host);
  // the worker packs it into an in-memory zip (stored, uncompressed) for Pyodide to boot from.
  const PY_WORKER = `
function crcTable() { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t }
function makeZip(files) {
  const T = crcTable(), enc = new TextEncoder(), parts = [], central = []
  let off = 0, count = 0
  for (const name in files) {
    const nb = enc.encode(name), data = enc.encode(files[name])
    let c = 0xFFFFFFFF
    for (let i = 0; i < data.length; i++) c = T[(c ^ data[i]) & 255] ^ (c >>> 8)
    c = (c ^ 0xFFFFFFFF) >>> 0
    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true)
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, c, true); h.setUint32(18, data.length, true)
    h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true)
    parts.push(new Uint8Array(h.buffer), nb, data)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true)
    cd.setUint16(10, 0, true); cd.setUint16(12, 0, true); cd.setUint16(14, 0x21, true); cd.setUint32(16, c, true)
    cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, nb.length, true)
    cd.setUint32(42, off, true)
    central.push(new Uint8Array(cd.buffer), nb)
    off += 30 + nb.length + data.length
    count++
  }
  let size = 0
  for (const p of central) size += p.length
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, count, true); end.setUint16(10, count, true)
  end.setUint32(12, size, true); end.setUint32(16, off, true)
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)])
}
let py = null, booting = null
self.onmessage = async (e) => {
  const d = e.data
  try {
    if (!py) {
      booting = booting || (async () => {
        importScripts(d.base + 'pyodide.js')
        const res = await fetch(d.base + 'stdlib.json')
        if (!res.ok) throw new Error('standard library not found (' + res.status + ')')
        const stdLibURL = URL.createObjectURL(makeZip(await res.json()))
        const p = await loadPyodide({ indexURL: d.base, stdLibURL })
        p.runPython(d.harness)
        return p
      })()
      py = await booting
    }
  } catch (err) { postMessage({ boot: 'failed', fatal: 'Python could not start: ' + ((err && err.message) || err) }); return }
  if (d.ping) { postMessage({ boot: 'ready' }); return }
  const run = py.globals.get('_run')
  try { postMessage(JSON.parse(run(d.code, d.fn, d.kind, JSON.stringify(d.test), JSON.stringify(d.argTypes || []), JSON.stringify(d.rename || {})))) }
  catch (err) { postMessage({ error: 'Python crashed: ' + ((err && err.message) || err) }) }
  finally { run.destroy() }
}`
  const blobUrl = (src) => URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
  const URLS = { js: blobUrl(JS_WORKER), py: blobUrl(PY_WORKER) }
  const PY_BASE = new URL('pyodide/', document.baseURI).href
  const workers = { js: null, py: null }
  let pyReady = null // promise once Python is booting / booted
  function getWorker(l) { return (workers[l] ||= new Worker(URLS[l])) }
  function kill(l) { if (workers[l]) { workers[l].terminate(); workers[l] = null } if (l === 'py') { pyReady = null; setEngine('') } }
  function setEngine(text, tone = '') { engineEl.textContent = text; engineEl.dataset.tone = tone }
  function ensurePython() {
    if (pyReady) return pyReady
    setEngine('loading Python…', 'busy')
    pyReady = new Promise((resolve) => {
      const w = getWorker('py')
      const t = setTimeout(() => { kill('py'); setEngine('Python failed to load', 'bad'); resolve({ fatal: 'Python took too long to load. Check your connection and try again.' }) }, 90000)
      w.onmessage = (e) => {
        clearTimeout(t)
        if (e.data.boot === 'ready') { setEngine('Python 3.12 ready', 'ok'); resolve({ ok: true }) }
        else { kill('py'); setEngine('Python failed to load', 'bad'); resolve({ fatal: e.data.fatal || 'Python could not start.' }) }
      }
      w.postMessage({ ping: true, base: PY_BASE, harness: PY_HARNESS })
    })
    return pyReady
  }
  async function runOne(code, test, limitMs) {
    const C = cur()
    if (lang === 'py') {
      const boot = await ensurePython()
      if (boot.fatal) return { fatal: boot.fatal }
    }
    return new Promise((resolve) => {
      const w = getWorker(lang)
      const timer = setTimeout(() => { kill(lang); resolve({ tle: true }) }, limitMs)
      w.onmessage = (e) => { clearTimeout(timer); resolve(e.data) }
      w.onerror = (e) => { clearTimeout(timer); kill(lang); resolve({ error: e.message || 'Worker error' }) }
      w.postMessage({ code, fn: C.fn, kind: spec.kind, test: { args: test.args, ops: test.ops }, argTypes: spec.argTypes, rename: C.rename, base: PY_BASE, harness: PY_HARNESS })
    })
  }

  /* ---------------- run / submit ---------------- */
  const norm = (v) => (spec.compare === 'sorted' && Array.isArray(v) ? v.slice().sort((a, b) => (a > b ? 1 : a < b ? -1 : 0)) : v)
  const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b))
  const short = (v, n = 90) => { let s; try { s = JSON.stringify(v) } catch { s = String(v) } return s && s.length > n ? s.slice(0, n) + '…' : s }
  const shortPy = (v, n) => pyText(short(v, n))
  const describe = (t) => (spec.kind === 'class'
    ? t.ops.map(([m, ...a]) => `${(cur().rename || {})[m] || m}(${a.map((x) => shortPy(x, 20)).join(',')})`).join(' ').slice(0, 140) + (t.ops.length > 8 ? ' …' : '')
    : t.args.map((a) => shortPy(a, 60)).join(', '))
  const materialize = (t) => { if (!t.gen) return t; const g = window.DSA_GENS && window.DSA_GENS[t.gen]; return g ? { ...t, ...g() } : t }
  const stripComments = (s) => (lang === 'py' ? s.replace(/#[^\n]*/g, '') : s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''))

  let running = false
  async function execute(mode) {
    if (!spec || running) return
    running = true
    setButtons(true)
    const code = ta.value
    const tests = spec.tests.filter((t) => mode === 'submit' || t.sample).map(materialize)
    con.innerHTML = ''
    const head = line('run-head', lang === 'py' && !pyReady ? 'Starting Python (first run only, a few seconds)…' : `${mode === 'submit' ? 'Submitting' : 'Running examples'} · 0/${tests.length}`)
    const banned = (cur().banned || []).filter((b) => stripComments(code).includes(b))
    if (banned.length) {
      head.className = 'c-line verdict bad'
      head.textContent = `Not allowed here: ${banned.join(', ')}`
      line('dim', 'This problem asks you to solve it without that. See the constraints.')
      return finish(mode, { pass: 0, total: tests.length, banned: true })
    }
    let pass = 0, totalMs = 0
    const logs = []
    for (let i = 0; i < tests.length; i++) {
      const t = tests[i]
      const limit = t.gen ? 3000 : 2500
      const r = await runOne(code, t, limit)
      head.textContent = `${mode === 'submit' ? 'Submitting' : 'Running examples'} · ${i + 1}/${tests.length}`
      if (r.logs && r.logs.length) logs.push(...r.logs.map((l) => `[test ${i + 1}] ${l}`))
      if (r.fatal) { line('bad', r.fatal); return finish(mode, { pass: 0, total: tests.length, fatal: r.fatal }, logs) }
      const name = t.name ? ` · ${t.name}` : ''
      if (r.tle) {
        card(false, `Test ${i + 1}${name}: time limit exceeded (over ${limit / 1000}s)`, t.gen ? 'Large input. A slower-than-needed approach or an infinite loop runs out of time here.' : 'Possible infinite loop.', t)
        if (mode === 'submit') return finish(mode, { pass, total: tests.length, failedAt: i + 1, why: 'Time limit exceeded' }, logs)
        continue
      }
      totalMs += r.ms || 0
      if (r.error) {
        card(false, `Test ${i + 1}${name}: runtime error`, r.error, t)
        if (mode === 'submit') return finish(mode, { pass, total: tests.length, failedAt: i + 1, why: 'Runtime error' }, logs)
        continue
      }
      const ok = same(r.out, t.expected)
      if (ok) pass++
      if (mode === 'run' || !ok) card(ok, `Test ${i + 1}${name}: ${ok ? 'passed' : 'wrong answer'} · ${(r.ms || 0).toFixed(1)} ms`, null, t, r.out)
      else line('ok', `✓ Test ${i + 1}${name} · ${(r.ms || 0).toFixed(1)} ms`)
      if (mode === 'submit' && !ok) return finish(mode, { pass, total: tests.length, failedAt: i + 1, why: 'Wrong answer' }, logs)
    }
    finish(mode, { pass, total: tests.length, ms: totalMs }, logs)
  }
  function line(cls, text) {
    const d = document.createElement('div')
    d.className = 'c-line ' + cls
    d.textContent = text
    con.appendChild(d)
    con.scrollTop = con.scrollHeight
    return d
  }
  function card(ok, title, msg, t, got) {
    const d = document.createElement('div')
    d.className = 'c-card ' + (ok ? 'ok' : 'bad')
    d.innerHTML = `<div class="c-title">${ok ? '✓' : '✗'} ${esc(title)}</div>` +
      `<div class="c-kv"><span>input</span><code>${esc(describe(t))}</code></div>` +
      (msg ? `<div class="c-kv"><span>${ok ? 'note' : 'error'}</span><code>${esc(msg)}</code></div>` : '') +
      (got !== undefined ? `<div class="c-kv"><span>expected</span><code>${esc(shortPy(t.expected, 160))}</code></div><div class="c-kv"><span>got</span><code>${esc(shortPy(got, 160))}</code></div>` : '')
    con.appendChild(d)
    con.scrollTop = con.scrollHeight
  }
  function finish(mode, res, logs = []) {
    running = false
    setButtons(false)
    const head = con.querySelector('.run-head')
    const accepted = mode === 'submit' && res.pass === res.total && !res.fatal && !res.banned
    if (head && !res.banned) {
      if (accepted) { head.className = 'c-line verdict ok'; head.textContent = `Accepted · ${res.pass}/${res.total} tests passed · ${res.ms.toFixed(0)} ms total` }
      else if (mode === 'submit') { head.className = 'c-line verdict bad'; head.textContent = res.fatal ? 'Error before any test ran' : `${res.why} on test ${res.failedAt} · ${res.pass}/${res.total} passed before it` }
      else { head.className = 'c-line verdict ' + (res.pass === res.total && !res.fatal ? 'ok' : 'bad'); head.textContent = res.fatal ? 'Error before any test ran' : `Examples: ${res.pass}/${res.total} passed${res.pass === res.total ? '. Now try Submit for the full test set.' : ''}` }
    }
    if (logs.length) {
      const d = document.createElement('div')
      d.className = 'c-logs'
      d.innerHTML = `<div class="c-sub">${lang === 'py' ? 'print output' : 'console'}</div>` + logs.slice(0, 60).map((l) => `<div>${esc(l)}</div>`).join('')
      con.appendChild(d)
    }
    if (accepted) {
      solved[lesson.id] = true
      store.set('solved', JSON.stringify(solved))
      renderStatus()
      document.dispatchEvent(new CustomEvent('sde:solved', { detail: { id: lesson.id } }))
    }
    lastRun = { mode, lang, ...res, at: Date.now() }
  }
  function setButtons(busy) { for (const b of panel.querySelectorAll('[data-ide]')) b.disabled = busy }
  const run = () => execute('run')
  const submit = () => execute('submit')

  /* ---------------- problem pane ---------------- */
  function renderProblem() {
    const C = cur()
    const ex = (spec.examples || []).map((x, i) => `
      <div class="pb-ex">
        <div class="pb-ex-h">Example ${i + 1}</div>
        <div class="pb-io"><span>Input</span><pre>${esc(pyText(x.in))}</pre></div>
        <div class="pb-io"><span>Output</span><pre>${esc(pyText(x.out))}</pre></div>
        ${x.why ? `<div class="pb-io"><span>Why</span><p>${esc(pyText(x.why))}</p></div>` : ''}
      </div>`).join('')
    const sig = lang === 'py' ? (spec.kind === 'class' ? `class ${C.fn}` : `def ${C.fn}(…)`) : (spec.kind === 'class' ? `class ${C.fn}` : `function ${C.fn}(…)`)
    $('.ide-problem').innerHTML = `
      <div class="pb-head"><h3>${esc(lesson.title)}</h3><span class="pb-diff d-${(spec.difficulty || 'Medium').toLowerCase()}">${esc(spec.difficulty || 'Medium')}</span></div>
      <div class="pb-sig"><code>${esc(sig)}</code></div>
      <p class="pb-statement">${C.statement}</p>
      ${ex}
      <div class="pb-sec">Constraints</div>
      <ul class="pb-cons">${(spec.constraints || []).map((c) => `<li>${c}</li>`).join('')}</ul>
      ${spec.followUp ? `<div class="pb-sec">Follow-up</div><p class="pb-follow">${esc(spec.followUp)}</p>` : ''}
      <div class="pb-sec">Tests</div>
      <p class="pb-note">Run checks the ${spec.tests.filter((t) => t.sample).length} examples. Submit runs all ${spec.tests.length} tests, including edge cases${spec.tests.some((t) => t.gen) ? ' and a large input with a 3-second time limit' : ''}.</p>`
  }
  function renderLang() {
    panel.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === lang))
    if (lang === 'py' && pyReady) setEngine('Python 3.12 ready', 'ok')
    else setEngine(lang === 'py' ? 'Python 3.12' : pyAvailable ? 'JavaScript' : 'JavaScript · Python runs in the local version', '')
  }
  function renderStatus() {
    statusEl.textContent = solved[lesson?.id] ? 'SOLVED' : ''
    statusEl.classList.toggle('on', !!solved[lesson?.id])
  }
  function load(l) {
    lesson = l
    spec = l.code
    lastRun = null
    renderProblem()
    renderLang()
    ta.value = store.get(codeKey(), cur().starter)
    paint()
    $('.ide-problem').scrollTop = 0
    con.innerHTML = `<div class="c-line dim">Write your solution, then Run (Ctrl+Enter) to try the examples or Submit (Ctrl+Shift+Enter) for every test.${lang === 'py' ? ' Python loads the first time you run (a few seconds).' : ''}</div>`
    renderStatus()
  }
  function setLang(l) {
    if (l === lang || running) return
    if (lesson) store.set(codeKey(), ta.value)
    lang = l
    store.set('lang', l)
    if (lesson) load(lesson)
    if (lang === 'py') idle(() => pyCheck.then((ok) => ok && ensurePython()))
  }
  panel.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)))

  // Python needs the bundled runtime in ./pyodide/. Where it isn't served (the claude.ai published
  // copy can't host its standard-library archive), fall back to JavaScript and say why.
  let pyAvailable = true
  const pyCheck = fetch(PY_BASE + 'pyodide.js', { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok).catch(() => false)
  pyCheck.then((ok) => {
    if (ok) return
    pyAvailable = false
    const b = panel.querySelector('[data-lang="py"]')
    b.disabled = true
    b.title = 'Python runs in the local version of this site (the published copy can only host JavaScript).'
    if (lang === 'py') { lang = 'js'; if (lesson) load(lesson) }
    setEngine('Python: local version only', '')
  })

  // draggable divider between the problem and the editor (double-click to toggle a tall problem view)
  const body = $('.ide-body'), split = $('.ide-split')
  const setProbH = (px) => { body.style.setProperty('--prob-h', px + 'px'); store.set('prob-h', String(Math.round(px))) }
  const savedH = +store.get('prob-h', 0)
  if (savedH) body.style.setProperty('--prob-h', savedH + 'px')
  split.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    split.setPointerCapture(e.pointerId)
    const top = body.getBoundingClientRect().top
    const max = body.clientHeight - 170
    const move = (ev) => setProbH(Math.max(60, Math.min(max, ev.clientY - top)))
    const up = () => { split.removeEventListener('pointermove', move); split.removeEventListener('pointerup', up); body.classList.remove('is-resizing') }
    body.classList.add('is-resizing')
    split.addEventListener('pointermove', move)
    split.addEventListener('pointerup', up)
  })
  split.addEventListener('dblclick', () => {
    const h = $('.ide-problem').offsetHeight
    setProbH(h < body.clientHeight * 0.55 ? body.clientHeight * 0.72 : body.clientHeight * 0.3)
  })

  const sideLog = (on) => document.body.classList.toggle('side-log', on)
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500))
  function sync() {
    const l = window.SDE.current()
    const dsa = !!(l && l.code)
    document.body.classList.toggle('mode-dsa', dsa)
    if (!dsa) { sideLog(false); return }
    if (l !== lesson) load(l)
    if (lang === 'py') idle(() => pyCheck.then((ok) => ok && lang === 'py' && ensurePython())) // warm Python up in the background
    window.dispatchEvent(new Event('resize'))
  }
  document.addEventListener('sde:lesson', sync)
  panel.querySelector('[data-ide="run"]').addEventListener('click', run)
  panel.querySelector('[data-ide="submit"]').addEventListener('click', submit)
  panel.querySelector('[data-ide="reset"]').addEventListener('click', (e) => {
    const b = e.currentTarget
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Sure?'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Reset' }, 3000); return }
    delete b.dataset.armed; b.textContent = 'Reset'
    ta.value = cur().starter; ta.dispatchEvent(new Event('input'))
  })
  panel.querySelector('[data-ide="solution"]').addEventListener('click', (e) => {
    const b = e.currentTarget
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Replace my code?'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Solution' }, 3500); return }
    delete b.dataset.armed; b.textContent = 'Solution'
    store.set(`code-backup:${lang}:${lesson.id}`, ta.value)
    ta.value = cur().solution; ta.dispatchEvent(new Event('input'))
    con.innerHTML = `<div class="c-line dim">Reference solution loaded (your previous code is backed up in this browser). Read it, then Submit to see it pass.</div>`
  })
  document.querySelectorAll('[data-side]').forEach((b) => b.addEventListener('click', () => sideLog(b.dataset.side === 'log')))

  window.SDE_IDE = {
    isSolved: (id) => !!solved[id],
    context() {
      if (!spec) return ''
      const code = ta.value.length > 4000 ? ta.value.slice(0, 4000) + '\n…' : ta.value
      let r = 'No run yet.'
      if (lastRun) r = lastRun.fatal ? `Last ${lastRun.mode}: error before tests ran: ${lastRun.fatal}` : `Last ${lastRun.mode}: ${lastRun.pass}/${lastRun.total} passed${lastRun.failedAt ? `, failed test ${lastRun.failedAt} (${lastRun.why})` : ''}.`
      const L = lang === 'py' ? 'Python' : 'JavaScript'
      return `Coding problem for this lesson (${spec.difficulty}): ${cur().statement.replace(/<[^>]+>/g, '')}\nConstraints: ${(spec.constraints || []).map((c) => c.replace(/<[^>]+>/g, '')).join('; ')}\nThe learner is writing ${L}. Their code in the editor:\n\`\`\`${lang === 'py' ? 'python' : 'js'}\n${code}\n\`\`\`\n${r}\n(When they ask for help with their code, give hints and point at the bug before handing over a full solution, unless they ask for the solution. Answer in ${L}.)`
    },
  }
  sync()
})()
