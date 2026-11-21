window.__ModuleLoader__.load({
  id: '@local/sidebar-entry-toggle',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useCallback, useRef, useEffect } = React

    const NS = 'sidebar-entry-toggle'
    const HIDDEN_KEY = 'dsh.sidebar-entry-toggle.hidden.v2'
    const ORDER_KEY = 'dsh.sidebar-entry-toggle.order.v2'
    // v1 keys kept only to migrate old label-based choices to the new id keys.
    const HIDDEN_KEY_V1 = 'dsh.sidebar-entry-toggle.hidden.v1'
    const ORDER_KEY_V1 = 'dsh.sidebar-entry-toggle.order.v1'
    const STYLE_ID = 'dsh-sidebar-entry-toggle-style'

    const DICT = {
      zh: {
        nav: '侧栏入口管理',
        title: '侧栏入口管理',
        desc: '自动列出侧栏中的所有入口，包括新安装的插件。开关控制显示/隐藏；拖动数字调整顺序（数字越小越靠上）。刷新后仍然生效。',
        reset: '全部显示',
        resetOrder: '恢复默认顺序',
        note: '调整只影响显示，不会卸载相关插件。新装插件会自动出现在下方。',
        empty: '暂未发现侧栏入口。',
      },
      en: {
        nav: 'Sidebar entries',
        title: 'Sidebar entries',
        desc: 'Lists every sidebar entry automatically, including newly installed plugins. Toggle visibility; drag the number to reorder (smaller = higher). Persists across reloads.',
        reset: 'Show all',
        resetOrder: 'Reset order',
        note: 'Only display is affected; plugins are not uninstalled. Newly installed plugins appear here automatically.',
        empty: 'No sidebar entries detected yet.',
      },
    }

    // ---- Persistent state (keyed by stable slot id, not by localized label) ----
    function readJSON(key, fallback) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return fallback
        const v = JSON.parse(raw)
        return v && typeof v === 'object' ? v : fallback
      } catch (_) { return fallback }
    }
    function writeJSON(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)) } catch (_) {}
    }

    // One-time migration from v1 (label-based) to v2 (id-based). The v1 keys
    // used Chinese labels; map the ones we knew to their canonical plugin ids
    // so existing user choices are not lost. New plugins simply start default.
    const V1_LABEL_TO_ID = {
      '插件': 'plugins', 'Plugins': 'plugins',
      '插件市场': 'market', 'Plugin Market': 'market', 'Market': 'market',
      'DeepSeek 网页版': 'deepseek', 'DeepSeek Web': 'deepseek',
      '自动化任务': 'schedule', '定时任务': 'schedule', 'Scheduled tasks': 'schedule', 'Automation tasks': 'schedule',
      '智能体': 'agents', 'Agents': 'agents', 'Agent teams': 'agents',
      '技能中心': 'skills', 'Skill Center': 'skills',
      'SSH': 'ssh',
      '更多': 'more', 'More': 'more',
    }
    let migrated = false
    function migrateOnce() {
      if (migrated) return
      migrated = true
      try {
        if (localStorage.getItem(HIDDEN_KEY) === null) {
          const old = readJSON(HIDDEN_KEY_V1, {})
          const next = {}
          for (const k of Object.keys(old)) {
            if (old[k] && V1_LABEL_TO_ID[k]) next[V1_LABEL_TO_ID[k]] = true
          }
          writeJSON(HIDDEN_KEY, next)
        }
        if (localStorage.getItem(ORDER_KEY) === null) {
          const old = readJSON(ORDER_KEY_V1, null)
          if (Array.isArray(old)) writeJSON(ORDER_KEY, old.map(k => V1_LABEL_TO_ID[k] || k).filter(Boolean))
        }
      } catch (_) {}
    }

    function resolveLabel(label, id) {
      if (typeof label === 'string') return label || id
      if (typeof label === 'function') {
        try {
          const v = label()
          if (typeof v === 'string' && v) return v
        } catch (_) {}
      }
      return id
    }

    // ---- Current entry list, discovered from the slot registry ----
    let entries = []   // [{ id, order, label }]
    let hidden = {}
    let order = []
    let applyFn = null // set by apply(); applies hidden/order to the DOM

    function readEntriesFromSlots(ctx) {
      let raw = []
      try {
        if (typeof ctx.slots.entriesOfSlot === 'function') {
          raw = ctx.slots.entriesOfSlot('sidebar.panellist')
        }
      } catch (_) { raw = [] }
      const seen = new Set()
      const result = []
      for (const entry of (raw || [])) {
        const opts = entry && entry.options ? entry.options : entry
        const id = opts && (opts.id || opts.key)
        if (!id || seen.has(id)) continue
        seen.add(id)
        result.push({ id: String(id), order: Number(opts.order) || 0, label: opts.label })
      }
      result.sort((a, b) => a.order - b.order)
      return result
    }

    function syncEntries(ctx) {
      entries = readEntriesFromSlots(ctx)
      // The official "More" launcher is NOT a sidebar.panellist slot entry —
      // it is a hardcoded PanelMoreMenu rendered directly in the nav. Add it as
      // a virtual entry only when it actually exists in the DOM, so it can be
      // hidden / reordered like other rows without a fake switch otherwise.
      let hasMore = false
      try { hasMore = !!document.querySelector('nav[class*="panelList"] button[aria-haspopup="menu"]') } catch (_) {}
      if (hasMore && !entries.some(e => e.id === 'more')) {
        entries.push({ id: 'more', order: 9999, label: function () { return '更多' }, virtual: true })
        entries.sort((a, b) => a.order - b.order)
      }
      const ids = entries.map(e => e.id)
      // Drop stale keys, append new ids, keep saved relative order.
      const validOrder = (order || []).filter(k => ids.includes(k))
      for (const id of ids) if (!validOrder.includes(id)) validOrder.push(id)
      order = validOrder.length ? validOrder : ['plugins', 'market', 'deepseek', 'schedule', 'agents', 'skills', 'ssh', 'more'].filter(k => ids.includes(k))
      if (!order.length) order = ids.slice()
      if (applyFn) applyFn(hidden, order, entries)
      return entries
    }

    // ---- Apply visibility/order to the real DOM rows ----
    // Row selector from DSH SidebarRoot: nav[class*="panelList"] > div[class*="panelEntry"].
    // Rows are rendered in slot order, so the Nth row corresponds to the Nth
    // entry (after the host's own filtering). We read each row button's
    // aria-label to map it back to an id via the entry's resolved label when
    // possible; as a fallback we align by index.
    function applyStyle(hidden, order, entries) {
      let el = document.getElementById(STYLE_ID)
      if (!el) {
        el = document.createElement('style')
        el.id = STYLE_ID
        document.head.appendChild(el)
      }
      const list = entries || []
      const idByLabel = {}
      for (const e of list) {
        const label = resolveLabel(e.label, e.id)
        if (label) idByLabel[label] = e.id
      }
      const rules = []
      for (const e of list) {
        const label = resolveLabel(e.label, e.id)
        const idx = (order || []).indexOf(e.id)
        const val = (idx < 0 ? list.length : idx) + 1
        const isHidden = Boolean(hidden && hidden[e.id])
        if (e.virtual && e.id === 'more') {
          // "More" has no panelEntry wrapper; its flex item is [class*="moreAnchor"].
          rules.push('nav[class*="panelList"] > [class*="moreAnchor"] { order: ' + val + ' !important; ' + (isHidden ? 'display: none !important;' : '') + ' }')
          if (isHidden) rules.push('nav[class*="panelList"] button[aria-haspopup="menu"] { display: none !important; }')
          continue
        }
        // CSS path (works when label matches aria-label)
        const sel = 'nav[class*="panelList"] button[aria-label="' + String(label).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]'
        rules.push('[class*="panelEntry"]:has(' + sel + ') { order: ' + val + ' !important; ' + (isHidden ? 'display: none !important;' : '') + ' }')
        if (isHidden) rules.push(sel + ' { display: none !important; }')
      }
      el.textContent = rules.join('\n')

      // JS fallback: operate on every panelEntry row, matching its button's
      // aria-label to a known entry id; unknown rows get a high order and are
      // left visible (never hide an entry we cannot identify).
      try {
        const rows = document.querySelectorAll('nav[class*="panelList"] [class*="panelEntry"]')
        rows.forEach(function (row) {
          const btn = row.querySelector('button[class*="panelRow"]') || row.querySelector('button[aria-label]')
          const label = btn ? (btn.getAttribute('aria-label') || '') : ''
          const id = idByLabel[label] || null
          if (!id) return // never touch an entry we cannot map
          const idx = (order || []).indexOf(id)
          const val = (idx < 0 ? list.length : idx) + 1
          row.style.setProperty('order', String(val))
          if (hidden && hidden[id]) {
            row.style.setProperty('display', 'none', 'important')
            btn.style.setProperty('display', 'none', 'important')
          } else {
            if (row.style.getPropertyPriority('display') === 'important') row.style.removeProperty('display')
            if (btn.style.getPropertyPriority('display') === 'important') btn.style.removeProperty('display')
          }
        })
        // "More" launcher: no panelEntry wrapper, handle its flex-item wrapper.
        const moreBtn = document.querySelector('nav[class*="panelList"] button[aria-haspopup="menu"]')
        if (moreBtn) {
          const wrapper = moreBtn.closest('[class*="moreAnchor"]') || moreBtn.parentElement
          const mIdx = (order || []).indexOf('more')
          const mVal = (mIdx < 0 ? list.length : mIdx) + 1
          if (wrapper) wrapper.style.setProperty('order', String(mVal))
          if (hidden && hidden.more) {
            if (wrapper) wrapper.style.setProperty('display', 'none', 'important')
            moreBtn.style.setProperty('display', 'none', 'important')
          } else {
            if (wrapper && wrapper.style.getPropertyPriority('display') === 'important') wrapper.style.removeProperty('display')
            if (moreBtn.style.getPropertyPriority('display') === 'important') moreBtn.style.removeProperty('display')
          }
        }
      } catch (_) {}
    }

    function Toggle({ on, onClick, label }) {
      return h('span', {
        role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label,
        onClick: onClick,
        style: {
          display: 'inline-flex', alignItems: 'center', width: 36, height: 20,
          borderRadius: 10, padding: 2, boxSizing: 'border-box', flexShrink: 0,
          cursor: 'pointer',
          background: on ? 'var(--dsw-alias-brand-primary, #c9a227)' : 'var(--dsw-alias-border-l3, #888)',
          transition: 'background .15s',
        },
      },
        h('span', {
          style: {
            width: 16, height: 16, borderRadius: '50%', background: '#fff',
            transform: on ? 'translateX(16px)' : 'translateX(0)',
            transition: 'transform .15s', boxShadow: '0 1px 2px rgba(0,0,0,.25)',
          },
        })
      )
    }

    function EntryToggleSection({ t, getEntries, getHidden, getOrder, onToggle, onReset, onReorder, onResetOrder, refreshTick }) {
      const [, setTick] = useState(0)
      // While dragging a slider, track its value locally so the blue fill
      // follows the pointer in real time. Commit the reorder only on release.
      const [dragging, setDraggingState] = useState(null)
      const draggingRef = useRef(null)
      const setDragging = function (v) { draggingRef.current = v; setDraggingState(v) }
      const latest = useRef({ onToggle, onReset, onReorder, onResetOrder, getEntries, getHidden, getOrder })
      latest.current = { onToggle, onReset, onReorder, onResetOrder, getEntries, getHidden, getOrder }

      // Poll lightly so newly discovered entries show up in the panel too.
      useEffect(function () {
        const id = setInterval(function () { setTick(x => x + 1) }, 2000)
        return function () { clearInterval(id) }
      }, [])

      const toggle = useCallback(function (id) {
        latest.current.onToggle(id)
        setTick(x => x + 1)
      }, [])
      const reorder = useCallback(function (id, targetIndex) {
        latest.current.onReorder(id, targetIndex)
        setTick(x => x + 1)
      }, [])
      const reset = useCallback(function () { latest.current.onReset(); setTick(x => x + 1) }, [])
      const resetOrder = useCallback(function () { latest.current.onResetOrder(); setTick(x => x + 1) }, [])

      // Read the LIVE state on every render (getters, not snapshots), so slider
      // drags and toggles reflect immediately instead of being pulled back by a
      // stale prop snapshot.
      const hiddenNow = (latest.current.getHidden && latest.current.getHidden()) || {}
      const orderNow = (latest.current.getOrder && latest.current.getOrder()) || []
      const discovered = (latest.current.getEntries && latest.current.getEntries()) || []
      // Keep the list in a FIXED discovery order (slot order). The slider's
      // number shows each entry's saved position; dragging changes that number
      // without making the names jump around (matches the original v1 feel).
      const list = discovered.slice()
      return h('div', { style: { padding: '8px 4px', color: 'var(--dsw-alias-label-primary)' } },
        h('h3', { style: { margin: '0 0 4px', fontSize: 16 } }, t('title') + ' · v2'),
        h('p', { style: { margin: '0 0 16px', opacity: 0.75, fontSize: 13, lineHeight: 1.5 } }, t('desc')),
        list.length === 0
          ? h('div', { style: { opacity: 0.7, fontSize: 13 } }, t('empty'))
          : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
            list.map(function (e, index) {
              const name = resolveLabel(e.label, e.id)
              const on = !hiddenNow[e.id]
              const pos = (orderNow.indexOf(e.id) < 0 ? index : orderNow.indexOf(e.id)) + 1
              return h('div', {
                key: e.id,
                style: {
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', border: '1px solid var(--dsh-alias-border-l2, #ddd)',
                  borderRadius: 8, background: 'transparent', fontSize: 14,
                },
              },
                h('span', { style: { width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: name }, name),
                h('input', {
                  type: 'range', min: 1, max: Math.max(list.length, 1), step: 1,
                  value: (dragging && dragging.id === e.id) ? dragging.value : pos,
                  onChange: function (ev) { setDragging({ id: e.id, value: Number(ev.target.value) }) },
                  onPointerUp: function (ev) {
                    const d = draggingRef.current
                    if (d && d.id === e.id) { reorder(e.id, d.value - 1); setDragging(null) }
                  },
                  onKeyUp: function (ev) {
                    const d = draggingRef.current
                    if (d && d.id === e.id) { reorder(e.id, d.value - 1); setDragging(null) }
                  },
                  onBlur: function () { const d = draggingRef.current; if (d && d.id === e.id) setDragging(null) },
                  style: { flex: 1, minWidth: 60, cursor: 'pointer' },
                  'aria-label': '排序 ' + name,
                }),
                h('span', { style: { width: 16, textAlign: 'center', flexShrink: 0, opacity: 0.8 } },
                  String((dragging && dragging.id === e.id) ? dragging.value : pos)),
                h(Toggle, { on: on, label: name, onClick: function () { toggle(e.id) } })
              )
            })
          ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' } },
          h('button', { type: 'button', onClick: reset, style: { padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, border: '1px solid var(--dsw-alias-border-l2, #ddd)', background: 'transparent', color: 'inherit' } }, t('reset')),
          h('button', { type: 'button', onClick: resetOrder, style: { padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, border: '1px solid var(--dsw-alias-border-l2, #ddd)', background: 'transparent', color: 'inherit' } }, t('resetOrder')),
          h('span', { style: { opacity: 0.6, fontSize: 12 } }, t('note'))
        )
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICT), 'sidebar-entry-toggle: dictionaries')
        migrateOnce()
        hidden = readJSON(HIDDEN_KEY, {})
        order = readJSON(ORDER_KEY, [])
        applyFn = applyStyle

        const refresh = function () {
          const prevIds = entries.map(e => e.id).join(',')
          syncEntries(ctx)
          const nowIds = entries.map(e => e.id).join(',')
          if (prevIds !== nowIds && settingsSection) settingsSection.refresh()
        }
        syncEntries(ctx)

        // Subscribe to slot changes (new plugins registering/unregistering)
        // and to locale changes (labels resolved in another language).
        try {
          if (typeof ctx.slots.subscribe === 'function') {
            ctx.effect(() => ctx.slots.subscribe('sidebar.panellist', refresh), 'sidebar-entry-toggle: slot subscription')
          }
        } catch (_) {}
        try {
          if (typeof ctx.locale.subscribe === 'function') {
            ctx.effect(() => ctx.locale.subscribe(refresh), 'sidebar-entry-toggle: locale subscription')
          }
        } catch (_) {}

        // MutationObserver: re-apply styles when the sidebar DOM is rebuilt
        // (sidebar collapse/expand, late plugin mount). Bind to the nav once it
        // exists, otherwise watch body until it appears.
        let mo = null
        function bindObserver() {
          const nav = document.querySelector('nav[class*="panelList"]')
          if (nav && !mo) {
            mo = new MutationObserver(function () {
              if (applyFn) applyFn(hidden, order, entries)
            })
            mo.observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] })
          }
        }
        bindObserver()
        const observerTimer = setInterval(bindObserver, 2000)
        // Re-discover entries periodically so the virtual "More" entry appears
        // even on a cold start where the nav was not rendered at apply() time.
        const reapplyTimer = setInterval(function () { refresh() }, 3000)
        ctx.effect(() => function () {
          if (mo) mo.disconnect()
          clearInterval(observerTimer)
          clearInterval(reapplyTimer)
        }, 'sidebar-entry-toggle: observers')

        const onToggle = function (id, nextHidden) {
          hidden = nextHidden !== undefined ? nextHidden : (function () {
            const n = Object.assign({}, hidden); if (n[id]) delete n[id]; else n[id] = true; return n
          })()
          writeJSON(HIDDEN_KEY, hidden)
          applyStyle(hidden, order, entries)
        }
        const onReorder = function (id, targetIndex) {
          const next = order.slice()
          const from = next.indexOf(id)
          if (from < 0 || targetIndex < 0 || targetIndex >= next.length || from === targetIndex) return
          next.splice(from, 1); next.splice(targetIndex, 0, id)
          order = next
          writeJSON(ORDER_KEY, order)
          applyStyle(hidden, order, entries)
        }
        const onReset = function () { hidden = {}; writeJSON(HIDDEN_KEY, hidden); applyStyle(hidden, order, entries) }
        const onResetOrder = function () { order = entries.map(e => e.id); writeJSON(ORDER_KEY, order); applyStyle(hidden, order, entries) }

        let settingsSection = null
        ctx.slots.inject('settings.section', () => {
          const reg = ctx.slots.register({
            name: 'settings.section',
            id: 'sidebar-entry-toggle',
            order: 90,
            label: function () { return ctx.locale.bind(NS)('nav') },
            locale: NS,
            inject: function () {
              return {
                t: ctx.locale.bind(NS),
                getEntries: function () { return entries },
                getHidden: function () { return hidden },
                getOrder: function () { return order },
                onToggle: onToggle,
                onReset: onReset,
                onReorder: onReorder,
                onResetOrder: onResetOrder,
              }
            },
          }, function (props) {
            // Bridge: pass current hidden/order as props and re-render on refresh.
            const [state, setState] = React.useState(0)
            React.useEffect(function () {
              settingsSection = { refresh: function () { setState(x => x + 1) } }
              return function () { settingsSection = null }
            }, [])
            return h(EntryToggleSection, {
              t: props.t,
              getEntries: props.getEntries,
              getHidden: props.getHidden,
              getOrder: props.getOrder,
              onToggle: props.onToggle,
              onReset: props.onReset,
              onReorder: props.onReorder,
              onResetOrder: props.onResetOrder,
              refreshTick: state,
            })
          })
          return reg
        })
      },
    }
  },
})
