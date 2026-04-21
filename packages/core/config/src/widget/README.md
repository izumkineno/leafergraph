# Widget 配置注意事项

## 重要修复：编辑功能默认启用

### 问题描述
- 输入框（input/textarea）点击后有样式改变但无法打开编辑器进行修改
- 下拉框（select）无法点击打开选项菜单进行选择
- 其他可交互 widget（toggle、slider 等）能正常工作

### 根因分析
- 默认配置中 `editing.enabled` 被设置为 `false`
- `beginTextEdit` 和 `openOptionsMenu` 都有前置条件检查 `if (!this.enabled)`，直接返回 false
- 所以点击 input 和 select 无法打开编辑器/菜单
- toggle 和 slider 不依赖 editing，所以能正常工作

### 解决方案
修改 `default_config.ts` 文件：

```typescript
// 修复前
export function resolveDefaultLeaferGraphWidgetEditingConfig(): NormalizedLeaferGraphWidgetEditingConfig {
  return {
    enabled: false,  // ❌ 默认禁用了编辑功能
    useOfficialTextEditor: true,
    allowOptionsMenu: true
  };
}

// 修复后
export function resolveDefaultLeaferGraphWidgetEditingConfig(): NormalizedLeaferGraphWidgetEditingConfig {
  return {
    enabled: true,  // ✅ 默认启用编辑功能
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
      enabled: false  // 禁用编辑功能
    }
  }
};
```