// Builds artifact.html, the version of index.html that gets published as a Claude Artifact.
// The Artifact host wraps the page in its own <!doctype>/<html>/<head>/<body> skeleton, so this
// keeps the head's title, font links, theme script and stylesheet, then the body's content.
// index.html stays the one source of truth: run `node build-artifact.mjs` after editing it.
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
const head = src.match(/<head>([\s\S]*?)<\/head>/i)[1]
const body = src.match(/<body>([\s\S]*?)<\/body>/i)[1]

const keep = []
keep.push(head.match(/<title>[\s\S]*?<\/title>/i)[0])
for (const m of head.matchAll(/<link [^>]*fonts\.(googleapis|gstatic)\.com[^>]*>/gi)) keep.push(m[0])
keep.push(head.match(/<script>[\s\S]*?<\/script>/i)[0])
for (const m of head.matchAll(/<link rel="stylesheet" href="(?!https?:)[^"]+"[^>]*>/gi)) keep.push(m[0])

const out = `${keep.join('\n')}\n${body.trim()}\n`
writeFileSync(new URL('./artifact.html', import.meta.url), out)
console.log(`artifact.html written (${out.length} bytes)`)
