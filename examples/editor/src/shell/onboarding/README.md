# `src/shell/onboarding`

## 作用
- 负责 clean entry 模式下的 onboarding 决策和默认 Python authority demo 提示文案。

## 边界
- 负责根据当前入口判断要不要展示引导。
- 不负责真正打开 demo 页面或执行 bundle 装载。

## 核心入口
- `default_entry_onboarding.ts`

## 主要数据流 / 调用链
1. provider 判断当前是否为 clean entry。
2. onboarding 模块给出 stage 引导和节点库提示状态。
3. 顶栏、画布空态和节点库根据该状态展示快捷动作。

## 推荐阅读顺序
1. `default_entry_onboarding.ts`

## 上下游关系
- 上游：`shell/provider.tsx`。
- 下游：`ui/viewport/Connected.tsx`、`ui/node-library/Connected.tsx`。