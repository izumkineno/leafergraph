# Widget 配置注意事项

## editing.enabled 默认值

- 默认配置中 editing.enabled 为 alse
- eginTextEdit(...) 与 openOptionsMenu(...) 都会先检查 editing.enabled
- 因此文本编辑器与离散选项菜单默认不会自动启用，需要宿主显式打开

## 显式启用编辑能力

`	s
const config = {
  widget: {
    editing: {
      enabled: true,
      useOfficialTextEditor: true,
      allowOptionsMenu: true
    }
  }
};
`

## 配置字段说明

- enabled：是否启用统一 Widget 编辑能力（默认 alse）
- useOfficialTextEditor：是否接入官方文本编辑器（默认 	rue）
- llowOptionsMenu：是否允许打开离散选项菜单（默认 	rue）

## 影响范围

- input / 	extarea 这类通过 eginTextEdit(...) 进入编辑态的 widget
- select 这类通过 openOptionsMenu(...) 打开菜单的 widget
- 	oggle、slider 等不依赖统一编辑宿主的 widget 不受该开关直接影响
