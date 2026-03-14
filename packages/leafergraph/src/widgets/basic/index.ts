import { createWidgetLifecycleRenderer } from "../widget_lifecycle";
import { ButtonFieldController } from "./button_widget";
import { CheckboxFieldController } from "./checkbox_widget";
import { RadioFieldController } from "./radio_widget";
import { ReadonlyFieldController } from "./readonly_widget";
import { SelectFieldController } from "./select_widget";
import { SliderFieldController } from "./slider_widget";
import { TextFieldController } from "./text_widget";
import { ToggleFieldController } from "./toggle_widget";
import type { BasicWidgetEntry } from "./types";

export type {
  BasicWidgetLifecycle,
  BasicWidgetLifecycleState,
  BasicWidgetEntry,
  BasicWidgetTheme,
  ChoiceItemView,
  ResolvedLinearRange,
  ResolvedTextDisplay,
  WidgetAnchorTarget
} from "./types";
export { resolveBasicWidgetTheme } from "./theme";

/**
 * 基础 Widget 库。
 * 这里使用类来维护控件集合与生命周期控制器，方便后续继续扩展更多内建组件。
 */
export class BasicWidgetLibrary {
  private readonly readonlyController = new ReadonlyFieldController();
  private readonly inputController = new TextFieldController(false);
  private readonly textareaController = new TextFieldController(true);
  private readonly selectController = new SelectFieldController();
  private readonly checkboxController = new CheckboxFieldController();
  private readonly toggleController = new ToggleFieldController();
  private readonly sliderController = new SliderFieldController();
  private readonly buttonController = new ButtonFieldController();
  private readonly radioController = new RadioFieldController();

  createEntries(): BasicWidgetEntry[] {
    return [
      this.createEntry("number", this.readonlyController.createLifecycle()),
      this.createEntry("string", this.readonlyController.createLifecycle()),
      this.createEntry("custom", this.readonlyController.createLifecycle()),
      this.createEntry("input", this.inputController.createLifecycle()),
      this.createEntry("textarea", this.textareaController.createLifecycle()),
      this.createEntry("select", this.selectController.createLifecycle()),
      this.createEntry("checkbox", this.checkboxController.createLifecycle()),
      this.createEntry("toggle", this.toggleController.createLifecycle()),
      this.createEntry("slider", this.sliderController.createLifecycle()),
      this.createEntry("button", this.buttonController.createLifecycle()),
      this.createEntry("radio", this.radioController.createLifecycle())
    ];
  }

  private createEntry(type: string, lifecycle: Parameters<typeof createWidgetLifecycleRenderer>[0]): BasicWidgetEntry {
    return {
      type,
      title: type,
      renderer: createWidgetLifecycleRenderer(lifecycle)
    };
  }
}

/**
 * 旧命名的兼容别名。
 * 现阶段主包内部已经改为直接消费完整 Widget 条目。
 */
export const BasicWidgetRendererLibrary = BasicWidgetLibrary;
