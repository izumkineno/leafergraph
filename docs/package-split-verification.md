# package split 执行验证矩阵

## 目的

这份文档只服务当前这轮 package split 执行：

- 帮 lane 5 维护 README / docs / example / templates 的验证入口
- 记录“哪些 smoke 已经通过、哪些边界检查仍然被已知问题阻塞”
- 避免把一次性的命令结果散落到多个 README 里

## 当前验证矩阵

| 区域 | 目标 | 命令 |
| --- | --- | --- |
| 根文档 / workspace 边界 | 确认 runtime-only root 和 workspace boundary 没被拆分过程破坏 | `bun run check:boundaries` |
| 示例 | 确认作者层示例和主包集成示例还能构建 | `bun run test:smoke:examples` |
| 模板 | 确认三份模板都能 `check + build` | `bun run test:smoke:templates` |

## 2026-04-21 验证结果

> 最新刷新：task 2 验证补录（2026-04-21）

### PASS

- `bun run check:runtime-only-root`
  - runtime-only root 边界检查通过
- `bun run check:boundaries`
  - `check:runtime-only-root` 通过
  - `check:workspace-boundaries` 通过
- `bun run test:workspace-boundaries`
  - workspace boundary 规则测试通过
  - `@leafergraph/extensions/authoring` 的兼容别名断言已更新为顺序无关比较
- `bun run test:smoke:templates`
  - `@template/authoring-node-template` 的 `check` / `build` 通过
  - `@template/authoring-text-widget-template` 的 `check` / `build` 通过
  - `@template/authoring-browser-plugin-template` 的 `check` / `build` 通过

### FAIL（当前已知 blocker）

- `bun run --filter leafergraph test`
  - 不再被路径解析问题阻塞，但存在功能测试失败：
    - `history_runtime_integration.test.ts` 中 history.reset 断言失败
    - `node_shell_host.test.ts` 中信号点和进度环可见性断言失败
  - 主包内仍存在严格模式类型错误，需要后续 lane 决策：
    - `packages/leafergraph/src/graph/assembly/scene.ts` 中多处 `TS7006`
    - `packages/leafergraph/src/interaction/host/controller.ts` 中多处 `TS7006`

### PASS（路径解析问题已解决）

- `bun run build:leafergraph`
  - Vite 构建已完全通过，可正常产出 `dist/index.js`
  - 注意：`tsconfig.base.json` 中 `@leafergraph/core/*` 的路径映射仍指向旧路径（`packages/config/*` 而非 `packages/core/config/*`），但 Vite 配置已单独修复路径解析，不影响构建
- `bun run check:authoring-basic-nodes`
  - `@leafergraph/authoring-basic-nodes` 无法完成 typecheck
  - 根因同样是 split 后的新包名仍未被正确解析：
    - `@leafergraph/core/node`
    - `@leafergraph/core/execution`
    - `@leafergraph/core/contracts`
    - `@leafergraph/core/theme`
- `bun run build:authoring-basic-nodes`
  - Vite bundle 阶段本身可以产出 `dist/index.js`
  - 但随后的 TypeScript 阶段仍然因为上述 `@leafergraph/core/*` 解析失败而整体退出

换句话说，当前 runtime-only root / boundary gate 已恢复绿色，但 `leafergraph` 主包与 `authoring-basic-nodes` 示例都仍被 split 路径解析问题阻塞；其中 `leafergraph` 还叠加了既有严格类型错误。在这些问题修复前，不要把 task 2 的失败误判成 README、example README 或 templates README 的问题。

## 使用约定

- README 里只放稳定入口和高层说明，不内嵌一次性命令输出。
- 需要查看最新 smoke / boundary 结果时，优先更新这份文档。
- 当 `build:leafergraph` 与 `test:leafergraph` 恢复通过后，应继续把上面的 blocker 说明替换成新的通过记录。
