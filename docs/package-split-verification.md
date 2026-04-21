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

### PASS

- `bun run test:smoke:examples`
  - `@leafergraph/authoring-basic-nodes` 的 `check` / `build` 通过
  - `leafergraph-minimal-graph-example` 构建通过
- `bun run test:smoke:templates`
  - `@template/authoring-node-template` 的 `check` / `build` 通过
  - `@template/authoring-text-widget-template` 的 `check` / `build` 通过
  - `@template/authoring-browser-plugin-template` 的 `check` / `build` 通过

### FAIL（当前已知 blocker）

- `bun run check:boundaries`
  - `packages/leafergraph/src/index.ts` 仍存在真源包聚合 re-export
  - `example/mini-graph/src/graph/use_example_graph.ts` 仍从 `leafergraph` 导入了非 runtime 真源 `Debug`

这两个问题都属于 package split 的 runtime-only root 边界收口工作，应该由主包兼容层 / 边界治理 lane 继续处理；在它们修复前，不要把 `check:boundaries` 的失败误判成 README、example README 或 templates README 的问题。

## 使用约定

- README 里只放稳定入口和高层说明，不内嵌一次性命令输出。
- 需要查看最新 smoke / boundary 结果时，优先更新这份文档。
- 当 `check:boundaries` 恢复通过后，应把上面的 blocker 说明替换成新的通过记录。
