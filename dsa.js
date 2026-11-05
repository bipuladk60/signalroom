/* Coding-interview (DSA) lessons.
   Each lesson is produced by running the real algorithm on a small example and recording what it
   does (pointer moves, lookups, writes), so the animation always matches the algorithm.
   Problem statements, examples and tests are written for this site; problem choice follows the
   patterns candidates most often report from Google coding interviews. */
;(() => {
  function lesson(meta) {
    const les = {
      id: meta.id, name: meta.name, title: meta.title, cat: 'dsa', tier: 'APP',
      nodes: {}, links: [], start: [], legend: meta.legend || [],
      overview: { full: meta.full, description: meta.description, facts: meta.facts },
      steps: [], outro: null, code: meta.code,
    }
    let cur = null, ops = 0
    const keys = new Set()
    const ev = (e) => { cur.events.push(e); return e }
    const R = {
      les,
      node(id, type, name, sub, x, y, extra = {}) {
        les.nodes[id] = { type, name: String(name), sub: sub == null ? '' : String(sub), x, y, ...extra }
        if (!extra.hidden) les.start.push(id)
        return id
      },
      array(prefix, vals, x0, y, gap = 64, sub = (i) => `[${i}]`, extra = {}) {
        return vals.map((v, i) => R.node(prefix + i, 'cell', v, sub ? sub(i) : '', x0 + i * gap, y, extra))
      },
      box(id, name, x, y, maxRows = 4, bw = 220, extra = {}) { return R.node(id, 'box', name, '', x, y, { maxRows, bw, ...extra }) },
      link(a, b, opt) {
        const k = [a, b].sort().join('|')
        if (keys.has(k)) return
        keys.add(k)
        les.links.push(opt ? [a, b, opt] : [a, b])
      },
      step(title, desc, detail, facts = []) { cur = { title, desc, detail, facts, events: [] }; les.steps.push(cur) },
      say: (text) => ev({ type: 'say', text }),
      show: (...ids) => ev({ type: 'show', nodes: ids.flat() }),
      val: (at, text) => ev({ type: 'val', at, text: String(text) }),
      mark: (at, state) => ev({ type: 'mark', at: [].concat(at), state }),
      ptr: (name, at, color = 'amber') => ev({ type: 'ptr', name, at, color }),
      rows: (at, rows, hl = -1) => ev({ type: 'rows', at, rows: rows.map(String), hl }),
      edge: (a, b, color) => ev({ type: 'edge', a, b, color }),
      note: (at, text, tone = 'navy') => ev({ type: 'note', at, text, tone }),
      badge: (at, text, tone = 'navy') => ev({ type: 'badge', at, text, tone }),
      wait: (ms) => ev({ type: 'wait', ms }),
      op(path, color, label, kind, info, payload = [], quick = true) {
        for (let i = 0; i < path.length - 1; i++) R.link(path[i], path[i + 1], { ghost: true })
        ops++
        return ev({ type: 'packet', path, color, label, payload, row: { t: '#' + String(ops).padStart(2, '0'), kind, info, size: '' }, quick })
      },
      outro(title, desc, text, facts) { les.outro = { title, desc, text, facts } },
      done() { return les },
    }
    return R
  }
  const out = []
  const legendStd = [['blue', 'Lookup / compare'], ['violet', 'Write / push'], ['green', 'Found / result'], ['amber', 'Move / pop']]

  /* ================================================================ 1. Two Sum */
  {
    const nums = [3, 8, 4, 6, 5], target = 10
    const R = lesson({
      id: 'two-sum', name: 'TWO SUM', title: 'Two Sum', full: 'Hash map lookup in one pass',
      description: `Find the positions of two numbers that add up to a target. Trying every pair costs O(n²). Instead, walk the list once and remember every number you've passed in a hash map; for each new number, ask the map whether its partner (target minus the number) has already appeared.`,
      facts: [['Pattern', 'Hash map: look up the complement'], ['Time', 'O(n)'], ['Space', 'O(n)'], ['Brute force', 'O(n²), every pair'], ['Often a', 'Phone-screen warm-up']],
      legend: legendStd,
      code: {
        fn: 'twoSum', kind: 'fn', compare: 'sorted',
        statement: `Given an array of integers <code>nums</code> and an integer <code>target</code>, return the indices of the two different elements whose values add up to <code>target</code>. Exactly one such pair exists. You may return the two indices in any order.`,
        examples: [['nums = [3,8,4,6,5], target = 10', '[2,3]'], ['nums = [3,3], target = 6', '[0,1]']],
        starter: `function twoSum(nums, target) {\n  // Return [i, j] with nums[i] + nums[j] === target\n\n}\n`,
        solution: `function twoSum(nums, target) {\n  const seen = new Map() // value -> index\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i]\n    if (seen.has(need)) return [seen.get(need), i]\n    seen.set(nums[i], i)\n  }\n  return []\n}\n`,
        tests: [
          { args: [[3, 8, 4, 6, 5], 10], expected: [2, 3], sample: true },
          { args: [[3, 3], 6], expected: [0, 1], sample: true },
          { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
          { args: [[-4, 1, 9, -1], 8], expected: [2, 3], name: 'negative numbers' },
          { args: [[0, 4, 3, 0], 0], expected: [0, 3], name: 'zeros' },
          { gen: 'twoSumBig', name: '200,000 numbers (needs O(n))' },
        ],
      },
    })
    const cells = R.array('n', nums, 120, 330)
    R.node('tgt', 'vnode', target, 'target', 248, 180)
    R.box('map', 'seen  value → index', 690, 330, 5, 220)
    R.step('The Idea', 'Remember what you have seen', `We need two positions whose values add up to ${target}. For any number x, its partner must be ${target} − x. If we keep every number we've passed in a hash map, checking for the partner is a single O(1) lookup.`, [['Target', target], ['Map', 'empty'], ['Plan', 'one pass, left to right']])
    R.say(`We have ${nums.length} numbers and a target of ${target}. We want two positions whose numbers add up to exactly ${target}.`)
    R.say(`Instead of trying every pair, we walk the list once and keep a hash map of every number we've already passed, with its position.`)
    const seen = new Map()
    for (let i = 0; i < nums.length; i++) {
      const v = nums[i], need = target - v
      const found = seen.has(need)
      R.step(`Index ${i}: ${v}`, found ? 'The partner is already in the map' : `Is ${need} in the map?`,
        found ? `At index ${i} the value is ${v}; its partner ${need} was stored at index ${seen.get(need)}. One lookup found it, so we're done after a single pass.` : `At index ${i} the value is ${v}, so its partner would be ${need}. The map doesn't have ${need} yet, so we store ${v} → ${i} for later numbers to find.`,
        [['x', v], ['Partner', `${target} − ${v} = ${need}`], ['Map has it?', found ? `yes, index ${seen.get(need)}` : 'no']])
      R.ptr('i', cells[i])
      R.mark(cells[i], 'active')
      R.say(`At index ${i} the number is ${v}. Its partner would be ${target} minus ${v}, which is ${need}.`)
      R.op([cells[i], 'map'], 'blue', `${need}?`, 'LOOKUP', `is ${need} in the map?`)
      if (found) {
        const j = seen.get(need)
        const rows = [...seen].map(([k, x]) => `${k} → ${x}`)
        R.rows('map', rows, rows.indexOf(`${need} → ${j}`))
        R.say(`Yes! ${need} was stored at index ${j}. So positions ${j} and ${i} add up to ${target}.`)
        R.op(['map', cells[j]], 'green', `idx ${j}`, 'HIT', `${need} found at index ${j}`)
        R.mark([cells[i], cells[j]], 'found')
        R.badge(cells[j], 'ANSWER', 'green')
        R.badge(cells[i], 'ANSWER', 'green')
        break
      }
      R.say(`${need} isn't there yet, so we store ${v} at position ${i} for the numbers still to come.`)
      seen.set(v, i)
      R.op([cells[i], 'map'], 'violet', `${v}→${i}`, 'STORE', `map[${v}] = ${i}`)
      R.rows('map', [...seen].map(([k, x]) => `${k} → ${x}`), seen.size - 1)
      R.mark(cells[i], 'visited')
    }
    R.outro('Pair found', 'Indices 2 and 3', `One pass and one hash-map lookup per element found the pair: 4 + 6 = 10. Each number only has to ask "has my partner shown up already?", which is why the whole thing runs in O(n). Now try writing it yourself in the editor.`, [['Answer', '[2, 3]'], ['Lookups', '4'], ['Time', 'O(n)'], ['Space', 'O(n)']])
    out.push(R.done())
  }

  /* ================================================================ 2. Longest substring without repeats */
  {
    const s = 'abcbdae'
    const R = lesson({
      id: 'longest-substring', name: 'SLIDING WINDOW', title: 'Longest Unique Substring', full: 'Longest substring without repeating characters',
      description: `Find the length of the longest stretch of a string with no repeated character. A sliding window keeps two pointers: the right one adds characters, and when a character repeats, the left one jumps just past that character's last position. Each character is visited once.`,
      facts: [['Pattern', 'Sliding window + last-seen map'], ['Time', 'O(n)'], ['Space', 'O(alphabet)'], ['Trap', "Left pointer must never move backwards"]],
      legend: [['blue', 'Check last seen'], ['violet', 'Record position'], ['amber', 'Window jump']],
      code: {
        fn: 'lengthOfLongestSubstring', kind: 'fn', compare: 'exact',
        statement: `Given a string <code>s</code>, return the length of the longest substring (a contiguous run of characters) in which no character appears more than once.`,
        examples: [['s = "abcbdae"', '5   ("cbdae")'], ['s = "aaaa"', '1']],
        starter: `function lengthOfLongestSubstring(s) {\n  // Return the length of the longest substring with all-distinct characters\n\n}\n`,
        solution: `function lengthOfLongestSubstring(s) {\n  const last = new Map() // char -> last index\n  let left = 0, best = 0\n  for (let right = 0; right < s.length; right++) {\n    const c = s[right]\n    if (last.has(c) && last.get(c) >= left) left = last.get(c) + 1\n    last.set(c, right)\n    best = Math.max(best, right - left + 1)\n  }\n  return best\n}\n`,
        tests: [
          { args: ['abcbdae'], expected: 5, sample: true },
          { args: ['aaaa'], expected: 1, sample: true },
          { args: [''], expected: 0, name: 'empty string' },
          { args: ['abba'], expected: 2, name: "left pointer mustn't move back" },
          { args: ['dvdf'], expected: 3 },
          { args: ['tmmzuxt'], expected: 5 },
          { gen: 'longStringBig', name: '300,000 characters' },
        ],
      },
    })
    const cells = R.array('c', s.split(''), 120, 300, 64)
    R.box('last', 'last seen  char → index', 380, 520, 6, 250)
    R.node('best', 'vnode', 0, 'best', 700, 520)
    const last = new Map()
    let left = 0, best = 0
    const winMarks = (l, r) => cells.forEach((c, i) => R.mark(c, i < l ? 'dim' : i <= r ? 'active' : null))
    const lastRows = () => [...last].map(([k, v]) => `${k} → ${v}`)
    R.step('The Window', 'Two pointers, one pass', `The window is the substring between L and R. R moves right one character at a time. As long as the new character isn't already inside the window, the window just grows.`, [['String', `"${s}"`], ['Window', 'empty'], ['Best', 0]])
    R.say(`We want the longest run of "${s}" with no repeated letters.`)
    R.say(`Two pointers mark a window: L is its start, R its end. R walks right, and we track where each letter was last seen.`)
    R.ptr('L', cells[0], 'teal')
    for (let r = 0; r < s.length; r++) {
      const c = s[r]
      if (r === 3) R.step('A Repeat', `"${c}" is already in the window`, `R reaches another "${c}". Its last position (${last.get(c)}) is inside the window, so the window can't include both. L jumps to one past that position, and everything before L is dropped.`, [['Repeat', `"${c}" at ${last.get(c)} and ${r}`], ['L jumps to', last.get(c) + 1], ['Best so far', best]])
      if (r === 4) R.step('Grow Again', 'New letters extend the window', `After the jump, new letters keep extending the window. Each time it's longer than the best so far, we record it.`, [['Window start', left], ['Best so far', best]])
      R.ptr('R', cells[r])
      R.op([cells[r], 'last'], 'blue', `${c}?`, 'CHECK', `last seen "${c}"${last.has(c) ? ` = ${last.get(c)}` : ': never'}`)
      if (last.has(c) && last.get(c) >= left) {
        const p = last.get(c)
        R.say(`"${c}" was last seen at position ${p}, which is inside the window. So L jumps to position ${p + 1}, just past it.`)
        left = p + 1
        R.ptr('L', cells[left], 'teal')
        R.note(cells[r], 'REPEAT', 'amber')
      } else {
        R.say(r === 0 ? `"${c}" is new. The window is "${s.slice(left, r + 1)}".` : `"${c}" isn't in the window, so the window grows to "${s.slice(left, r + 1)}".`)
      }
      last.set(c, r)
      R.op([cells[r], 'last'], 'violet', `${c}→${r}`, 'RECORD', `last["${c}"] = ${r}`, [], true)
      R.rows('last', lastRows(), [...last.keys()].indexOf(c))
      winMarks(left, r)
      if (r - left + 1 > best) {
        best = r - left + 1
        R.val('best', best)
        R.note('best', `NEW BEST ${best}`, 'green')
      }
    }
    R.mark(cells.slice(left), 'found')
    R.say(`R has reached the end. The longest window was "${s.slice(left)}", ${best} letters long.`)
    R.outro('Longest run found', `"cbdae", length ${best}`, `Each letter was visited once by R, and L only ever moved forward, so the work is O(n). The last-seen map is what lets L jump straight past a repeat instead of creeping one step at a time.`, [['Answer', best], ['Window', '"cbdae"'], ['Time', 'O(n)'], ['Key trick', 'jump L past the repeat']])
    out.push(R.done())
  }

  /* ================================================================ 3. Merge intervals */
  {
    const input = [[8, 10], [1, 3], [15, 18], [2, 6]]
    const sorted = input.slice().sort((a, b) => a[0] - b[0])
    const R = lesson({
      id: 'merge-intervals', name: 'INTERVALS', title: 'Merge Intervals', full: 'Sort, then sweep once',
      description: `Combine every set of overlapping ranges into one range. After sorting by start time, overlapping ranges sit next to each other, so a single left-to-right sweep can merge each one into the last merged range, or start a new one.`,
      facts: [['Pattern', 'Sort by start, then sweep'], ['Time', 'O(n log n)'], ['Space', 'O(n) for the output'], ['Edge case', 'Touching ranges like [1,4] and [4,5] merge']],
      legend: [['blue', 'Compare with last'], ['violet', 'Append'], ['amber', 'Extend']],
      code: {
        fn: 'merge', kind: 'fn', compare: 'exact',
        statement: `Given an array of ranges <code>intervals</code> where each range is <code>[start, end]</code>, merge all ranges that overlap (sharing even one point counts) and return the merged ranges sorted by start.`,
        examples: [['intervals = [[8,10],[1,3],[15,18],[2,6]]', '[[1,6],[8,10],[15,18]]'], ['intervals = [[1,4],[4,5]]', '[[1,5]]']],
        starter: `function merge(intervals) {\n  // Return the merged intervals, sorted by start\n\n}\n`,
        solution: `function merge(intervals) {\n  const sorted = intervals.slice().sort((a, b) => a[0] - b[0])\n  const out = []\n  for (const [s, e] of sorted) {\n    const last = out[out.length - 1]\n    if (last && s <= last[1]) last[1] = Math.max(last[1], e)\n    else out.push([s, e])\n  }\n  return out\n}\n`,
        tests: [
          { args: [[[8, 10], [1, 3], [15, 18], [2, 6]]], expected: [[1, 6], [8, 10], [15, 18]], sample: true },
          { args: [[[1, 4], [4, 5]]], expected: [[1, 5]], sample: true },
          { args: [[[1, 4], [2, 3]]], expected: [[1, 4]], name: 'one inside another' },
          { args: [[[5, 7]]], expected: [[5, 7]], name: 'single range' },
          { args: [[[6, 8], [1, 9], [2, 4], [4, 7]]], expected: [[1, 9]] },
          { args: [[[1, 2], [3, 4], [5, 6]]], expected: [[1, 2], [3, 4], [5, 6]], name: 'no overlaps' },
        ],
      },
    })
    const fmt = (iv) => `${iv[0]}–${iv[1]}`
    const inCells = R.array('in', input.map(fmt), 150, 200, 92, (i) => `input[${i}]`)
    const sCells = R.array('s', sorted.map(fmt), 150, 380, 92, (i) => `sorted[${i}]`, { hidden: true })
    R.box('merged', 'merged', 700, 300, 4, 180)
    R.step('Sort First', 'Overlaps end up side by side', `Unsorted, an overlapping pair can be far apart (1–3 and 2–6 here). Sorting by start time puts every range right after the ones it could overlap with.`, [['Input', input.map(fmt).join(', ')], ['Sort key', 'start'], ['Cost', 'O(n log n)']])
    R.say(`We have four time ranges, in no particular order. Ranges that overlap should become one.`)
    R.say(`First we sort them by their start time, so any overlapping ranges end up next to each other.`)
    R.show(sCells)
    R.mark(inCells, 'dim')
    const merged = []
    sorted.forEach(([a, b], i) => {
      if (i === 0) R.step('Sweep', 'Compare each range with the last merged one', `Walking the sorted list, each range either overlaps the last merged range (its start is at or before that range's end), so we extend it, or it doesn't, so it starts a new merged range.`, [['Rule', 'start ≤ last end → overlap'], ['Merged so far', '0']])
      if (i === 2) R.step('No Overlap', 'Start a new merged range', `8–10 starts after 6, where the last merged range ends, so nothing overlaps. It becomes a new merged range, and so does 15–18.`, [['Last end', merged[merged.length - 1][1]], ['Next start', a]])
      R.ptr('cur', sCells[i])
      R.mark(sCells[i], 'active')
      const last = merged[merged.length - 1]
      if (!last) {
        R.say(`The first range, ${a}–${b}, has nothing to merge with yet, so it goes straight into the result.`)
        merged.push([a, b])
        R.op([sCells[i], 'merged'], 'violet', fmt([a, b]), 'APPEND', `first range ${fmt([a, b])}`)
      } else {
        R.op([sCells[i], 'merged'], 'blue', `${a} ≤ ${last[1]}?`, 'COMPARE', `does ${fmt([a, b])} overlap ${fmt(last)}?`)
        if (a <= last[1]) {
          const ne = Math.max(last[1], b)
          R.say(`${a}–${b} starts at ${a}, before ${fmt(last)} ends at ${last[1]}. They overlap, so the merged range stretches to ${last[0]}–${ne}.`)
          last[1] = ne
          R.op([sCells[i], 'merged'], 'amber', `→${ne}`, 'EXTEND', `extend to ${fmt(last)}`)
        } else {
          R.say(`${a}–${b} starts after ${last[1]}, so there's a gap. It starts a new merged range.`)
          merged.push([a, b])
          R.op([sCells[i], 'merged'], 'violet', fmt([a, b]), 'APPEND', `new range ${fmt([a, b])}`)
        }
      }
      R.rows('merged', merged.map(fmt), merged.length - 1)
      R.mark(sCells[i], 'done')
    })
    R.say(`The sweep is done: ${merged.map(fmt).join(', ')}.`)
    R.outro('Ranges merged', merged.map(fmt).join(', '), `Sorting did the heavy lifting: once ranges are ordered by start, only the most recent merged range can ever overlap the next one, so a single pass is enough.`, [['Answer', merged.map((m) => `[${m}]`).join(' ')], ['Time', 'O(n log n)'], ['Pass', 'one sweep after sorting']])
    out.push(R.done())
  }

  /* ================================================================ 4. Meeting rooms */
  {
    const mtgs = [['A', 0, 30], ['B', 5, 10], ['C', 15, 20], ['D', 25, 35]]
    const R = lesson({
      id: 'meeting-rooms', name: 'MIN-HEAP', title: 'Meeting Rooms', full: 'Fewest rooms for overlapping meetings',
      description: `How many rooms do you need so no two overlapping meetings share one? Go through meetings by start time and keep a min-heap of the end times of rooms in use. If the room that frees up earliest is free by the time a meeting starts, reuse it; otherwise open a new room.`,
      facts: [['Pattern', 'Sort + min-heap of end times'], ['Time', 'O(n log n)'], ['Space', 'O(n)'], ['Answer', 'largest heap size']],
      legend: [['blue', 'Check earliest end'], ['violet', 'Open a room'], ['amber', 'Reuse a room']],
      code: {
        fn: 'minMeetingRooms', kind: 'fn', compare: 'exact',
        statement: `Given meetings as <code>[start, end]</code> pairs, return the minimum number of rooms needed so that meetings in the same room never overlap. A meeting ending at time t and another starting at time t can share a room.`,
        examples: [['meetings = [[0,30],[5,10],[15,20],[25,35]]', '2'], ['meetings = [[7,10],[2,4]]', '1']],
        starter: `function minMeetingRooms(meetings) {\n  // Return the minimum number of rooms\n\n}\n`,
        solution: `function minMeetingRooms(meetings) {\n  // Sweep start and end times separately\n  const starts = meetings.map((m) => m[0]).sort((a, b) => a - b)\n  const ends = meetings.map((m) => m[1]).sort((a, b) => a - b)\n  let rooms = 0, best = 0, j = 0\n  for (let i = 0; i < starts.length; i++) {\n    while (j < ends.length && ends[j] <= starts[i]) { j++; rooms-- }\n    rooms++\n    best = Math.max(best, rooms)\n  }\n  return best\n}\n`,
        tests: [
          { args: [[[0, 30], [5, 10], [15, 20], [25, 35]]], expected: 2, sample: true },
          { args: [[[7, 10], [2, 4]]], expected: 1, sample: true },
          { args: [[[1, 5], [5, 10]]], expected: 1, name: 'back to back' },
          { args: [[[1, 10], [2, 9], [3, 8]]], expected: 3, name: 'all overlap' },
          { args: [[]], expected: 0, name: 'no meetings' },
          { gen: 'roomsBig', name: '60,000 meetings' },
        ],
      },
    })
    const cells = R.array('m', mtgs.map((m) => `${m[1]}–${m[2]}`), 150, 280, 104, (i) => `meeting ${mtgs[i][0]}`)
    R.box('heap', 'rooms: end times (min first)', 360, 500, 4, 260)
    R.node('rooms', 'vnode', 0, 'rooms', 700, 500)
    R.step('Sort by Start', 'Handle meetings in time order', `Meetings are taken in order of start time. For each one, the only room that matters is the one that frees up earliest, which a min-heap of end times gives us instantly.`, [['Meetings', '4, sorted by start'], ['Heap', 'end times of rooms in use']])
    R.say(`Four meetings, already in order of start time. How few rooms can we get away with?`)
    R.say(`We'll keep a min-heap holding the end time of every room in use, so the earliest-free room is always on top.`)
    const heap = []
    let best = 0
    mtgs.forEach(([nm, s, e], i) => {
      R.step(`Meeting ${nm}: ${s}–${e}`, i === 0 ? 'The first meeting opens a room' : heap[0] <= s ? 'A room is free again' : 'Every room is busy', i === 0 ? `There are no rooms yet, so meeting ${nm} opens the first one. The heap now holds its end time, ${e}.` : heap[0] <= s ? `The earliest room frees up at ${heap[0]}, at or before ${nm} starts at ${s}. We reuse it: pop ${heap[0]}, push ${e}.` : `The earliest room frees up at ${heap[0]}, but ${nm} starts at ${s}. Every room is still busy, so we need a new room.`, [['Starts', s], ['Earliest free', heap.length ? heap[0] : '—'], ['Rooms open', heap.length]])
      R.ptr('next', cells[i])
      R.mark(cells[i], 'active')
      if (heap.length) R.op([cells[i], 'heap'], 'blue', `${heap[0]} ≤ ${s}?`, 'PEEK', `earliest end ${heap[0]} vs start ${s}`)
      if (heap.length && heap[0] <= s) {
        const freed = heap.shift()
        R.say(`The top room frees up at ${freed}, by the time meeting ${nm} starts at ${s}. We hand that room to ${nm}.`)
        heap.push(e); heap.sort((a, b) => a - b)
        R.op(['heap', cells[i]], 'amber', `reuse`, 'POP+PUSH', `pop ${freed}, push ${e}`)
      } else {
        R.say(heap.length ? `The earliest room frees at ${heap[0]}, after ${nm} starts at ${s}. Every room is busy, so we open a new one.` : `No rooms exist yet, so meeting ${nm} opens one that is busy until ${e}.`)
        heap.push(e); heap.sort((a, b) => a - b)
        R.op([cells[i], 'heap'], 'violet', `+${e}`, 'PUSH', `open room until ${e}`)
      }
      R.rows('heap', heap, heap.indexOf(e))
      if (heap.length > best) { best = heap.length; R.val('rooms', best); R.note('rooms', `${best} ROOM${best > 1 ? 'S' : ''}`, 'green') }
      R.mark(cells[i], 'done')
    })
    R.outro('Rooms counted', `${best} rooms are enough`, `The heap never held more than ${best} end times, so ${best} rooms cover every meeting. Reusing the earliest-free room is always safe, because any later-free room would work for fewer future meetings.`, [['Answer', best], ['Time', 'O(n log n)'], ['Idea', 'reuse the earliest-free room']])
    out.push(R.done())
  }

  /* ================================================================ 5. Integer square root */
  {
    const x = 30, hiStart = 15
    const R = lesson({
      id: 'sqrt-binary-search', name: 'BINARY SEARCH', title: 'Integer Square Root', full: 'Binary search on the answer',
      description: `Find the largest integer whose square is at most x, without a square-root function. The candidates 1…x/2 are in order and "m² ≤ x" is true up to the answer and false after it, so binary search halves the range every step.`,
      facts: [['Pattern', 'Binary search on the answer'], ['Time', 'O(log x)'], ['Space', 'O(1)'], ['Watch out', 'm × m can overflow in other languages']],
      legend: [['blue', 'Compare m² with x'], ['green', 'Candidate answer']],
      code: {
        fn: 'mySqrt', kind: 'fn', compare: 'exact',
        statement: `Given a non-negative integer <code>x</code>, return the square root of x rounded down to the nearest integer, without using <code>Math.sqrt</code>, <code>Math.pow</code> or <code>**</code>.`,
        examples: [['x = 30', '5'], ['x = 16', '4']],
        starter: `function mySqrt(x) {\n  // Largest integer r with r * r <= x\n\n}\n`,
        solution: `function mySqrt(x) {\n  let lo = 0, hi = x, ans = 0\n  while (lo <= hi) {\n    const mid = Math.floor((lo + hi) / 2)\n    if (mid * mid <= x) { ans = mid; lo = mid + 1 }\n    else hi = mid - 1\n  }\n  return ans\n}\n`,
        banned: ['Math.sqrt', 'Math.pow', '**'],
        tests: [
          { args: [30], expected: 5, sample: true },
          { args: [16], expected: 4, sample: true },
          { args: [0], expected: 0, name: 'zero' },
          { args: [1], expected: 1, name: 'one' },
          { args: [2147395599], expected: 46339, name: 'large' },
          { args: [2147483647], expected: 46340, name: 'largest 32-bit' },
        ],
      },
    })
    const vals = Array.from({ length: hiStart }, (_, i) => i + 1)
    const cells = R.array('v', vals, 70, 280, 58, null)
    R.node('ans', 'vnode', '–', 'answer', 520, 480)
    const id = (v) => cells[v - 1]
    let lo = 1, hi = hiStart, ans = 0, round = 0
    R.step('Search Space', `Candidates 1 to ${hiStart}`, `The answer for x = ${x} is somewhere in 1…${hiStart} (no number above x/2 squares to at most x, once x ≥ 4). The test "m² ≤ ${x}" is true for small m and false for big m, so we can binary search for the switch point.`, [['x', x], ['Range', `1 … ${hiStart}`], ['Steps needed', `about log₂ ${hiStart} ≈ 4`]])
    R.say(`We want the largest whole number whose square is at most ${x}. The candidates are 1 through ${hiStart}.`)
    R.say(`Small numbers pass the test "m squared is at most ${x}", big ones fail it. Binary search finds where passing turns into failing.`)
    R.ptr('lo', id(lo), 'teal'); R.ptr('hi', id(hi), 'teal')
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      round++
      const ok = mid * mid <= x
      R.step(`Round ${round}: mid = ${mid}`, ok ? `${mid}² = ${mid * mid} fits` : `${mid}² = ${mid * mid} is too big`, ok ? `${mid}² = ${mid * mid} ≤ ${x}, so ${mid} is a valid answer, but a larger one might be too. Everything below ${mid} is ruled out: lo moves to ${mid + 1}.` : `${mid}² = ${mid * mid} > ${x}, so ${mid} and everything above it is too big. hi moves to ${mid - 1}.`, [['lo … hi', `${lo} … ${hi}`], ['mid²', `${mid * mid}`], ['Best so far', ok ? mid : ans || '—']])
      R.ptr('mid', id(mid))
      R.mark(id(mid), 'active')
      R.op([id(mid), 'ans'], 'blue', `${mid}²=${mid * mid}`, 'TEST', `${mid}² = ${mid * mid} ${ok ? '≤' : '>'} ${x}`)
      if (ok) {
        ans = mid
        R.say(`The middle of ${lo}…${hi} is ${mid}. ${mid} squared is ${mid * mid}, which fits under ${x}. So ${mid} works; now look for something bigger.`)
        R.val('ans', ans)
        R.mark(cells.filter((_, i) => i + 1 >= lo && i + 1 < mid), 'dim')
        R.mark(id(mid), 'found')
        lo = mid + 1
        if (lo <= hi) R.ptr('lo', id(lo), 'teal')
      } else {
        R.say(`The middle of ${lo}…${hi} is ${mid}. ${mid} squared is ${mid * mid}, more than ${x}. So ${mid} and everything above it is out.`)
        R.mark(cells.filter((_, i) => i + 1 >= mid && i + 1 <= hi), 'dim')
        hi = mid - 1
        if (hi >= lo) R.ptr('hi', id(hi), 'teal')
      }
    }
    R.say(`lo has passed hi, so the range is empty. The last value that fit was ${ans}.`)
    R.note('ans', `√${x} → ${ans}`, 'green')
    R.outro('Square root found', `⌊√${x}⌋ = ${ans}`, `Four rounds instead of up to fifteen guesses. Binary search works whenever a yes/no test flips exactly once across a sorted range of candidates, not just for searching arrays.`, [['Answer', ans], ['Rounds', round], ['Time', 'O(log x)']])
    out.push(R.done())
  }

  /* ================================================================ 6. Queue from two stacks */
  {
    const R = lesson({
      id: 'queue-two-stacks', name: 'STACKS', title: 'Queue from Two Stacks', full: 'First-in-first-out from two last-in-first-out stacks',
      description: `Build a queue (first in, first out) using only stacks (last in, first out). New items go on an "in" stack. To dequeue, take from an "out" stack; only when it's empty, pour everything from "in" into "out", which reverses the order so the oldest item ends up on top.`,
      facts: [['Pattern', 'Two stacks, lazy transfer'], ['Push', 'O(1)'], ['Pop', 'O(1) amortized'], ['Why it works', 'Reversing twice restores order']],
      legend: [['violet', 'Push'], ['amber', 'Transfer'], ['green', 'Dequeue']],
      code: {
        fn: 'MyQueue', kind: 'class', compare: 'exact',
        statement: `Implement a first-in-first-out queue class <code>MyQueue</code> using only arrays used as stacks (only <code>push</code>, <code>pop</code>, reading the last element and <code>length</code>). Methods: <code>push(x)</code>, <code>pop()</code> returns and removes the front item, <code>peek()</code> returns the front item, <code>empty()</code> returns true if the queue is empty. Tests call methods in sequence and compare each return value (null for methods that return nothing).`,
        examples: [['push 1, push 2, pop, peek, empty', 'null, null, 1, 2, false']],
        starter: `class MyQueue {\n  constructor() {\n\n  }\n  push(x) {\n\n  }\n  pop() {\n\n  }\n  peek() {\n\n  }\n  empty() {\n\n  }\n}\n`,
        solution: `class MyQueue {\n  constructor() { this.inS = []; this.outS = [] }\n  push(x) { this.inS.push(x) }\n  move() { if (!this.outS.length) while (this.inS.length) this.outS.push(this.inS.pop()) }\n  pop() { this.move(); return this.outS.pop() }\n  peek() { this.move(); return this.outS[this.outS.length - 1] }\n  empty() { return !this.inS.length && !this.outS.length }\n}\n`,
        banned: ['.shift(', '.unshift(', '.splice('],
        tests: [
          { ops: [['MyQueue'], ['push', 1], ['push', 2], ['pop'], ['peek'], ['empty']], expected: [null, null, null, 1, 2, false], sample: true },
          { ops: [['MyQueue'], ['push', 1], ['push', 2], ['push', 3], ['pop'], ['push', 4], ['pop'], ['peek'], ['empty'], ['pop'], ['pop'], ['empty']], expected: [null, null, null, null, 1, null, 2, 3, false, 3, 4, true] },
          { ops: [['MyQueue'], ['empty'], ['push', 9], ['peek'], ['pop'], ['empty']], expected: [null, true, null, 9, 9, true], name: 'starts empty' },
          { gen: 'queueBig', name: '200,000 operations' },
        ],
      },
    })
    R.node('you', 'vnode', 'Q', 'caller', 150, 320)
    R.box('in', 'in-stack  (top first)', 470, 200, 4, 200)
    R.box('out', 'out-stack  (top first)', 470, 450, 4, 200)
    R.box('got', 'dequeued', 800, 320, 4, 160)
    const inS = [], outS = [], got = []
    const top = (a) => a.slice().reverse()
    const push = (x) => { inS.push(x); R.op(['you', 'in'], 'violet', `push ${x}`, 'PUSH', `in.push(${x})`); R.rows('in', top(inS), 0) }
    const transfer = () => {
      while (inS.length) {
        const x = inS.pop(); outS.push(x)
        R.op(['in', 'out'], 'amber', `${x}`, 'MOVE', `out.push(in.pop()) → ${x}`)
        R.rows('in', top(inS)); R.rows('out', top(outS), 0)
      }
    }
    const pop = () => {
      const x = outS.pop(); got.push(x)
      R.op(['out', 'got'], 'green', `${x}`, 'POP', `dequeue → ${x}`)
      R.rows('out', top(outS)); R.rows('got', got, got.length - 1)
      return x
    }
    R.step('Push Three Items', 'Everything goes on the in-stack', `Enqueueing is just a push onto the in-stack. Item 1 is at the bottom, 3 at the top, the opposite of the order a queue should hand them out.`, [['Push cost', 'O(1)'], ['in', '[3, 2, 1] top first']])
    R.say(`We push 1, 2 and 3. Each simply goes on top of the in-stack.`)
    push(1); push(2); push(3)
    R.say(`But a stack hands out the newest item first, and a queue must hand out the oldest: 1.`)
    R.step('First Dequeue', 'Pour in into out, then pop', `The out-stack is empty, so we pour the whole in-stack into it. Popping reverses the order, so 1 lands on top of the out-stack, exactly where a queue needs it.`, [['Transfer', '3 moves'], ['Then', 'pop 1']])
    R.say(`To dequeue, we look at the out-stack. It's empty, so we pour every item from the in-stack into it, one pop and push at a time.`)
    transfer()
    R.say(`Pouring reversed the order: now 1, the oldest item, is on top of the out-stack. We pop it.`)
    pop()
    R.step('Mixing Pushes and Pops', 'No transfer while out has items', `New pushes go to the in-stack as usual. Dequeues keep popping from the out-stack and only refill it when it runs empty, so each item is moved at most once.`, [['out', 'still holds 2, 3'], ['Amortized pop', 'O(1)']])
    R.say(`Now we push 4. It goes on the in-stack, behind the others.`)
    push(4)
    R.say(`The next dequeue pops straight from the out-stack: 2. No pouring needed, because out isn't empty.`)
    pop()
    R.say(`And again: 3. The out-stack is now empty.`)
    pop()
    R.step('Refill Only When Empty', 'Lazy transfer keeps order', `For the last dequeue the out-stack is empty again, so we pour the in-stack (just 4) over. Items come out as 1, 2, 3, 4: first in, first out.`, [['Dequeued', '1, 2, 3, 4'], ['Moves per item', 'at most 1']])
    R.say(`The out-stack ran dry, so we pour again. Only 4 is waiting.`)
    transfer()
    pop()
    R.say(`The items came out 1, 2, 3, 4, the exact order they went in.`)
    R.outro('Queue behaviour from stacks', 'Out came 1, 2, 3, 4', `Every item is pushed once onto in, moved at most once to out, and popped once, so a long run of operations costs O(1) each on average, even though a single dequeue may move many items.`, [['Push', 'O(1)'], ['Pop', 'O(1) amortized'], ['Space', 'O(n)']])
    out.push(R.done())
  }

  /* ================================================================ 7. Validate a BST */
  {
    const R = lesson({
      id: 'validate-bst', name: 'TREES', title: 'Validate a BST', full: 'Pass value bounds down the tree',
      description: `Check whether a binary tree is a valid binary search tree: everything in a node's left subtree is smaller than it and everything in its right subtree is larger. Comparing a node only with its parent isn't enough; each node must fit between bounds inherited from all its ancestors.`,
      facts: [['Pattern', 'DFS with (low, high) bounds'], ['Time', 'O(n)'], ['Space', 'O(height)'], ['Trap', 'Parent-only checks miss deeper violations']],
      legend: [['blue', 'Check bounds'], ['green', 'Fits'], ['red', 'Violates']],
      code: {
        fn: 'isValidBST', kind: 'fn', compare: 'exact', argTypes: ['tree'],
        statement: `Given the root of a binary tree (nodes are <code>{ val, left, right }</code>; empty children are <code>null</code>), return <code>true</code> if it's a valid binary search tree: for every node, all values in its left subtree are strictly smaller and all values in its right subtree are strictly larger. Tests describe trees in level order, e.g. <code>[8,4,12,2,9]</code>; they're converted to node objects for you.`,
        examples: [['root = [8,4,12,2,9]', 'false  (9 is in 8’s left subtree)'], ['root = [2,1,3]', 'true']],
        starter: `// node: { val, left, right }\nfunction isValidBST(root) {\n\n}\n`,
        solution: `function isValidBST(root) {\n  const ok = (n, lo, hi) => {\n    if (!n) return true\n    if (n.val <= lo || n.val >= hi) return false\n    return ok(n.left, lo, n.val) && ok(n.right, n.val, hi)\n  }\n  return ok(root, -Infinity, Infinity)\n}\n`,
        tests: [
          { args: [[8, 4, 12, 2, 9]], expected: false, sample: true },
          { args: [[2, 1, 3]], expected: true, sample: true },
          { args: [[5, 1, 4, null, null, 3, 6]], expected: false },
          { args: [[1]], expected: true, name: 'single node' },
          { args: [[2, 2, 2]], expected: false, name: 'duplicates' },
          { args: [[10, 5, 15, null, null, 6, 20]], expected: false, name: 'deep right-side violation' },
          { args: [[3, 1, 5, 0, 2, 4, 6]], expected: true },
        ],
      },
    })
    const T = { 8: [500, 130], 4: [330, 270], 12: [670, 270], 2: [240, 410], 9: [420, 410] }
    for (const v in T) R.node('t' + v, 'vnode', v, '', T[v][0], T[v][1])
    for (const [a, b] of [[8, 4], [8, 12], [4, 2], [4, 9]]) R.link('t' + a, 't' + b)
    R.box('bounds', 'checks  node: (low, high)', 760, 470, 5, 240)
    const tree = { v: 8, l: { v: 4, l: { v: 2 }, r: { v: 9 } }, r: { v: 12 } }
    const fmtB = (x) => (x === -Infinity ? '-∞' : x === Infinity ? '∞' : x)
    const log = []
    R.step('The Trap', 'Looks fine node by node', `Every parent-child pair here looks right: 2 < 4, 9 > 4, 4 < 8, 12 > 8. But 9 sits in 8's left subtree, where everything must be smaller than 8. To catch that, each node carries the range it must fall in.`, [['Local checks', 'all pass'], ['Real rule', 'whole subtree, not just parent']])
    R.say(`Every parent and child here look fine on their own: 2 is less than 4, and 9 is more than 4.`)
    R.say(`But a search tree demands more: everything under 8's left side must be smaller than 8. So each node gets a range it must fall within.`)
    let failed = false
    const visit = (n, lo, hi, parent) => {
      if (!n || failed) return
      const id = 't' + n.v
      R.step(`Visit ${n.v}`, `Must be inside (${fmtB(lo)}, ${fmtB(hi)})`, n.v > lo && n.v < hi ? `${n.v} is strictly between ${fmtB(lo)} and ${fmtB(hi)}. Its left child must stay below ${n.v}, its right child above ${n.v}, and both keep the outer bound.` : `${n.v} must be below ${fmtB(hi)} because of an ancestor, but it isn't. The tree is not a valid search tree, and we can stop right here.`, [['Node', n.v], ['Allowed', `(${fmtB(lo)}, ${fmtB(hi)})`], ['Result', n.v > lo && n.v < hi ? 'fits' : 'violation']])
      if (parent) R.edge(parent, id, 'teal')
      R.mark(id, 'active')
      R.op([id, 'bounds'], 'blue', `${fmtB(lo)}<${n.v}<${fmtB(hi)}?`, 'CHECK', `${n.v} in (${fmtB(lo)}, ${fmtB(hi)})?`)
      log.push(`${n.v}: (${fmtB(lo)}, ${fmtB(hi)})`)
      if (!(n.v > lo && n.v < hi)) {
        R.say(`${n.v} has to be below ${fmtB(hi)}, because it's in ${fmtB(hi)}'s left subtree. It isn't. This tree breaks the rule.`)
        R.rows('bounds', log.concat(['✗ violation']), log.length - 1)
        R.mark(id, 'bad'); R.note(id, `${n.v} ≥ ${fmtB(hi)}`, 'red')
        failed = true
        return
      }
      R.say(`${n.v} must sit between ${fmtB(lo)} and ${fmtB(hi)}. It does. Its left side must now stay under ${n.v}, its right side above ${n.v}.`)
      R.rows('bounds', log, log.length - 1)
      R.mark(id, 'done')
      visit(n.l, lo, n.v, id)
      visit(n.r, n.v, hi, id)
    }
    visit(tree, -Infinity, Infinity, null)
    R.outro('Not a valid BST', '9 breaks the bound set by 8', `A parent-only check would have said "valid". Passing (low, high) down the tree checks every node against all of its ancestors in one O(n) traversal, and it can stop at the first violation.`, [['Answer', 'false'], ['Caught at', 'node 9'], ['Time', 'O(n)']])
    out.push(R.done())
  }

  /* ================================================================ 8. Number of islands */
  {
    const G = [[1, 1, 0, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 1, 0], [1, 0, 0, 0, 0]]
    const R = lesson({
      id: 'islands', name: 'GRID BFS', title: 'Number of Islands', full: 'Flood fill with breadth-first search',
      description: `Count groups of land cells connected up, down, left or right. Scan the grid; each time you meet land you haven't visited, that's a new island, and a breadth-first search from it marks the whole island so it's never counted again.`,
      facts: [['Pattern', 'Scan + BFS flood fill'], ['Time', 'O(rows × cols)'], ['Space', 'O(rows × cols) worst case'], ['Note', 'Diagonals do not connect']],
      legend: [['violet', 'Enqueue'], ['amber', 'Visit'], ['green', 'Island found']],
      code: {
        fn: 'numIslands', kind: 'fn', compare: 'exact',
        statement: `Given a grid of <code>1</code>s (land) and <code>0</code>s (water), return the number of islands. An island is a group of land cells connected horizontally or vertically (not diagonally). Your function may modify the grid.`,
        examples: [['grid = [[1,1,0,0,0],[1,0,0,1,1],[0,0,0,1,0],[1,0,0,0,0]]', '3'], ['grid = [[1,0],[0,1]]', '2']],
        starter: `function numIslands(grid) {\n  // grid[r][c] is 1 for land, 0 for water\n\n}\n`,
        solution: `function numIslands(grid) {\n  const R = grid.length, C = R ? grid[0].length : 0\n  let count = 0\n  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {\n    if (grid[r][c] !== 1) continue\n    count++\n    const q = [[r, c]]; grid[r][c] = 2\n    for (let h = 0; h < q.length; h++) {\n      const [y, x] = q[h]\n      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {\n        const ny = y + dy, nx = x + dx\n        if (ny >= 0 && ny < R && nx >= 0 && nx < C && grid[ny][nx] === 1) { grid[ny][nx] = 2; q.push([ny, nx]) }\n      }\n    }\n  }\n  return count\n}\n`,
        tests: [
          { args: [[[1, 1, 0, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 1, 0], [1, 0, 0, 0, 0]]], expected: 3, sample: true },
          { args: [[[1, 0], [0, 1]]], expected: 2, sample: true },
          { args: [[[0, 0], [0, 0]]], expected: 0, name: 'all water' },
          { args: [[[1]]], expected: 1, name: 'single cell' },
          { args: [[[1, 1, 1], [0, 1, 0], [1, 1, 1]]], expected: 1, name: 'one winding island' },
          { gen: 'islandsChecker', name: '200×200 checkerboard' },
          { gen: 'islandsSolid', name: '150×150 all land (deep recursion breaks)' },
        ],
      },
    })
    const id = (r, c) => `g${r}_${c}`
    G.forEach((row, r) => row.forEach((v, c) => R.node(id(r, c), 'cell', v, '', 160 + c * 64, 120 + r * 84)))
    R.box('q', 'BFS queue', 700, 230, 5, 170)
    R.node('count', 'vnode', 0, 'islands', 700, 430)
    R.step('Scan the Grid', 'Water is skipped', `We look at cells row by row. Water (0) is ignored. The first land cell we haven't visited yet must belong to an island we haven't counted.`, [['Grid', '4 × 5'], ['Land cells', 7], ['Islands', 'unknown']])
    R.say(`A 4 by 5 map: 1 is land, 0 is water. Land touching up, down, left or right is the same island.`)
    R.mark(G.flatMap((row, r) => row.map((v, c) => (v ? null : id(r, c))).filter(Boolean)), 'dim')
    R.say(`We fade the water and scan row by row, looking for land we haven't visited yet.`)
    const seen = G.map((row) => row.map(() => false))
    let count = 0
    const letters = 'ABC'
    for (let r = 0; r < G.length; r++) for (let c = 0; c < G[0].length; c++) {
      if (!G[r][c] || seen[r][c]) continue
      const L = letters[count]
      count++
      R.step(`Island ${L}`, `New land at row ${r}, column ${c}`, `Unvisited land at (${r}, ${c}) means a new island. Breadth-first search from it visits every connected land cell, labelling each one ${L}, so the scan will skip them later.`, [['Start', `(${r}, ${c})`], ['Islands so far', count]])
      R.ptr('scan', id(r, c))
      R.say(`The scan finds land at row ${r}, column ${c} that nobody has visited. That's island ${L}. We count it and start a flood fill.`)
      R.val('count', count)
      const q = [[r, c]]; seen[r][c] = true
      R.op([id(r, c), 'q'], 'violet', `(${r},${c})`, 'ENQUEUE', `start BFS at (${r},${c})`)
      R.rows('q', q.map(([y, x]) => `(${y},${x})`), 0)
      let size = 0
      while (q.length) {
        const [y, x] = q.shift()
        size++
        R.op(['q', id(y, x)], 'amber', `visit`, 'VISIT', `(${y},${x}) → island ${L}`)
        R.val(id(y, x), L); R.mark(id(y, x), 'found')
        const added = []
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = y + dy, nx = x + dx
          if (ny >= 0 && ny < G.length && nx >= 0 && nx < G[0].length && G[ny][nx] && !seen[ny][nx]) {
            seen[ny][nx] = true; q.push([ny, nx]); added.push(`(${ny},${nx})`)
            R.op([id(y, x), 'q'], 'violet', `(${ny},${nx})`, 'ENQUEUE', `neighbour (${ny},${nx}) is land`)
          }
        }
        R.say(added.length ? `From (${y},${x}) the land neighbours ${added.join(' and ')} join the queue.` : `(${y},${x}) has no new land neighbours.`)
        R.rows('q', q.map(([a, b]) => `(${a},${b})`), q.length - 1)
      }
      R.say(`The queue is empty: island ${L} has ${size} cell${size > 1 ? 's' : ''}, all labelled.`)
      R.note('count', `${count} ISLAND${count > 1 ? 'S' : ''}`, 'green')
    }
    R.ptr('scan', null)
    R.say(`The scan reached the last cell. Every land cell belongs to island A, B or C.`)
    R.outro('Islands counted', `${count} islands`, `Each cell was looked at by the scan once and by a flood fill at most once, so the work is proportional to the grid size. Using a queue (BFS) instead of recursion also avoids blowing the call stack on huge islands.`, [['Answer', count], ['Time', 'O(rows × cols)'], ['Why BFS', 'no deep recursion']])
    out.push(R.done())
  }

  /* ================================================================ 9. Dijkstra */
  {
    const P = { A: [140, 300], B: [420, 160], C: [420, 440], D: [700, 300], E: [940, 300] }
    const E = [['A', 'B', 4], ['A', 'C', 1], ['C', 'B', 2], ['B', 'D', 1], ['C', 'D', 5], ['D', 'E', 3]]
    const R = lesson({
      id: 'dijkstra', name: 'SHORTEST PATH', title: "Dijkstra's Algorithm", full: 'Shortest paths with a priority queue',
      description: `Find the cheapest route from one node to every other in a graph with non-negative edge weights. Always settle the closest unsettled node next (a priority queue gives it to you), then try to improve its neighbours' distances through it.`,
      facts: [['Pattern', 'Greedy + min-priority queue'], ['Time', 'O((V + E) log V)'], ['Needs', 'non-negative weights'], ['Key step', 'relax: dist[v] = min(dist[v], dist[u] + w)']],
      legend: [['blue', 'Relax edge'], ['amber', 'Settle node'], ['green', 'Shortest path']],
      code: {
        fn: 'shortestDistances', kind: 'fn', compare: 'exact',
        statement: `There are <code>n</code> nodes numbered 0 to n − 1 and undirected weighted edges <code>[u, v, w]</code> with w ≥ 0. Return an array where element i is the length of the shortest path from <code>src</code> to node i, or <code>-1</code> if node i can't be reached.`,
        examples: [['n = 5, edges = [[0,1,4],[0,2,1],[2,1,2],[1,3,1],[2,3,5],[3,4,3]], src = 0', '[0,3,1,4,7]']],
        starter: `function shortestDistances(n, edges, src) {\n  // edges: [u, v, w] (undirected), return distances (-1 if unreachable)\n\n}\n`,
        solution: `function shortestDistances(n, edges, src) {\n  const adj = Array.from({ length: n }, () => [])\n  for (const [u, v, w] of edges) { adj[u].push([v, w]); adj[v].push([u, w]) }\n  const dist = Array(n).fill(Infinity); dist[src] = 0\n  // binary min-heap of [d, node]\n  const h = [[0, src]]\n  const up = (i) => { while (i) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p } }\n  const down = (i) => { for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m } }\n  while (h.length) {\n    const top = h[0], last = h.pop(); if (h.length) { h[0] = last; down(0) }\n    const [d, u] = top\n    if (d > dist[u]) continue\n    for (const [v, w] of adj[u]) if (d + w < dist[v]) { dist[v] = d + w; h.push([dist[v], v]); up(h.length - 1) }\n  }\n  return dist.map((d) => (d === Infinity ? -1 : d))\n}\n`,
        tests: [
          { args: [5, [[0, 1, 4], [0, 2, 1], [2, 1, 2], [1, 3, 1], [2, 3, 5], [3, 4, 3]], 0], expected: [0, 3, 1, 4, 7], sample: true },
          { args: [3, [[0, 1, 5]], 0], expected: [0, 5, -1], sample: true, name: 'unreachable node' },
          { args: [1, [], 0], expected: [0], name: 'single node' },
          { args: [2, [[0, 1, 9], [0, 1, 2]], 0], expected: [0, 2], name: 'parallel edges' },
          { args: [4, [[0, 1, 1], [1, 2, 1], [2, 3, 1], [0, 3, 10]], 3], expected: [3, 2, 1, 0], name: 'different source' },
          { gen: 'dijkstraBig', name: '20,000-node chain' },
        ],
      },
    })
    for (const k in P) R.node(k, 'vnode', k === 'A' ? 0 : '∞', k, P[k][0], P[k][1])
    for (const [a, b, w] of E) R.link(a, b, { label: w })
    R.box('pq', 'priority queue  (dist, node)', 700, 560, 4, 250)
    const adj = {}; for (const k in P) adj[k] = []
    for (const [a, b, w] of E) { adj[a].push([b, w]); adj[b].push([a, w]) }
    const dist = { A: 0, B: Infinity, C: Infinity, D: Infinity, E: Infinity }
    const prev = {}, done = new Set()
    let pq = [[0, 'A']]
    const pqRows = () => pq.slice().sort((x, y) => x[0] - y[0]).map(([d, k]) => `${d}  ${k}`)
    R.step('Start at A', 'Everything else is unknown', `A is 0 away from itself; every other node starts at infinity. The priority queue holds (distance, node) pairs and always gives back the smallest distance first.`, [['dist', 'A=0, others ∞'], ['Queue', '(0, A)']])
    R.say(`We want the cheapest route from A to every other node. The numbers on the lines are the costs.`)
    R.say(`A starts at distance 0, everyone else at infinity. The queue starts with just A.`)
    R.rows('pq', pqRows(), 0)
    while (pq.length) {
      pq.sort((x, y) => x[0] - y[0])
      const [d, u] = pq.shift()
      if (done.has(u) || d > dist[u]) { continue }
      done.add(u)
      const improvements = adj[u].filter(([v, w]) => !done.has(v) && d + w < dist[v])
      R.step(`Settle ${u} (${d})`, improvements.length ? `Relax ${improvements.map(([v]) => v).join(', ')}` : 'Nothing left to improve', `${u} has the smallest tentative distance, ${d}. With non-negative weights no other route can beat it, so it's final. Then each neighbour gets a chance at a shorter route through ${u}.`, [['Settled', [...done].join(', ')], ['dist', Object.entries(dist).map(([k, v]) => `${k}=${v === Infinity ? '∞' : v}`).join(' ')]])
      R.op(['pq', u], 'amber', `pop ${u}`, 'SETTLE', `${u} is final at ${d}`)
      R.mark(u, 'done')
      if (prev[u]) R.edge(prev[u], u, 'teal')
      R.say(`The queue hands us ${u} at distance ${d}, the closest node not yet settled. Its distance is now final.`)
      for (const [v, w] of adj[u]) {
        if (done.has(v)) continue
        const nd = d + w
        R.op([u, v], 'blue', `${d}+${w}=${nd}`, 'RELAX', `${u}→${v}: ${nd} vs ${dist[v] === Infinity ? '∞' : dist[v]}`)
        if (nd < dist[v]) {
          R.say(`Going through ${u} reaches ${v} for ${d} plus ${w}, which is ${nd}. That beats ${dist[v] === Infinity ? 'infinity' : dist[v]}, so ${v}'s distance drops to ${nd}.`)
          dist[v] = nd; prev[v] = u
          pq.push([nd, v])
          R.val(v, nd); R.mark(v, 'visited')
        } else {
          R.say(`Through ${u}, ${v} would cost ${nd}, no better than the ${dist[v]} we already have.`)
        }
      }
      R.rows('pq', pqRows(), 0)
    }
    const path = []; for (let k = 'E'; k; k = prev[k]) path.unshift(k)
    for (let i = 0; i < path.length - 1; i++) R.edge(path[i], path[i + 1], 'green')
    R.mark(path, 'found')
    R.say(`Every node is settled. The cheapest way to E costs ${dist.E}: ${path.join(' → ')}.`)
    R.outro('All distances final', `A→E costs ${dist.E} via ${path.join('→')}`, `Settling the closest node first is safe because weights are never negative: any other route to it would have to pass through a farther node first. The direct edge A–B (cost 4) lost to A–C–B (cost 3).`, [['dist', Object.entries(dist).map(([k, v]) => `${k}=${v}`).join(' ')], ['Path to E', path.join(' → ')], ['Time', 'O((V+E) log V)']])
    out.push(R.done())
  }

  /* ================================================================ 10. Trie autocomplete */
  {
    const R = lesson({
      id: 'trie', name: 'TRIE', title: 'Autocomplete with a Trie', full: 'Prefix tree for fast prefix search',
      description: `A trie stores words character by character along shared paths, so all words with the same prefix share the same branch. Finding every word that starts with a prefix means walking down the prefix once, then collecting the words below that node.`,
      facts: [['Pattern', 'Trie (prefix tree)'], ['Insert / lookup', 'O(length of word)'], ['Prefix search', 'O(prefix + matches)'], ['Used for', 'autocomplete, spell check']],
      legend: [['violet', 'Insert'], ['blue', 'Walk prefix'], ['green', 'Collect match']],
      code: {
        fn: 'Trie', kind: 'class', compare: 'exact',
        statement: `Implement a class <code>Trie</code> with <code>insert(word)</code>, <code>search(word)</code> (true if the exact word was inserted), <code>startsWith(prefix)</code> (true if any inserted word starts with prefix) and <code>complete(prefix)</code>, which returns every inserted word starting with prefix, sorted alphabetically. Tests call methods in sequence and compare each return value (null for methods that return nothing).`,
        examples: [['insert car, cart, cat; complete("ca")', '["car","cart","cat"]']],
        starter: `class Trie {\n  constructor() {\n\n  }\n  insert(word) {\n\n  }\n  search(word) {\n\n  }\n  startsWith(prefix) {\n\n  }\n  complete(prefix) {\n    // all inserted words starting with prefix, sorted\n\n  }\n}\n`,
        solution: `class Trie {\n  constructor() { this.root = { kids: {}, end: false } }\n  walk(s) { let n = this.root; for (const ch of s) { n = n.kids[ch]; if (!n) return null } return n }\n  insert(word) { let n = this.root; for (const ch of word) n = n.kids[ch] ||= { kids: {}, end: false }; n.end = true }\n  search(word) { const n = this.walk(word); return !!(n && n.end) }\n  startsWith(prefix) { return !!this.walk(prefix) }\n  complete(prefix) {\n    const out = [], start = this.walk(prefix)\n    const dfs = (n, s) => { if (n.end) out.push(s); for (const ch of Object.keys(n.kids).sort()) dfs(n.kids[ch], s + ch) }\n    if (start) dfs(start, prefix)\n    return out\n  }\n}\n`,
        tests: [
          { ops: [['Trie'], ['insert', 'car'], ['insert', 'cart'], ['insert', 'cat'], ['complete', 'ca']], expected: [null, null, null, null, ['car', 'cart', 'cat']], sample: true },
          { ops: [['Trie'], ['insert', 'car'], ['insert', 'cart'], ['insert', 'cat'], ['insert', 'dog'], ['search', 'car'], ['search', 'ca'], ['startsWith', 'ca'], ['complete', 'do'], ['complete', 'x']], expected: [null, null, null, null, null, true, false, true, ['dog'], []] },
          { ops: [['Trie'], ['insert', 'b'], ['insert', 'a'], ['complete', ''], ['search', 'a'], ['startsWith', 'c']], expected: [null, null, null, ['a', 'b'], true, false], name: 'empty prefix' },
          { ops: [['Trie'], ['insert', 'app'], ['insert', 'apple'], ['search', 'app'], ['search', 'appl'], ['complete', 'appl']], expected: [null, null, null, true, false, ['apple']], name: 'word inside a word' },
        ],
      },
    })
    const N = { root: ['·', 520, 100], c: ['c', 380, 210], ca: ['a', 380, 320], car: ['r', 290, 430], cart: ['t', 290, 540], cat: ['t', 470, 430], d: ['d', 660, 210], do: ['o', 660, 320], dog: ['g', 660, 430] }
    for (const k in N) R.node('n_' + k, 'vnode', N[k][0], k === 'root' ? 'root' : '', N[k][1], N[k][2], k === 'root' ? {} : { hidden: true })
    const par = { c: 'root', ca: 'c', car: 'ca', cart: 'car', cat: 'ca', d: 'root', do: 'd', dog: 'do' }
    for (const k in par) R.link('n_' + par[k], 'n_' + k)
    R.box('res', 'complete("ca")', 860, 300, 4, 180)
    const made = new Set(['root'])
    const insert = (w) => {
      let path = 'root'
      for (let i = 1; i <= w.length; i++) {
        const k = w.slice(0, i)
        if (!made.has(k)) { made.add(k); R.show('n_' + k); R.op(['n_' + path, 'n_' + k], 'violet', w[i - 1], 'NEW', `add "${w[i - 1]}" under "${path === 'root' ? '' : path}"`) }
        else R.op(['n_' + path, 'n_' + k], 'blue', w[i - 1], 'SHARE', `"${k}" already exists, reuse it`)
        path = k
      }
      R.badge('n_' + w, 'END', 'green')
    }
    R.step('Insert "car"', 'One node per letter', `Each letter becomes a node along a path from the root. The last node gets an END marker, meaning a whole word stops here.`, [['Word', 'car'], ['New nodes', 3]])
    R.say(`A trie stores words letter by letter. We start by inserting "car": c, then a, then r.`)
    insert('car')
    R.say(`The END marker on r says a complete word ends here.`)
    R.step('Share Prefixes', '"cart" and "cat" reuse c-a', `"cart" walks the existing c-a-r path and only adds t. "cat" reuses c-a and branches off with its own t. Shared prefixes are stored once.`, [['Words', 'car, cart, cat'], ['Nodes added', 2]])
    R.say(`Now "cart". The path c, a, r already exists, so we just walk it and add t at the end.`)
    insert('cart')
    R.say(`Then "cat". It shares c and a, and branches off with a new t.`)
    insert('cat')
    R.step('Insert "dog"', 'A new branch from the root', `"dog" shares nothing with the c-words, so it starts its own branch under the root.`, [['Words', 4], ['Branches at root', 'c, d']])
    R.say(`"dog" shares no prefix with the others, so it starts a new branch right under the root.`)
    insert('dog')
    R.step('Complete "ca"', 'Walk the prefix, then collect', `For autocomplete we walk c then a, two steps no matter how many words exist. Everything below that node starts with "ca", so a depth-first walk collects car, cart and cat in alphabetical order.`, [['Prefix', 'ca'], ['Walk', '2 steps'], ['Matches', 3]])
    R.say(`Someone types "ca". We walk from the root to c, then to a.`)
    R.mark('n_root', 'visited'); R.op(['n_root', 'n_c'], 'blue', 'c', 'WALK', 'follow "c"'); R.mark('n_c', 'visited')
    R.op(['n_c', 'n_ca'], 'blue', 'a', 'WALK', 'follow "a"'); R.mark('n_ca', 'active')
    R.say(`Every word below this node starts with "ca". We collect them with a depth-first walk, in letter order.`)
    const found = []
    for (const [k, w] of [['car', 'car'], ['cart', 'cart'], ['cat', 'cat']]) {
      R.mark('n_' + k, 'found')
      found.push(w)
      R.op(['n_' + k, 'res'], 'green', w, 'MATCH', `END at "${w}" → collect`)
      R.rows('res', found, found.length - 1)
    }
    R.say(`Three suggestions: car, cart and cat. The d branch was never touched.`)
    R.outro('Suggestions ready', 'car, cart, cat', `The work depended only on the prefix length and the number of matches, not on how many words the trie holds. That's why tries power autocomplete.`, [['Matches', 'car, cart, cat'], ['Walk', '2 nodes'], ['Untouched', 'the whole d-branch']])
    out.push(R.done())
  }

  /* ================================================================ 11. LRU cache */
  {
    const R = lesson({
      id: 'lru-cache', name: 'LRU CACHE', title: 'LRU Cache', full: 'Hash map + recency order, O(1) per operation',
      description: `A fixed-size cache that, when full, evicts the least recently used entry. A hash map finds entries in O(1); a doubly linked list keeps them in recency order so moving an entry to the front, or dropping the oldest from the back, is also O(1).`,
      facts: [['Pattern', 'Hash map + doubly linked list'], ['get / put', 'O(1)'], ['Evicts', 'least recently used'], ['In JS', 'a Map keeps insertion order too']],
      legend: [['blue', 'Get'], ['violet', 'Put'], ['red', 'Evict / miss'], ['green', 'Hit']],
      code: {
        fn: 'LRUCache', kind: 'class', compare: 'exact',
        statement: `Implement <code>LRUCache</code>: <code>new LRUCache(capacity)</code>, <code>get(key)</code> returns the value or <code>-1</code> if missing, <code>put(key, value)</code> inserts or updates. Both count as a "use". When a put would exceed capacity, first remove the least recently used key. Both operations should run in O(1) on average. Tests call methods in sequence and compare each return value (null for methods that return nothing).`,
        examples: [['cap 2: put(1,10) put(2,20) get(1) put(3,30) get(2)', 'null null null 10 null -1']],
        starter: `class LRUCache {\n  constructor(capacity) {\n\n  }\n  get(key) {\n\n  }\n  put(key, value) {\n\n  }\n}\n`,
        solution: `class LRUCache {\n  constructor(capacity) { this.cap = capacity; this.m = new Map() }\n  get(key) {\n    if (!this.m.has(key)) return -1\n    const v = this.m.get(key)\n    this.m.delete(key); this.m.set(key, v) // move to newest\n    return v\n  }\n  put(key, value) {\n    if (this.m.has(key)) this.m.delete(key)\n    else if (this.m.size === this.cap) this.m.delete(this.m.keys().next().value) // oldest\n    this.m.set(key, value)\n  }\n}\n`,
        tests: [
          { ops: [['LRUCache', 2], ['put', 1, 10], ['put', 2, 20], ['get', 1], ['put', 3, 30], ['get', 2]], expected: [null, null, null, 10, null, -1], sample: true },
          { ops: [['LRUCache', 2], ['put', 1, 10], ['put', 2, 20], ['get', 1], ['put', 3, 30], ['get', 2], ['put', 4, 40], ['get', 1], ['get', 3], ['get', 4]], expected: [null, null, null, 10, null, -1, null, -1, 30, 40] },
          { ops: [['LRUCache', 2], ['put', 1, 1], ['put', 2, 2], ['put', 1, 5], ['put', 3, 3], ['get', 2], ['get', 1]], expected: [null, null, null, null, null, -1, 5], name: 'update counts as use' },
          { ops: [['LRUCache', 1], ['put', 7, 7], ['put', 8, 8], ['get', 7], ['get', 8]], expected: [null, null, null, -1, 8], name: 'capacity 1' },
          { gen: 'lruBig', name: '200,000 operations' },
        ],
      },
    })
    R.node('you', 'vnode', 'C', 'caller', 140, 320)
    R.box('map', 'hash map  key → value', 470, 200, 3, 210)
    R.box('order', 'recency  newest → oldest', 470, 450, 3, 230)
    R.box('log', 'returned', 800, 320, 5, 150)
    const cap = 2
    const m = new Map()
    const ret = []
    const show = (hlKey) => {
      const keys = [...m.keys()].reverse()
      R.rows('map', [...m].map(([k, v]) => `${k} → ${v}`), [...m.keys()].indexOf(hlKey))
      R.rows('order', keys.map((k) => `key ${k}`), keys.indexOf(hlKey))
    }
    const get = (k) => {
      R.op(['you', 'map'], 'blue', `get ${k}`, 'GET', `get(${k})`)
      if (!m.has(k)) {
        R.say(`get(${k}): key ${k} isn't in the map. That's a miss, so we return -1.`)
        R.note('map', 'MISS', 'red'); ret.push(`get ${k} → -1`)
        R.op(['map', 'log'], 'red', '-1', 'MISS', `get(${k}) = -1`)
      } else {
        const v = m.get(k); m.delete(k); m.set(k, v)
        R.say(`get(${k}): found ${v}. Using it makes key ${k} the most recent, so it moves to the front of the order.`)
        R.op(['map', 'order'], 'amber', `${k} → front`, 'TOUCH', `key ${k} becomes newest`)
        show(k); ret.push(`get ${k} → ${v}`)
        R.op(['map', 'log'], 'green', `${v}`, 'HIT', `get(${k}) = ${v}`)
      }
      R.rows('log', ret, ret.length - 1)
    }
    const put = (k, v) => {
      R.op(['you', 'map'], 'violet', `put ${k}=${v}`, 'PUT', `put(${k}, ${v})`)
      if (m.has(k)) m.delete(k)
      else if (m.size === cap) {
        const old = m.keys().next().value
        R.say(`The cache is full, so before adding key ${k} we evict the least recently used: key ${old}, at the back of the order.`)
        R.op(['order', 'map'], 'red', `evict ${old}`, 'EVICT', `drop key ${old}`)
        m.delete(old)
        show(null)
      }
      m.set(k, v)
      show(k)
    }
    R.step('Fill the Cache', 'Two puts, room for two', `With capacity 2, the first two puts just store entries. The map gives O(1) lookup; the order list remembers which entry was used most recently.`, [['Capacity', cap], ['Stored', '1, 2']])
    R.say(`This cache holds only 2 entries. We put key 1 with value 10, then key 2 with value 20.`)
    put(1, 10); put(2, 20)
    R.say(`Key 2 is now the newest, key 1 the oldest.`)
    R.step('A Get Refreshes', 'Key 1 becomes the newest', `Reading key 1 counts as using it, so it moves to the front. Now key 2 is the least recently used.`, [['get(1)', 10], ['Oldest now', 'key 2']])
    get(1)
    R.step('Evict the Oldest', 'Put 3 pushes out key 2', `The cache is full when key 3 arrives. The back of the order list is key 2, untouched the longest, so it's evicted in O(1) and key 3 goes in at the front.`, [['Evicted', 'key 2'], ['Kept', 'keys 3, 1']])
    put(3, 30)
    R.step('Miss, Then Evict Again', 'get(2) misses; put 4 drops key 1', `Key 2 is gone, so get(2) returns -1. Then put(4) finds the cache full again; key 1 is now the oldest and is evicted.`, [['get(2)', -1], ['Evicted', 'key 1']])
    get(2)
    put(4, 40)
    R.step('Hits Keep Order Fresh', 'get(3) moves 3 to the front', `Key 3 is still cached. Reading it returns 30 and makes it the newest again, so key 4 would be the next to go.`, [['get(3)', 30], ['Next to evict', 'key 4']])
    get(3)
    R.outro('Cache behaves as LRU', 'Always evicts the stalest key', `Every get and put did a constant amount of work: one map lookup plus moving one entry in the order list. In JavaScript a Map already remembers insertion order, so deleting and re-inserting a key moves it to the newest end.`, [['get / put', 'O(1)'], ['Evictions', 'key 2, then key 1'], ['Structure', 'hash map + linked list']])
    out.push(R.done())
  }

  /* ================================================================ 12. Top-K frequent */
  {
    const nums = [1, 1, 1, 2, 2, 3, 4, 4, 4, 4], k = 2
    const R = lesson({
      id: 'top-k', name: 'TOP-K', title: 'Top K Frequent Elements', full: 'Count, then keep a heap of size k',
      description: `Return the k values that appear most often. Count every value with a hash map, then push (count, value) pairs into a min-heap that never holds more than k entries; whenever it grows past k, pop the smallest. What's left are the top k.`,
      facts: [['Pattern', 'Hash map count + size-k min-heap'], ['Time', 'O(n log k)'], ['Space', 'O(n)'], ['Alternative', 'bucket sort, O(n)']],
      legend: [['violet', 'Count / push'], ['red', 'Pop smallest'], ['green', 'Result']],
      code: {
        fn: 'topKFrequent', kind: 'fn', compare: 'sorted',
        statement: `Given an integer array <code>nums</code> and an integer <code>k</code>, return the <code>k</code> most frequent values, in any order. The answer is guaranteed to be unique.`,
        examples: [['nums = [1,1,1,2,2,3,4,4,4,4], k = 2', '[4,1]'], ['nums = [7], k = 1', '[7]']],
        starter: `function topKFrequent(nums, k) {\n  // Return the k most frequent values (any order)\n\n}\n`,
        solution: `function topKFrequent(nums, k) {\n  const count = new Map()\n  for (const x of nums) count.set(x, (count.get(x) || 0) + 1)\n  // bucket sort by frequency\n  const buckets = Array.from({ length: nums.length + 1 }, () => [])\n  for (const [x, c] of count) buckets[c].push(x)\n  const out = []\n  for (let c = nums.length; c > 0 && out.length < k; c--) for (const x of buckets[c]) if (out.length < k) out.push(x)\n  return out\n}\n`,
        tests: [
          { args: [[1, 1, 1, 2, 2, 3, 4, 4, 4, 4], 2], expected: [1, 4], sample: true },
          { args: [[7], 1], expected: [7], sample: true },
          { args: [[5, 5, 6, 6, 6, 7], 1], expected: [6] },
          { args: [[-1, -1, 2, 2, 2, 3], 2], expected: [-1, 2], name: 'negative values' },
          { args: [[4, 4, 9, 9, 9, 1, 1, 1, 1], 3], expected: [1, 4, 9], name: 'k equals distinct count' },
          { gen: 'topKBig', name: '200,000 numbers' },
        ],
      },
    })
    const cells = R.array('x', nums, 90, 200, 58)
    R.box('count', 'counts  value → times', 330, 450, 4, 220)
    R.box('heap', `min-heap  (count, value)  size ≤ ${k}`, 720, 450, 3, 260)
    const count = new Map()
    R.step('Count Everything', 'One pass with a hash map', `First we need how often each value appears. One pass over the array, adding 1 to that value's counter in a hash map.`, [['Values', nums.length], ['Distinct', 4]])
    R.say(`We want the ${k} values that show up most often in these ${nums.length} numbers. First, count each one.`)
    const firstIdx = new Map()
    nums.forEach((x, i) => { if (!firstIdx.has(x)) firstIdx.set(x, i); count.set(x, (count.get(x) || 0) + 1) })
    const shown = new Map()
    for (const [x, c] of count) {
      const idxs = nums.map((v, i) => (v === x ? cells[i] : null)).filter(Boolean)
      R.mark(idxs, 'active')
      R.op([idxs[0], 'count'], 'violet', `${x}×${c}`, 'COUNT', `${x} appears ${c} time${c > 1 ? 's' : ''}`)
      shown.set(x, c)
      R.rows('count', [...shown].map(([a, b]) => `${a} → ${b}`), shown.size - 1)
      R.mark(idxs, 'visited')
    }
    R.say(`Counts: 1 appears three times, 2 twice, 3 once and 4 four times.`)
    const heap = []
    const hRows = () => heap.slice().sort((a, b) => a[0] - b[0]).map(([c, x]) => `(${c}, ${x})`)
    let stepN = 0
    for (const [x, c] of count) {
      stepN++
      if (stepN === 1) R.step('Fill the Heap', `Keep at most ${k}`, `Now each (count, value) pair goes into a min-heap. Its smallest count is always on top, so it's easy to throw away the least frequent value when there are too many.`, [['Heap size limit', k]])
      if (stepN === 3) R.step('Too Many: Pop', 'The heap drops the least frequent', `Once a third pair arrives, the heap is over its limit, so it pops the smallest count. Values that can't be in the top ${k} are thrown away as soon as possible.`, [['Popped', 'smallest count each time']])
      heap.push([c, x])
      R.op(['count', 'heap'], 'violet', `(${c},${x})`, 'PUSH', `push (${c}, ${x})`)
      R.rows('heap', hRows(), hRows().indexOf(`(${c}, ${x})`))
      if (heap.length > k) {
        heap.sort((a, b) => a[0] - b[0])
        const [pc, px] = heap.shift()
        R.say(`The heap now holds ${k + 1} pairs, one too many. We pop the smallest count: value ${px}, seen ${pc} time${pc > 1 ? 's' : ''}.`)
        R.op(['heap', 'count'], 'red', `pop (${pc},${px})`, 'POP', `drop value ${px}`)
        R.rows('heap', hRows(), -1)
      } else {
        R.say(`Value ${x}, seen ${c} time${c > 1 ? 's' : ''}, goes into the heap. It has room for ${k}.`)
      }
    }
    const res = heap.map(([, x]) => x)
    nums.forEach((v, i) => R.mark(cells[i], res.includes(v) ? 'found' : 'dim'))
    R.say(`All values are processed. The heap holds the top ${k}: ${res.join(' and ')}.`)
    R.outro('Top 2 found', `${res.join(', ')}`, `Capping the heap at k keeps every push and pop at O(log k), so the whole thing is O(n log k). When counts are bounded by n, bucket sort gets it to O(n).`, [['Answer', `[${res.join(', ')}]`], ['Time', 'O(n log k)'], ['Heap size', `≤ ${k}`]])
    out.push(R.done())
  }

  /* ================================================================ 13. Coin change DP */
  {
    const coins = [1, 3, 4], amount = 6
    const R = lesson({
      id: 'coin-change', name: 'DYNAMIC PROG.', title: 'Coin Change', full: 'Fewest coins, built bottom-up',
      description: `What is the smallest number of coins that adds up to an amount? Always grabbing the biggest coin can fail. Dynamic programming solves every smaller amount first: the best for amount a is 1 + the best of (a − coin) over every coin that fits.`,
      facts: [['Pattern', 'Bottom-up DP'], ['Time', 'O(amount × coins)'], ['Space', 'O(amount)'], ['Greedy fails', '6 = 4+1+1 (3 coins) vs 3+3 (2)']],
      legend: [['blue', 'Try a coin'], ['green', 'Best choice']],
      code: {
        fn: 'coinChange', kind: 'fn', compare: 'exact',
        statement: `Given coin values <code>coins</code> (unlimited supply of each) and an <code>amount</code>, return the fewest coins that add up exactly to amount, or <code>-1</code> if it can't be made.`,
        examples: [['coins = [1,3,4], amount = 6', '2   (3 + 3)'], ['coins = [2], amount = 3', '-1']],
        starter: `function coinChange(coins, amount) {\n  // Fewest coins summing to amount, or -1\n\n}\n`,
        solution: `function coinChange(coins, amount) {\n  const dp = Array(amount + 1).fill(Infinity)\n  dp[0] = 0\n  for (let a = 1; a <= amount; a++)\n    for (const c of coins) if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1\n  return dp[amount] === Infinity ? -1 : dp[amount]\n}\n`,
        tests: [
          { args: [[1, 3, 4], 6], expected: 2, sample: true },
          { args: [[2], 3], expected: -1, sample: true },
          { args: [[1], 0], expected: 0, name: 'amount zero' },
          { args: [[5, 10, 25], 30], expected: 2 },
          { args: [[2, 5, 10, 1], 27], expected: 4 },
          { args: [[3, 7, 405, 436], 8839], expected: 25, name: 'large amount (needs DP)' },
        ],
      },
    })
    R.array('coin', coins, 340, 140, 76, () => 'coin')
    const dpCells = R.array('dp', Array.from({ length: amount + 1 }, (_, i) => (i === 0 ? 0 : '∞')), 120, 340, 76, (i) => `dp[${i}]`)
    R.box('cand', 'candidates', 640, 540, 3, 300)
    const dp = Array(amount + 1).fill(Infinity); dp[0] = 0
    R.step('The Greedy Trap', 'Biggest coin first gives 3 coins', `Taking the biggest coin that fits gives 6 = 4 + 1 + 1, three coins. But 3 + 3 uses only two. Instead of guessing, we'll compute the best answer for every amount from 0 up to 6.`, [['Coins', coins.join(', ')], ['Greedy', '4+1+1 = 3 coins'], ['Best', '3+3 = 2 coins']])
    R.say(`We need to make ${amount} using coins worth 1, 3 and 4, with as few coins as possible.`)
    R.say(`Grabbing the biggest coin first gives 4, 1 and 1: three coins. But 3 and 3 needs only two. Greed fails here.`)
    R.say(`So we build a table: dp of a is the fewest coins for amount a. dp of 0 is 0, since no coins are needed.`)
    R.mark(dpCells[0], 'done')
    for (let a = 1; a <= amount; a++) {
      if (a === 1) R.step('Small Amounts', 'dp[1] to dp[3]', `For each amount, try every coin that fits: using coin c leaves a − c, whose best answer is already in the table. Take the smallest result and add one coin.`, [['Rule', 'dp[a] = 1 + min dp[a − c]']])
      if (a === 4) R.step('Middle Amounts', 'dp[4] and dp[5]', `The same rule keeps filling the table. Each entry only looks back at entries that are already final.`, [['dp so far', dp.slice(0, a).map((v) => (v === Infinity ? '∞' : v)).join(', ')]])
      if (a === 6) R.step('The Answer', 'dp[6] beats greedy', `For 6, using a 3 leaves 3, which needs one coin, so 2 coins total. That beats using a 4 (leaving 2, which needs two coins).`, [['dp[6]', 2], ['Coins', '3 + 3']])
      R.ptr('a', dpCells[a])
      R.mark(dpCells[a], 'active')
      const cand = []
      let best = Infinity, bestC = null
      for (const c of coins) {
        if (c > a) continue
        const v = dp[a - c] + 1
        cand.push(`coin ${c}: dp[${a - c}]+1 = ${v === Infinity ? '∞' : v}`)
        R.op([dpCells[a - c], dpCells[a]], 'blue', `+${c}`, 'TRY', `coin ${c}: dp[${a - c}] + 1 = ${v}`)
        if (v < best) { best = v; bestC = c }
      }
      dp[a] = best
      R.rows('cand', cand, cand.findIndex((r) => r.startsWith(`coin ${bestC}:`)))
      R.say(`For ${a}: ${cand.map((s) => s.replace('dp[', 'the best for ').replace(']+1', ' plus one')).join('; ')}. The best is ${best}, using a ${bestC}.`)
      R.val(dpCells[a], best)
      R.mark(dpCells[a], 'done')
    }
    R.mark(dpCells[amount], 'found')
    R.note(dpCells[amount], `${dp[amount]} COINS`, 'green')
    R.outro('Fewest coins: 2', '6 = 3 + 3', `Every amount was solved once, from small to large, by looking back at answers already known. That turns an exponential search over coin combinations into amount × coins simple steps.`, [['Answer', dp[amount]], ['Table', dp.join(', ')], ['Time', 'O(amount × coins)']])
    out.push(R.done())
  }

  /* ---------------- Python versions of each problem (Python is the default language) ---------------- */
  const PY = {
    'two-sum': {
      fn: 'two_sum',
      starter: `def two_sum(nums, target):\n    # Return [i, j] with nums[i] + nums[j] == target\n    pass\n`,
      solution: `def two_sum(nums, target):\n    seen = {}  # value -> index\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n    return []\n`,
    },
    'longest-substring': {
      fn: 'length_of_longest_substring',
      starter: `def length_of_longest_substring(s):\n    # Length of the longest substring with all-distinct characters\n    pass\n`,
      solution: `def length_of_longest_substring(s):\n    last = {}  # char -> last index\n    left = best = 0\n    for right, c in enumerate(s):\n        if last.get(c, -1) >= left:\n            left = last[c] + 1\n        last[c] = right\n        best = max(best, right - left + 1)\n    return best\n`,
    },
    'merge-intervals': {
      fn: 'merge',
      starter: `def merge(intervals):\n    # Return the merged intervals, sorted by start\n    pass\n`,
      solution: `def merge(intervals):\n    out = []\n    for s, e in sorted(intervals):\n        if out and s <= out[-1][1]:\n            out[-1][1] = max(out[-1][1], e)\n        else:\n            out.append([s, e])\n    return out\n`,
    },
    'meeting-rooms': {
      fn: 'min_meeting_rooms',
      starter: `import heapq\n\ndef min_meeting_rooms(meetings):\n    # Return the minimum number of rooms\n    pass\n`,
      solution: `import heapq\n\ndef min_meeting_rooms(meetings):\n    ends = []  # min-heap of end times of rooms in use\n    for s, e in sorted(meetings):\n        if ends and ends[0] <= s:\n            heapq.heapreplace(ends, e)  # reuse the earliest-free room\n        else:\n            heapq.heappush(ends, e)  # open a new room\n    return len(ends)\n`,
    },
    'sqrt-binary-search': {
      fn: 'my_sqrt',
      statement: `Given a non-negative integer <code>x</code>, return the square root of x rounded down to the nearest integer, without using <code>math.sqrt</code>, <code>math.isqrt</code>, <code>pow</code> or <code>**</code>.`,
      banned: ['math.sqrt', 'isqrt', '**', 'pow('],
      starter: `def my_sqrt(x):\n    # Largest integer r with r * r <= x\n    pass\n`,
      solution: `def my_sqrt(x):\n    lo, hi, ans = 0, x, 0\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if mid * mid <= x:\n            ans, lo = mid, mid + 1\n        else:\n            hi = mid - 1\n    return ans\n`,
    },
    'queue-two-stacks': {
      fn: 'MyQueue',
      statement: `Implement a first-in-first-out queue class <code>MyQueue</code> using only lists used as stacks (<code>append</code>, <code>pop()</code>, <code>[-1]</code> and <code>len</code>). Methods: <code>push(x)</code>, <code>pop()</code> returns and removes the front item, <code>peek()</code> returns the front item, <code>empty()</code> returns <code>True</code> if the queue is empty. Tests call methods in sequence and compare each return value (<code>None</code> for methods that return nothing).`,
      examples: [['push 1, push 2, pop, peek, empty', 'None, None, 1, 2, False']],
      banned: ['deque', 'pop(0', 'insert(0', 'popleft'],
      starter: `class MyQueue:\n    def __init__(self):\n        pass\n\n    def push(self, x):\n        pass\n\n    def pop(self):\n        pass\n\n    def peek(self):\n        pass\n\n    def empty(self):\n        pass\n`,
      solution: `class MyQueue:\n    def __init__(self):\n        self.ins, self.outs = [], []\n\n    def push(self, x):\n        self.ins.append(x)\n\n    def _move(self):\n        if not self.outs:  # refill only when empty\n            while self.ins:\n                self.outs.append(self.ins.pop())\n\n    def pop(self):\n        self._move()\n        return self.outs.pop()\n\n    def peek(self):\n        self._move()\n        return self.outs[-1]\n\n    def empty(self):\n        return not self.ins and not self.outs\n`,
    },
    'validate-bst': {
      fn: 'is_valid_bst',
      statement: `Given the root of a binary tree (nodes are <code>TreeNode</code> objects with <code>.val</code>, <code>.left</code> and <code>.right</code>; missing children are <code>None</code>), return <code>True</code> if it's a valid binary search tree: for every node, all values in its left subtree are strictly smaller and all values in its right subtree are strictly larger. Tests describe trees in level order, e.g. <code>[8,4,12,2,9]</code>; they're converted to <code>TreeNode</code> objects for you.`,
      examples: [['root = [8,4,12,2,9]', 'False  (9 is in 8’s left subtree)'], ['root = [2,1,3]', 'True']],
      starter: `# class TreeNode: val, left, right (already defined for you)\n\ndef is_valid_bst(root):\n    pass\n`,
      solution: `def is_valid_bst(root):\n    def ok(node, lo, hi):\n        if not node:\n            return True\n        if not (lo < node.val < hi):\n            return False\n        return ok(node.left, lo, node.val) and ok(node.right, node.val, hi)\n    return ok(root, float('-inf'), float('inf'))\n`,
    },
    'islands': {
      fn: 'num_islands',
      starter: `from collections import deque\n\ndef num_islands(grid):\n    # grid[r][c] is 1 for land, 0 for water\n    pass\n`,
      solution: `from collections import deque\n\ndef num_islands(grid):\n    rows, cols = len(grid), len(grid[0]) if grid else 0\n    count = 0\n    for r in range(rows):\n        for c in range(cols):\n            if grid[r][c] != 1:\n                continue\n            count += 1\n            grid[r][c] = 2  # mark visited\n            q = deque([(r, c)])\n            while q:\n                y, x = q.popleft()\n                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):\n                    if 0 <= ny < rows and 0 <= nx < cols and grid[ny][nx] == 1:\n                        grid[ny][nx] = 2\n                        q.append((ny, nx))\n    return count\n`,
    },
    'dijkstra': {
      fn: 'shortest_distances',
      starter: `import heapq\n\ndef shortest_distances(n, edges, src):\n    # edges: [u, v, w] (undirected); return distances, -1 if unreachable\n    pass\n`,
      solution: `import heapq\n\ndef shortest_distances(n, edges, src):\n    adj = [[] for _ in range(n)]\n    for u, v, w in edges:\n        adj[u].append((v, w))\n        adj[v].append((u, w))\n    dist = [float('inf')] * n\n    dist[src] = 0\n    pq = [(0, src)]\n    while pq:\n        d, u = heapq.heappop(pq)\n        if d > dist[u]:\n            continue  # stale entry\n        for v, w in adj[u]:\n            if d + w < dist[v]:\n                dist[v] = d + w\n                heapq.heappush(pq, (dist[v], v))\n    return [d if d != float('inf') else -1 for d in dist]\n`,
    },
    'trie': {
      fn: 'Trie',
      rename: { startsWith: 'starts_with' },
      statement: `Implement a class <code>Trie</code> with <code>insert(word)</code>, <code>search(word)</code> (<code>True</code> if the exact word was inserted), <code>starts_with(prefix)</code> (<code>True</code> if any inserted word starts with prefix) and <code>complete(prefix)</code>, which returns every inserted word starting with prefix, sorted alphabetically. Tests call methods in sequence and compare each return value (<code>None</code> for methods that return nothing).`,
      starter: `class Trie:\n    def __init__(self):\n        pass\n\n    def insert(self, word):\n        pass\n\n    def search(self, word):\n        pass\n\n    def starts_with(self, prefix):\n        pass\n\n    def complete(self, prefix):\n        # all inserted words starting with prefix, sorted\n        pass\n`,
      solution: `class Trie:\n    def __init__(self):\n        self.root = {}\n\n    def insert(self, word):\n        node = self.root\n        for ch in word:\n            node = node.setdefault(ch, {})\n        node['$'] = True  # end of a word\n\n    def _walk(self, s):\n        node = self.root\n        for ch in s:\n            if ch not in node:\n                return None\n            node = node[ch]\n        return node\n\n    def search(self, word):\n        node = self._walk(word)\n        return node is not None and '$' in node\n\n    def starts_with(self, prefix):\n        return self._walk(prefix) is not None\n\n    def complete(self, prefix):\n        out = []\n        def dfs(node, s):\n            if '$' in node:\n                out.append(s)\n            for ch in sorted(k for k in node if k != '$'):\n                dfs(node[ch], s + ch)\n        node = self._walk(prefix)\n        if node is not None:\n            dfs(node, prefix)\n        return out\n`,
    },
    'lru-cache': {
      fn: 'LRUCache',
      statement: `Implement <code>LRUCache</code>: <code>LRUCache(capacity)</code>, <code>get(key)</code> returns the value or <code>-1</code> if missing, <code>put(key, value)</code> inserts or updates. Both count as a "use". When a put would exceed capacity, first remove the least recently used key. Both operations should run in O(1) on average. Tests call methods in sequence and compare each return value (<code>None</code> for methods that return nothing).`,
      examples: [['cap 2: put(1,10) put(2,20) get(1) put(3,30) get(2)', 'None None None 10 None -1']],
      starter: `class LRUCache:\n    def __init__(self, capacity):\n        pass\n\n    def get(self, key):\n        pass\n\n    def put(self, key, value):\n        pass\n`,
      solution: `from collections import OrderedDict\n\nclass LRUCache:\n    def __init__(self, capacity):\n        self.cap = capacity\n        self.data = OrderedDict()  # oldest first\n\n    def get(self, key):\n        if key not in self.data:\n            return -1\n        self.data.move_to_end(key)  # now the newest\n        return self.data[key]\n\n    def put(self, key, value):\n        if key in self.data:\n            self.data.move_to_end(key)\n        elif len(self.data) == self.cap:\n            self.data.popitem(last=False)  # evict the oldest\n        self.data[key] = value\n`,
    },
    'top-k': {
      fn: 'top_k_frequent',
      starter: `from collections import Counter\nimport heapq\n\ndef top_k_frequent(nums, k):\n    # Return the k most frequent values (any order)\n    pass\n`,
      solution: `from collections import Counter\nimport heapq\n\ndef top_k_frequent(nums, k):\n    count = Counter(nums)\n    return [x for x, _ in heapq.nlargest(k, count.items(), key=lambda p: p[1])]\n`,
    },
    'coin-change': {
      fn: 'coin_change',
      starter: `def coin_change(coins, amount):\n    # Fewest coins summing to amount, or -1\n    pass\n`,
      solution: `def coin_change(coins, amount):\n    INF = float('inf')\n    dp = [0] + [INF] * amount  # dp[a] = fewest coins for amount a\n    for a in range(1, amount + 1):\n        for c in coins:\n            if c <= a and dp[a - c] + 1 < dp[a]:\n                dp[a] = dp[a - c] + 1\n    return dp[amount] if dp[amount] != INF else -1\n`,
    },
  }
  const GROUP = {
    'two-sum': 'Arrays & hashing', 'longest-substring': 'Arrays & hashing', 'top-k': 'Arrays & hashing',
    'merge-intervals': 'Sorting & intervals', 'meeting-rooms': 'Sorting & intervals',
    'sqrt-binary-search': 'Binary search',
    'queue-two-stacks': 'Stacks, queues & design', 'lru-cache': 'Stacks, queues & design',
    'validate-bst': 'Trees & graphs', 'trie': 'Trees & graphs', 'islands': 'Trees & graphs', 'dijkstra': 'Trees & graphs',
    'coin-change': 'Dynamic programming',
  }
  for (const l of out) { l.code.py = PY[l.id]; l.group = GROUP[l.id] }

  /* ---------------- full interview-style write-ups: examples, constraints, follow-ups ---------------- */
  const FULL = {
    'two-sum': {
      difficulty: 'Easy',
      examples: [
        { in: 'nums = [3,8,4,6,5], target = 10', out: '[2,3]', why: 'nums[2] + nums[3] = 4 + 6 = 10.' },
        { in: 'nums = [3,3], target = 6', out: '[0,1]', why: 'The two 3s are different elements, so both may be used.' },
        { in: 'nums = [-4,1,9,-1], target = 8', out: '[2,3]', why: '9 + (−1) = 8. Values can be negative.' },
      ],
      constraints: ['2 ≤ <code>nums.length</code> ≤ 2 × 10⁵', '−10⁹ ≤ <code>nums[i]</code> ≤ 10⁹', '−10⁹ ≤ <code>target</code> ≤ 10⁹', 'Exactly one valid pair exists.', 'You may not use the same element twice.'],
      followUp: 'The obvious solution checks every pair in O(n²). Can you find the pair in a single pass, in O(n) time?',
    },
    'longest-substring': {
      difficulty: 'Medium',
      examples: [
        { in: 's = "abcbdae"', out: '5', why: 'The longest run with no repeats is "cbdae". "abcbd" doesn\'t count: b appears twice.' },
        { in: 's = "aaaa"', out: '1', why: 'Every substring longer than one character repeats "a".' },
        { in: 's = "abba"', out: '2', why: '"ab" or "ba". A substring must be contiguous, so "aba" style picks are not allowed.' },
      ],
      constraints: ['0 ≤ <code>s.length</code> ≤ 3 × 10⁵', '<code>s</code> may contain English letters, digits, symbols and spaces.'],
      followUp: 'Can you do it in one pass, visiting each character at most twice (O(n))?',
    },
    'merge-intervals': {
      difficulty: 'Medium',
      examples: [
        { in: 'intervals = [[8,10],[1,3],[15,18],[2,6]]', out: '[[1,6],[8,10],[15,18]]', why: '[1,3] and [2,6] overlap, so they become [1,6]. The others don\'t overlap anything.' },
        { in: 'intervals = [[1,4],[4,5]]', out: '[[1,5]]', why: 'Ranges that only touch at one point (4) still count as overlapping.' },
        { in: 'intervals = [[1,4],[2,3]]', out: '[[1,4]]', why: '[2,3] lies entirely inside [1,4].' },
      ],
      constraints: ['1 ≤ <code>intervals.length</code> ≤ 10⁴', '<code>intervals[i].length</code> == 2', '0 ≤ start<sub>i</sub> ≤ end<sub>i</sub> ≤ 10⁴', 'The input is not necessarily sorted.'],
      followUp: 'If the ranges arrive one at a time (a stream), how would you keep the merged list up to date efficiently?',
    },
    'meeting-rooms': {
      difficulty: 'Medium',
      examples: [
        { in: 'meetings = [[0,30],[5,10],[15,20],[25,35]]', out: '2', why: '[0,30] runs the whole time. [5,10], [15,20] and [25,35] never overlap each other, so they can take turns in a second room.' },
        { in: 'meetings = [[7,10],[2,4]]', out: '1', why: 'The meetings don\'t overlap, so one room is enough.' },
        { in: 'meetings = [[1,5],[5,10]]', out: '1', why: 'A meeting ending at 5 frees its room for one starting at 5.' },
      ],
      constraints: ['0 ≤ <code>meetings.length</code> ≤ 6 × 10⁴', '0 ≤ start<sub>i</sub> &lt; end<sub>i</sub> ≤ 10⁶'],
      followUp: 'Instead of just the count, return which room each meeting is assigned to.',
    },
    'sqrt-binary-search': {
      difficulty: 'Easy',
      examples: [
        { in: 'x = 30', out: '5', why: '5² = 25 ≤ 30 but 6² = 36 > 30, so the square root (about 5.48) rounds down to 5.' },
        { in: 'x = 16', out: '4', why: '16 is a perfect square.' },
        { in: 'x = 0', out: '0', why: '' },
      ],
      constraints: ['0 ≤ <code>x</code> ≤ 2³¹ − 1', 'Do not use built-in square-root or power functions or operators.'],
      followUp: 'Binary search takes O(log x) steps. How would Newton\'s method compare, and when does it stop?',
    },
    'queue-two-stacks': {
      difficulty: 'Easy',
      examples: [
        { in: '["MyQueue","push","push","pop","peek","empty"]\n[[],[1],[2],[],[],[]]', out: '[null,null,null,1,2,false]', why: 'push 1, push 2 → the queue is [1,2] (front first). pop returns 1, peek returns 2, and the queue is not empty.' },
      ],
      constraints: ['0 ≤ <code>x</code> ≤ 10⁹', 'At most 2 × 10⁵ calls in total.', 'pop and peek are only called when the queue is not empty.', 'Use only standard stack operations: push to top, pop from top, look at top, size, is-empty.'],
      followUp: 'Show that each operation is O(1) amortized, even though a single pop can be O(n).',
    },
    'validate-bst': {
      difficulty: 'Medium',
      examples: [
        { in: 'root = [8,4,12,2,9]', out: 'false', why: '9 is in the left subtree of 8, so it must be smaller than 8. It isn\'t, even though 9 > 4 looks fine locally.' },
        { in: 'root = [2,1,3]', out: 'true', why: '' },
        { in: 'root = [5,1,4,null,null,3,6]', out: 'false', why: 'The root is 5 but its right child is 4.' },
      ],
      constraints: ['The number of nodes is in the range [1, 10⁴].', '−2³¹ ≤ <code>Node.val</code> ≤ 2³¹ − 1', 'Duplicate values make a tree invalid (strictly smaller / strictly larger).'],
      followUp: 'Can you solve it with an in-order traversal instead? What property must the visited values have?',
    },
    'islands': {
      difficulty: 'Medium',
      examples: [
        { in: 'grid = [\n  [1,1,0,0,0],\n  [1,0,0,1,1],\n  [0,0,0,1,0],\n  [1,0,0,0,0]\n]', out: '3', why: 'One island in the top-left (3 cells), one on the right (3 cells) and a single cell at the bottom-left.' },
        { in: 'grid = [[1,0],[0,1]]', out: '2', why: 'Diagonal neighbours are not connected.' },
      ],
      constraints: ['m == <code>grid.length</code>, n == <code>grid[i].length</code>', '1 ≤ m, n ≤ 200', '<code>grid[i][j]</code> is 0 or 1', 'Islands may be large (a 150 × 150 island exists in the tests), so watch your recursion depth.'],
      followUp: 'If land cells are added one at a time, how would you report the island count after every addition without recounting from scratch?',
    },
    'dijkstra': {
      difficulty: 'Medium',
      examples: [
        { in: 'n = 5, edges = [[0,1,4],[0,2,1],[2,1,2],[1,3,1],[2,3,5],[3,4,3]], src = 0', out: '[0,3,1,4,7]', why: 'Node 1 is cheaper via 0→2→1 (1 + 2 = 3) than directly (4). Node 4 is 0→2→1→3→4 = 7.' },
        { in: 'n = 3, edges = [[0,1,5]], src = 0', out: '[0,5,-1]', why: 'Node 2 has no edges, so it can\'t be reached.' },
      ],
      constraints: ['1 ≤ <code>n</code> ≤ 2 × 10⁴', '0 ≤ <code>edges.length</code> ≤ 2 × 10⁴', '<code>edges[i] = [u, v, w]</code>, 0 ≤ u, v &lt; n', '0 ≤ w ≤ 10⁵ (no negative weights)', 'Edges are undirected; there may be several edges between the same two nodes.'],
      followUp: 'What breaks if some weights are negative, and which algorithm would you use instead?',
    },
    'trie': {
      difficulty: 'Medium',
      examples: [
        { in: '["Trie","insert","insert","insert","complete"]\n[[],["car"],["cart"],["cat"],["ca"]]', out: '[null,null,null,null,["car","cart","cat"]]', why: 'All three words start with "ca"; they are returned in alphabetical order.' },
        { in: '["Trie","insert","search","search","startsWith"]\n[[],["app"],["app"],["ap"],["ap"]]', out: '[null,null,true,false,true]', why: '"ap" is a prefix of an inserted word, but was never inserted itself.' },
      ],
      constraints: ['1 ≤ <code>word.length</code> ≤ 2000', '0 ≤ <code>prefix.length</code> ≤ 2000 (an empty prefix matches every word)', 'Words and prefixes use lowercase English letters.', 'At most 3 × 10⁴ calls in total.'],
      followUp: 'Autocomplete usually returns only the top few suggestions. How would you return the 3 most frequently inserted words for a prefix quickly?',
    },
    'lru-cache': {
      difficulty: 'Medium',
      examples: [
        { in: '["LRUCache","put","put","get","put","get"]\n[[2],[1,10],[2,20],[1],[3,30],[2]]', out: '[null,null,null,10,null,-1]', why: 'get(1) makes key 1 the most recent, so when key 3 arrives the cache (capacity 2) evicts key 2. get(2) then misses.' },
      ],
      constraints: ['1 ≤ <code>capacity</code> ≤ 3000', '0 ≤ <code>key</code> ≤ 10⁵', '0 ≤ <code>value</code> ≤ 10⁶', 'At most 2 × 10⁵ calls to get and put.', 'get and put must each run in O(1) average time.'],
      followUp: 'How would you change it into an LFU cache (evict the least frequently used key)?',
    },
    'top-k': {
      difficulty: 'Medium',
      examples: [
        { in: 'nums = [1,1,1,2,2,3,4,4,4,4], k = 2', out: '[4,1]', why: '4 appears four times and 1 three times. Any order is accepted.' },
        { in: 'nums = [7], k = 1', out: '[7]', why: '' },
      ],
      constraints: ['1 ≤ <code>nums.length</code> ≤ 2 × 10⁵', '−10⁴ ≤ <code>nums[i]</code> ≤ 10⁴', '1 ≤ <code>k</code> ≤ number of distinct values', 'The answer is unique.'],
      followUp: 'Your algorithm\'s time must be better than O(n log n). Can you get O(n)?',
    },
    'coin-change': {
      difficulty: 'Medium',
      examples: [
        { in: 'coins = [1,3,4], amount = 6', out: '2', why: '6 = 3 + 3. Taking the biggest coin first gives 4 + 1 + 1, which is 3 coins.' },
        { in: 'coins = [2], amount = 3', out: '-1', why: 'Only even amounts can be made.' },
        { in: 'coins = [1], amount = 0', out: '0', why: 'No coins are needed to make 0.' },
      ],
      constraints: ['1 ≤ <code>coins.length</code> ≤ 12', '1 ≤ <code>coins[i]</code> ≤ 2³¹ − 1', '0 ≤ <code>amount</code> ≤ 10⁴', 'You have an unlimited supply of each coin.'],
      followUp: 'Instead of the fewest coins, count how many different combinations make the amount.',
    },
  }
  for (const l of out) Object.assign(l.code, FULL[l.id])

  // big tests are generated on demand (expected answers derived by construction, not by running a solution)
  const GENS = {
    twoSumBig() { const n = 200000; return { args: [Array.from({ length: n }, (_, i) => i * 2), (n - 2) * 2 + (n - 1) * 2], expected: [n - 2, n - 1] } },
    longStringBig() { const a = 'abcdefghijklmnopqrstuvwxyz'; let s = ''; for (let i = 0; i < 300000; i++) s += a[i % 26]; return { args: [s], expected: 26 } },
    roomsBig() { return { args: [Array.from({ length: 60000 }, (_, i) => [i, i + 3]).reverse()], expected: 3 } },
    queueBig() { const n = 100000, ops = [['MyQueue']], exp = [null]; for (let i = 0; i < n; i++) { ops.push(['push', i]); exp.push(null) } for (let i = 0; i < n; i++) { ops.push(['pop']); exp.push(i) } return { ops, expected: exp } },
    islandsChecker() { const n = 200; return { args: [Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => ((r + c) % 2 ? 0 : 1)))], expected: (n * n) / 2 } },
    islandsSolid() { const n = 150; return { args: [Array.from({ length: n }, () => Array(n).fill(1))], expected: 1 } },
    dijkstraBig() { const n = 20000, e = []; for (let i = 0; i < n - 1; i++) e.push([i, i + 1, 1]); e.push([0, n - 1, 3 * n]); return { args: [n, e, 0], expected: Array.from({ length: n }, (_, i) => i) } },
    lruBig() { const cap = 1000, N = 100000, ops = [['LRUCache', cap]], exp = [null]; for (let i = 0; i < N; i++) { ops.push(['put', i, i * 2]); exp.push(null) } for (let i = N - cap; i < N; i++) { ops.push(['get', i]); exp.push(i * 2) } ops.push(['get', 0]); exp.push(-1); return { ops, expected: exp } },
    topKBig() { const nums = []; for (let v = 1; v <= 631; v++) for (let j = 0; j < v; j++) nums.push(v); for (let i = nums.length - 1; i > 0; i--) { const j = (i * 7919) % (i + 1); [nums[i], nums[j]] = [nums[j], nums[i]] } return { args: [nums, 3], expected: [629, 630, 631] } },
  }
  if (typeof LESSONS !== 'undefined') LESSONS.push(...out)
  if (typeof window !== 'undefined') window.DSA_GENS = GENS
  if (typeof module !== 'undefined') module.exports = { lessons: out, gens: GENS }
})()
