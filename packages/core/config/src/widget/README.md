# Widget 配置注意事项

## `editing.enabled` 默认值

- 默认配置中 `editing.enabled` 为 `false`
- `beginTextEdit(...)` 与 `openOptionsMenu(...)` 都会先检查 `editing.enabled`
- 因此文本编辑器与离散选项菜单默认不会自动启用，需要宿主显式打开

### 根因分析
- 早期默认配置把 `editing.enabled` 设成了 `false`
- `beginTextEdit` 和 `openOptionsMenu` 都有前置条件检查 `if (!this.enabled)`，直接返回 false
- 所以点击 input 和 select 无法打开编辑器/菜单
- toggle 和 slider 不依赖 editing，所以能正常工作

### 解决方案
当前默认配置已经收敛为：

```typescript
export function resolveDefaultLeaferGraphWidgetEditingConfig(): NormalizedLeaferGraphWidgetEditingConfig {
  return {
    enabled: true,
    useOfficialTextEditor: true,
    allowOptionsMenu: true
  };
}
```

### 影响范围
- 所有使用 `beginTextEdit` 的 widget（input、textarea）
- 所有使用 `openOptionsMenu` 的 widget（select）
- 不影响其他 widget（toggle、slider、button、checkbox、radio 等）

### 测试验证
1. 打开 http://localhost:5173/
2. 连接后端服务器
3. 点击"压力运行"加载蓝图
4. 测试所有可交互 widget：
   - input：点击能打开编辑器，可输入修改
   - select：点击能打开菜单，可选择选项
   - toggle：点击能切换状态
   - slider：能拖动调整数值

### 配置说明
- `enabled`：控制是否启用编辑功能（默认为 true）
- `useOfficialTextEditor`：控制是否使用官方文本编辑器（默认为 true）
- `allowOptionsMenu`：控制是否允许打开选项菜单（默认为 true）

如果需要禁用编辑功能，可在创建 widget 时显式设置：

```typescript
const widget = {
  type: 'input',
  config: {
    editing: {
      enabled: true,
      useOfficialTextEditor: true,
      allowOptionsMenu: true
    }
  }
};
```

## 配置字段说明

- `enabled`：是否启用统一 Widget 编辑能力（默认 `false`）
- `useOfficialTextEditor`：是否接入官方文本编辑器（默认 `true`）
- `allowOptionsMenu`：是否允许打开离散选项菜单（默认 `true`）

## 影响范围

- `input` / `textarea` 这类通过 `beginTextEdit(...)` 进入编辑态的 widget
- `select` 这类通过 `openOptionsMenu(...)` 打开菜单的 widget
- `toggle`、`slider` 等不依赖统一编辑宿主的 widget 不受该开关直接影响
