import { GraphViewport } from "./GraphViewport";
import { demoNodes } from "./demo-nodes";

export function App() {
  return (
    <div class="shell">
      <aside class="sidebar">
        <p class="eyebrow">LeaferGraph</p>
        <h1>Editor Sandbox</h1>
        <p class="lead">
          编辑器控制层现在由 <code>Preact</code> 承担，LeaferGraph 继续作为底层
          画布与图形宿主。
        </p>

        <section class="panel">
          <h2>当前结构</h2>
          <ul>
            <li>核心库：LeaferGraph API 与渲染宿主</li>
            <li>编辑器：Preact 组件树管理布局和状态</li>
            <li>挂载方式：GraphViewport 组件托管 LeaferGraph 实例</li>
          </ul>
        </section>

        <section class="panel">
          <h2>第一阶段目标</h2>
          <ul>
            <li>graph / node / link 数据结构</li>
            <li>scene sync 与局部渲染</li>
            <li>viewport / selection / connect</li>
            <li>play / step 最小执行闭环</li>
          </ul>
        </section>
      </aside>

      <main class="workspace">
        <header class="toolbar">
          <div>
            <p class="toolbar__label">Workspace</p>
            <h2>Leafer-first Node Graph</h2>
          </div>
          <span class="badge">Preact editor to LeaferGraph library</span>
        </header>

        <GraphViewport nodes={demoNodes} />
      </main>
    </div>
  );
}
