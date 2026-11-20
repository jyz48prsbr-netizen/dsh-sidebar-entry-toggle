window.__ModuleLoader__.load({
  id: 'dsh-sidebar-entry-toggle',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useCallback, useRef } = React

    const NS = 'sidebar-entry-toggle'
    const HIDDEN_KEY = 'dsh.sidebar-entry-toggle.hidden.v1'
    const ORDER_KEY = 'dsh.sidebar-entry-toggle.order.v1'
    const STYLE_ID = 'dsh-sidebar-entry-toggle-style'

    const DICT = {
      zh: {
        nav: '侧栏入口管理',
        title: '侧栏入口管理',
        desc: '开关控制显示/隐藏；拖动数字调整左侧栏顺序（数字越小越靠上）。刷新后仍然生效。',
        reset: '全部显示',
        resetOrder: '恢复默认顺序',
        note: '调整只影响显示，不会卸载相关插件。',
      },
      en: {
        nav: 'Sidebar entries',
        title: 'Sidebar entries',
        desc: 'Toggle visibility; drag the number to reorder entries in the left sidebar (smaller = higher). Persists across reloads.',
        reset: 'Show all',
        resetOrder: 'Reset order',
        note: 'Only display is affected; plugins are not uninstalled.',
      },
    }

    const ENTRIES = [
      { key: 'plugins', labels: ['插件', 'Plugins'] },
      { key: 'market', labels: ['插件市场', 'Plugin Market', 'Market'] },
      { key: 'deepseek', labels: ['DeepSeek 网页版', 'DeepSeek Web'] },
      { key: 'schedule', labels: ['自动化任务', '定时任务', 'Scheduled tasks', 'Automation tasks'] },
      { key: 'agents', labels: ['智能体', 'Agents', 'Agent teams'] },
      { key: 'skills', labels: ['技能中心', 'Skill Center'] },
      { key: 'ssh', labels: ['SSH'] },
      { key: 'more', labels: ['更多', 'More'] },
    ]

    function displayName(key) {
      const e = ENTRIES.find(function (x) { return x.key === key })
      return e ? e.labels[0] : key
    }

    function defaultOrder() {
      return ENTRIES.map(function (e) { return e.key })
    }

    function readHidden() {
      try {
        const raw = localStorage.getItem(HIDDEN_KEY)
        if (!raw) return {}
        const obj = JSON.parse(raw)
        return obj && typeof obj === 'object' ? obj : {}
      } catch (_) { return {} }
    }

    function writeHidden(obj) {
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(obj)) } catch (_) {}
    }

    function readOrder() {
      try {
        const raw = localStorage.getItem(ORDER_KEY)
        if (!raw) return defaultOrder()
        const arr = JSON.parse(raw)
        if (!Array.isArray(arr)) return defaultOrder()
        const valid = arr.filter(function (k) { return ENTRIES.some(function (e) { return e.key === k }) })
        ENTRIES.forEach(function (e) { if (valid.indexOf(e.key) < 0) valid.push(e.key) })
        return valid
      } catch (_) { return defaultOrder() }
    }

    function writeOrder(arr) {
      try { localStorage.setItem(ORDER_KEY, JSON.stringify(arr)) } catch (_) {}
    }

    function esc(label) {
      return String(label).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }

    function applyStyle(hidden, order) {
      const rules = []
      for (const e of ENTRIES) {
        const hiddenThis = Boolean(hidden[e.key])
        const idx = order.indexOf(e.key)
        const val = (idx < 0 ? ENTRIES.length : idx) + 1
        for (const label of e.labels) {
          const l = esc(label)
          const sel = 'button[aria-label="' + l + '"]'
          if (hiddenThis) {
            rules.push('[class*="panelEntry"]:has(> ' + sel + ') { display: none !important; }')
            rules.push('[data-dsh-part="sidebar-entry"]:has(> ' + sel + ') { display: none !important; }')
            rules.push('[class*="moreAnchor"]:has(' + sel + ') { display: none !important; }')
            rules.push(sel + ' { display: none !important; }')
          } else {
            rules.push('[class*="panelEntry"]:has(> ' + sel + ') { order: ' + val + ' !important; }')
            rules.push('[data-dsh-part="sidebar-entry"]:has(> ' + sel + ') { order: ' + val + ' !important; }')
            rules.push('[class*="moreAnchor"]:has(' + sel + ') { order: ' + val + ' !important; }')
            rules.push(sel + ' { order: ' + val + ' !important; }')
          }
        }
      }
      let el = document.getElementById(STYLE_ID)
      if (!el) {
        el = document.createElement('style')
        el.id = STYLE_ID
        document.head.appendChild(el)
      }
      el.textContent = rules.join('\n')

      // JS fallback: apply the same hide/order rules directly to the real DOM
      // nodes. Older embedded Chromium may not support :has(); setting inline
      // style on the button and its row works everywhere and is re-applied by
      // the existing timer, so it also survives React re-renders.
      try {
        const buttons = document.querySelectorAll('button[aria-label]')
        for (const btn of buttons) {
          const label = btn.getAttribute('aria-label') || ''
          let hiddenThis = false
          let orderVal = ENTRIES.length + 1
          for (const e of ENTRIES) {
            if (e.labels.indexOf(label) < 0) continue
            hiddenThis = Boolean(hidden[e.key])
            const idx = order.indexOf(e.key)
            orderVal = (idx < 0 ? ENTRIES.length : idx) + 1
            break
          }
          if (hiddenThis) {
            btn.style.setProperty('display', 'none', 'important')
            const row = btn.closest('[class*="panelEntry"], [data-dsh-part="sidebar-entry"], [class*="moreAnchor"]')
            if (row) row.style.setProperty('display', 'none', 'important')
          } else {
            if (btn.style.getPropertyPriority('display') === 'important') btn.style.removeProperty('display')
            btn.style.setProperty('order', String(orderVal))
            const row = btn.closest('[class*="panelEntry"], [data-dsh-part="sidebar-entry"], [class*="moreAnchor"]')
            if (row && row.style.getPropertyPriority('display') === 'important') row.style.removeProperty('display')
          }
        }
      } catch (_) {}
    }

    function Toggle({ on }) {
      return h('span', {
        role: 'switch', 'aria-checked': on ? 'true' : 'false',
        style: {
          display: 'inline-flex', alignItems: 'center', width: 36, height: 20,
          borderRadius: 10, padding: 2, boxSizing: 'border-box', flexShrink: 0,
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

    function EntryToggleSection({ t, initialHidden, initialOrder, onToggle, onReset, onReorder, onResetOrder }) {
      const [hidden, setHidden] = useState(initialHidden || {})
      const [order, setOrder] = useState(initialOrder || defaultOrder())
      const latest = useRef({ onToggle, onReset, onReorder, onResetOrder })
      latest.current = { onToggle, onReset, onReorder, onResetOrder }

      const toggle = useCallback(function (key) {
        setHidden(function (prev) {
          const next = Object.assign({}, prev)
          if (next[key]) delete next[key]
          else next[key] = true
          latest.current.onToggle(key, next)
          return next
        })
      }, [])

      const reorder = useCallback(function (key, targetIndex) {
        setOrder(function (prev) {
          const next = prev.slice()
          const from = next.indexOf(key)
          if (from < 0 || targetIndex < 0 || targetIndex >= next.length || from === targetIndex) return prev
          next.splice(from, 1)
          next.splice(targetIndex, 0, key)
          latest.current.onReorder(next)
          return next
        })
      }, [])

      const reset = useCallback(function () {
        setHidden({})
        latest.current.onReset()
      }, [])

      const resetOrder = useCallback(function () {
        const def = defaultOrder()
        setOrder(def)
        latest.current.onResetOrder(def)
      }, [])

      return h('div', { style: { padding: '8px 4px', color: 'var(--dsw-alias-label-primary)' } },
        h('h3', { style: { margin: '0 0 4px', fontSize: 16 } }, t('title')),
        h('p', { style: { margin: '0 0 16px', opacity: 0.75, fontSize: 13, lineHeight: 1.5 } }, t('desc')),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
          ENTRIES.map(function (e) {
            const on = !hidden[e.key]
            const pos = order.indexOf(e.key) + 1
            return h('div', {
              key: e.key,
              style: {
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', border: '1px solid var(--dsw-alias-border-l2, #ddd)',
                borderRadius: 8, background: 'transparent', fontSize: 14,
              },
            },
              h('span', { style: { width: 110, flexShrink: 0 } }, displayName(e.key)),
              h('input', {
                type: 'range', min: 1, max: ENTRIES.length, step: 1, value: pos,
                onChange: function (ev) { reorder(e.key, Number(ev.target.value) - 1) },
                style: { flex: 1, minWidth: 60, cursor: 'pointer' },
                'aria-label': '排序 ' + displayName(e.key),
              }),
              h('span', { style: { width: 16, textAlign: 'center', flexShrink: 0, opacity: 0.8 } }, String(pos)),
              h(Toggle, { on: on })
            )
          })
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' } },
          h('button', {
            type: 'button', onClick: reset,
            style: {
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              border: '1px solid var(--dsw-alias-border-l2, #ddd)',
              background: 'transparent', color: 'inherit',
            },
          }, t('reset')),
          h('button', {
            type: 'button', onClick: resetOrder,
            style: {
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              border: '1px solid var(--dsw-alias-border-l2, #ddd)',
              background: 'transparent', color: 'inherit',
            },
          }, t('resetOrder')),
          h('span', { style: { opacity: 0.6, fontSize: 12 } }, t('note'))
        )
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICT), 'sidebar-entry-toggle: dictionaries')

        let hidden = readHidden()
        let order = readOrder()
        applyStyle(hidden, order)

        const timer = setInterval(function () { applyStyle(hidden, order) }, 1500)
        ctx.effect(() => function () { clearInterval(timer) }, 'sidebar-entry-toggle: reapply timer')

        const onToggle = function (key, next) {
          hidden = next
          writeHidden(hidden)
          applyStyle(hidden, order)
        }
        const onReorder = function (next) {
          order = next
          writeOrder(order)
          applyStyle(hidden, order)
        }
        const onReset = function () {
          hidden = {}
          writeHidden(hidden)
          applyStyle(hidden, order)
        }
        const onResetOrder = function (next) {
          order = next
          writeOrder(order)
          applyStyle(hidden, order)
        }

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'sidebar-entry-toggle',
          order: 90,
          label: function () { return ctx.locale.bind(NS)('nav') },
          locale: NS,
          inject: function () { return {
            t: ctx.locale.bind(NS),
            initialHidden: hidden,
            initialOrder: order,
            onToggle: onToggle,
            onReset: onReset,
            onReorder: onReorder,
            onResetOrder: onResetOrder,
          } },
        }, EntryToggleSection))
      },
    }
  },
})
