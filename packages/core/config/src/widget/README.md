# Widget 配置注意事项

## `editing.enabled`

- 默认值为 `false`
- `beginTextEdit(...)` 和 `openOptionsMenu(...)` 都会先检查 `editing.enabled`
- 需要文本编辑或选项菜单时，宿主必须显式开启

## 配置字段

- `enabled`：是否启用统一 Widget 编辑能力（默认 `false`）
- `useOfficialTextEditor`：是否接入官方文本编辑器（默认 `true`）
- `allowOptionsMenu`：是否允许打开离散选项菜单（默认 `true`）

## 影响范围

- `input` / `textarea` 这类通过 `beginTextEdit(...)` 进入编辑态的 widget
- `select` 这类通过 `openOptionsMenu(...)` 打开菜单的 widget
- `toggle`、`slider` 等不依赖统一编辑宿主的 widget 不受该开关直接影响
