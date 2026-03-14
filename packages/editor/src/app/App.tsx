import { useEffect, useState } from "preact/hooks";

import { GraphViewport } from "./GraphViewport";
import { editorDemoGraph, editorDemoModules } from "../demo/demo-setup";
import { editorDemoPlugins } from "../demo/external-widget-demo";
import {
  EDITOR_THEME_STORAGE_KEY,
  resolveInitialEditorTheme,
  type EditorTheme
} from "../theme";

/** 切换到相反主题。 */
function toggleEditorTheme(theme: EditorTheme): EditorTheme {
  return theme === "dark" ? "light" : "dark";
}

export function App() {
  const [theme, setTheme] = useState<EditorTheme>(() =>
    resolveInitialEditorTheme()
  );

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(EDITOR_THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div class="shell" data-theme={theme}>
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
          <div class="toolbar__actions">
            <span class="badge">
              {theme === "dark" ? "暗色工作区" : "亮色工作区"}
            </span>
            <button
              type="button"
              class="theme-toggle"
              data-theme={theme}
              aria-label={`切换到${theme === "dark" ? "亮色" : "暗色"}模式`}
              title={`切换到${theme === "dark" ? "亮色" : "暗色"}模式`}
              onClick={() => {
                setTheme((currentTheme) => toggleEditorTheme(currentTheme));
              }}
            >
              <span class="theme-toggle__thumb" aria-hidden="true" />
              <span class="theme-toggle__option theme-toggle__option--light">
                亮色
              </span>
              <span class="theme-toggle__option theme-toggle__option--dark">
                暗色
              </span>
            </button>
          </div>
        </header>

        <GraphViewport
          graph={editorDemoGraph}
          modules={editorDemoModules}
          plugins={editorDemoPlugins}
          theme={theme}
        />
      </main>
    </div>
  );
}
