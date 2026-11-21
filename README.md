# Sidebar entry toggle / 侧栏入口开关

A DeepSeek Harness plugin that adds a Settings section to show/hide and reorder left-sidebar navigation entries.

一个 DeepSeek Harness 插件，在设置中增加分区，控制左侧栏入口的显示/隐藏与排序。

## What it does / 功能

- Lists **every** sidebar entry automatically by reading DSH's `sidebar.panellist` slot registry.
- Newly installed plugins (e.g. IM bots) appear in the list automatically — **no manual allowlist needed**.
- Toggle each entry on/off; drag the number to reorder (smaller = higher). Settings persist across reloads.
- Uses stable slot **ids** as keys, so localized labels / language switches never break saved choices.

- 自动读取 DSH 的 `sidebar.panellist` slot 注册表，**列出所有**侧栏入口。
- **新安装的插件（如 IM机器人）自动出现在列表中，无需手动加白名单。**
- 独立开关控制显示/隐藏，拖动数字调整顺序（越小越靠上），刷新后仍生效。
- 用稳定的 slot **id** 作 key，语言切换不会让已保存的选择失效。

## Update notes / 更新说明

- **v1.1 (local upgrade)**: replaced the hard-coded label allowlist with automatic slot-based discovery. Existing label-based preferences are migrated to id-based keys. New plugins are picked up at runtime via `slots.subscribe` and a DOM MutationObserver, with no code change required.

- **v1.1（本地升级）**：把硬编码的标签白名单改为基于 slot 的自动发现；旧的选择会迁移到 id key；通过 `slots.subscribe` 与 DOM MutationObserver 在运行时自动识别新插件，无需改代码。

## Notes / 注意

- Only display is affected; the plugin never uninstalls anything and never suspends work.
- Entries it cannot identify are left visible (never hidden by accident).

## Install / 安装

Local profile plugin.
