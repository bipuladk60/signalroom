const { lessons, gens } = require(process.argv[2] || require('path').join(__dirname, '..', 'dsa.js'))
const buildTree = (a) => { if (!a.length || a[0] == null) return null; const nodes = a.map((v) => (v == null ? null : { val: v, left: null, right: null })); let i = 1; for (const n of nodes) { if (!n) continue; if (i < nodes.length) n.left = nodes[i++]; if (i < nodes.length) n.right = nodes[i++] } return nodes[0] }
const norm = (v, mode) => mode === 'sorted' && Array.isArray(v) ? v.slice().sort((a, b) => a - b) : v
let fails = 0
for (const L of lessons) {
  const c = L.code
  const f = new Function(c.solution + `\nreturn ${c.fn}`)()
  // sanity: lesson structure
  for (const st of L.steps) for (const e of st.events) {
    const ids = e.type === 'packet' ? e.path : e.type === 'show' ? e.nodes : e.at != null ? [].concat(e.at) : e.a ? [e.a, e.b] : []
    for (const id of ids) if (id && !L.nodes[id]) { console.log('BAD NODE', L.id, id, e.type); fails++ }
  }
  c.tests.forEach((t, ti) => {
    let tt = t
    if (t.gen) tt = { ...t, ...gens[t.gen]() }
    let got
    const t0 = Date.now()
    if (c.kind === 'class') {
      let obj; got = tt.ops.map(([m, ...a], i) => { if (i === 0) { obj = new f(...a); return null } const r = obj[m](...a); return r === undefined ? null : r })
    } else {
      const args = JSON.parse(JSON.stringify(tt.args)).map((a, i) => (c.argTypes && c.argTypes[i] === 'tree' ? buildTree(a) : a))
      got = f(...args)
    }
    if (tt.expected === null && !t.gen) { console.log(`FILL ${L.id} test ${ti}: expected = ${JSON.stringify(got)}`); return }
    const ok = JSON.stringify(norm(got, c.compare)) === JSON.stringify(norm(tt.expected, c.compare))
    if (!ok) { fails++; console.log(`FAIL ${L.id} #${ti} ${t.name || ''}: got ${JSON.stringify(got).slice(0, 80)} expected ${JSON.stringify(tt.expected).slice(0, 80)}`) }
    else console.log(`ok   ${L.id.padEnd(20)} #${ti} ${(t.name || '').padEnd(36)} ${Date.now() - t0}ms`)
  })
  console.log(`     ${L.id}: ${L.steps.length} steps, ${L.steps.reduce((n, s) => n + s.events.length, 0)} events`)
}
console.log(fails ? `${fails} FAILURES` : 'ALL GOOD')
