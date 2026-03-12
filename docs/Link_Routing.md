# 连线路径（LiteGraph 风格）

本文说明 `leafergraph` demo 中连线路径的生成方式。
目标是在节点接近时避免自相交，同时保持路径稳定、清晰、可预测。

## 概述

连线使用单个 `Path` 绘制为三次贝塞尔曲线，曲线由以下内容决定：

1. 起点（源节点输出端口）
2. 终点（目标节点输入端口）
3. 两个控制点（沿端口方向外推）

实现代码位于 `packages/leafergraph/src/link.ts`。

## 端点计算

`resolveLinkEndpoints()` 把节点布局数据转换成两个端点：

- 起点：`sourceX + sourceWidth + portSize / 2`
- 终点：`targetX - portSize / 2`

垂直位置由调用方提供，这样连线路由逻辑与节点布局策略解耦。

## 控制点

控制点遵循 LiteGraph 的通用策略：

- 控制柄长度基于两端距离 `dist * 0.25`，并限定在 `24 ~ 160` 之间
- 控制柄沿端口方向应用

这样能在节点出线处形成明显的“向外扩展”，符合 LiteGraph 的视觉习惯。

## 自相交避免策略

当前未额外引入单调修正，保持 LiteGraph 风格的外扩控制点。
若后续仍出现明显回折，再按场景增加约束。

## 相关代码

- `packages/leafergraph/src/link.ts`
- `packages/leafergraph/src/index.ts`（demo 使用）
