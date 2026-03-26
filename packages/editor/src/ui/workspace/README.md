# `src/ui/workspace`

## 作用
- 承接主工作区布局区域，组织节点库、画布和检查器三大区域。

## 边界
- 负责区域级布局。
- 不负责具体区域的数据获取和 graph 执行逻辑。

## 核心入口
- `Connected.tsx`
- `View.tsx`
- `types.ts`

## 推荐阅读顺序
1. `Connected.tsx`
2. `View.tsx`
3. `../node-library/README.md`
4. `../viewport/README.md`
5. `../inspector/README.md`

## 上下游关系
- 上游：`shell/provider.tsx`。
- 下游：节点库、画布、检查器三个区域组件。