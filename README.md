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

- **v1.1.1**: added the official "More" launcher to the managed entry list as a virtual entry, so it can be shown/hidden and reordered like other sidebar entries. It is detected from the DOM at runtime (the "More" menu is not a `sidebar.panellist` slot entry). Note: hiding "More" also hides access to unpinned entries, browse plugins and create plugin.

- **v1.1.0**: replaced the hard-coded label allowlist with automatic slot-based discovery. Existing label-based preferences are migrated to id-based keys. New plugins are picked up at runtime via `slots.subscribe` and a DOM MutationObserver, with no code change required. The reorder slider now keeps entry names fixed while the slider follows the pointer in real time.

- **v1.1.1**：把官方"更多"启动器作为虚拟入口纳入管理，可像其他侧栏入口一样隐藏/排序；它是运行时从 DOM 检测的（"更多"不是 `sidebar.panellist` slot 入口）。注意：隐藏"更多"会一并失去未固定入口、浏览插件、创建插件的入口。

- **v1.1.0**：把硬编码的标签白名单改为基于 slot 的自动发现；旧的选择会迁移到 id key；通过 `slots.subscribe` 与 DOM MutationObserver 在运行时自动识别新插件，无需改代码。排序滑块现在保持入口名字固定、蓝色滑块实时跟手。

## Notes / 注意

- Only display is affected; the plugin never uninstalls anything and never suspends work.
- Entries it cannot identify are left visible (never hidden by accident).

## Install / 安装

```
dsh plugin add https://github.com/jyz48prsbr-netizen/dsh-sidebar-entry-toggle
```

Or install the prebuilt tarball from the [v1.1.0 release](https://github.com/jyz48prsbr-netizen/dsh-sidebar-entry-toggle/releases/tag/v1.1.0).

## License

MIT
