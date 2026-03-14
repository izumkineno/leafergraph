# LeaferGraph Workspace

这个目录是新的 LeaferGraph 实验工程，分成两个 Vite 子项目：

- `packages/leafergraph`
  - 核心库工程
  - 负责提供最小的 LeaferGraph API
- `packages/editor`
  - 编辑器工程
  - 使用 Preact 作为主要控制层，并通过包名 `leafergraph` 引用核心库

## 常用命令

```bash
bun install
bun run dev:editor
bun run dev:editor:lan
bun run build
```

## 当前定位

这一版先把工程骨架搭起来：

- 库包：`leafergraph`
- 编辑器包：`leafergraph-editor`
- 编辑器通过包依赖和 Vite alias 直接引用库源码

后续可以在这个基础上继续补：

- graph / node / link 数据结构
- scene sync
- viewport / selection / connect
- play / step

## 设计文档

- `docs/范围与设计选项.md`
  - 范围划定
  - 三个设计方案
  - 推荐结构与后续优先级
- `docs/架构蓝图.md`
  - 参考 `litegraph.js` Leafer 运行层提炼出的新架构
  - 分层、主链路、层级模型与阶段路线
- `docs/节点插件接入方案.md`
  - 外部节点包接入方案
  - Vite external、宿主注入与主包节点池注册流程
- `docs/节点API方案.md`
  - 节点 API 与节点外壳整合方案
  - 生命周期、注册机制、节点结构与外壳设计说明
- `docs/右键菜单管理方案.md`
  - 基于 Leafer `pointer.menu` 的右键菜单基础设施方案
  - 菜单管理器职责、坐标体系与宿主接入方式
