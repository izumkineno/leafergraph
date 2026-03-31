const MODIFIER_ALIASES = new Map<string, "Mod" | "Ctrl" | "Alt" | "Shift" | "Meta">([
  ["mod", "Mod"],
  ["cmd", "Meta"],
  ["command", "Meta"],
  ["meta", "Meta"],
  ["ctrl", "Ctrl"],
  ["control", "Ctrl"],
  ["alt", "Alt"],
  ["option", "Alt"],
  ["shift", "Shift"]
]);

const MODIFIER_ORDER = ["Mod", "Ctrl", "Alt", "Shift", "Meta"] as const;

const CODE_ALIASES = new Map<string, string>([
  ["enter", "Enter"],
  ["escape", "Escape"],
  ["esc", "Escape"],
  ["delete", "Delete"],
  ["del", "Delete"],
  ["backspace", "Backspace"],
  ["space", "Space"],
  ["period", "Period"],
  ["comma", "Comma"],
  ["slash", "Slash"],
  ["semicolon", "Semicolon"],
  ["quote", "Quote"],
  ["backquote", "Backquote"],
  ["minus", "Minus"],
  ["equal", "Equal"],
  ["bracketleft", "BracketLeft"],
  ["bracketright", "BracketRight"],
  ["arrowup", "ArrowUp"],
  ["arrowdown", "ArrowDown"],
  ["arrowleft", "ArrowLeft"],
  ["arrowright", "ArrowRight"],
  ["home", "Home"],
  ["end", "End"],
  ["pageup", "PageUp"],
  ["pagedown", "PageDown"],
  ["tab", "Tab"]
]);

const CODE_LABELS = new Map<string, string>([
  ["Enter", "Enter"],
  ["Escape", "Esc"],
  ["Delete", "Delete"],
  ["Backspace", "Backspace"],
  ["Space", "Space"],
  ["Period", "."],
  ["Comma", ","],
  ["Slash", "/"],
  ["Semicolon", ";"],
  ["Quote", "'"],
  ["Backquote", "`"],
  ["Minus", "-"],
  ["Equal", "="],
  ["BracketLeft", "["],
  ["BracketRight", "]"],
  ["ArrowUp", "Up"],
  ["ArrowDown", "Down"],
  ["ArrowLeft", "Left"],
  ["ArrowRight", "Right"],
  ["PageUp", "Page Up"],
  ["PageDown", "Page Down"]
]);

export function normalizeShortcutChord(chord: string): string {
  const normalizedInput = chord.trim();
  if (!normalizedInput) {
    throw new Error("快捷键 chord 不能为空");
  }

  const modifiers = new Set<(typeof MODIFIER_ORDER)[number]>();
  let code: string | null = null;

  for (const rawPart of normalizedInput.split("+")) {
    const part = rawPart.trim();
    if (!part) {
      throw new Error(`无效快捷键 chord: ${chord}`);
    }

    const alias = MODIFIER_ALIASES.get(part.toLowerCase());
    if (alias) {
      modifiers.add(alias);
      continue;
    }

    if (code) {
      throw new Error(`快捷键 chord 只能包含一个按键 code: ${chord}`);
    }

    code = normalizeCodeToken(part);
  }

  if (!code) {
    throw new Error(`快捷键 chord 缺少按键 code: ${chord}`);
  }

  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), code].join(
    "+"
  );
}

export function matchShortcutEvent(
  event: KeyboardEvent,
  chord: string,
  options?: {
    platform?: "mac" | "windows" | "linux";
  }
): boolean {
  const normalizedChord = normalizeShortcutChord(chord);
  const tokens = normalizedChord.split("+");
  const code = tokens.at(-1);
  if (!code || normalizeCodeToken(event.code || "") !== code) {
    return false;
  }

  const platform = options?.platform ?? detectShortcutPlatform();
  const modifierSet = new Set(tokens.slice(0, -1));

  const expectsCtrl = modifierSet.has("Ctrl") || (modifierSet.has("Mod") && platform !== "mac");
  const expectsMeta = modifierSet.has("Meta") || (modifierSet.has("Mod") && platform === "mac");
  const expectsAlt = modifierSet.has("Alt");
  const expectsShift = modifierSet.has("Shift");

  return (
    event.ctrlKey === expectsCtrl &&
    event.metaKey === expectsMeta &&
    event.altKey === expectsAlt &&
    event.shiftKey === expectsShift
  );
}

export function formatShortcutLabel(
  chord: string,
  options?: {
    platform?: "mac" | "windows" | "linux";
  }
): string {
  const normalizedChord = normalizeShortcutChord(chord);
  const tokens = normalizedChord.split("+");
  const code = tokens.at(-1);
  const modifiers = tokens.slice(0, -1);
  const platform = options?.platform ?? detectShortcutPlatform();

  if (!code) {
    return normalizedChord;
  }

  const modifierLabels = modifiers.map((modifier) =>
    formatModifierLabel(modifier, platform)
  );
  const codeLabel = formatCodeLabel(code);

  if (platform === "mac") {
    return [...modifierLabels, codeLabel].join("");
  }

  return [...modifierLabels, codeLabel].join("+");
}

function normalizeCodeToken(token: string): string {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error("快捷键按键 code 不能为空");
  }

  const lowerCaseToken = normalizedToken.toLowerCase();
  const aliasedCode = CODE_ALIASES.get(lowerCaseToken);
  if (aliasedCode) {
    return aliasedCode;
  }

  const keyMatch = /^key([a-z])$/i.exec(normalizedToken);
  if (keyMatch) {
    return `Key${keyMatch[1].toUpperCase()}`;
  }

  const digitMatch = /^digit([0-9])$/i.exec(normalizedToken);
  if (digitMatch) {
    return `Digit${digitMatch[1]}`;
  }

  return normalizedToken;
}

function formatModifierLabel(
  modifier: string,
  platform: "mac" | "windows" | "linux"
): string {
  if (platform === "mac") {
    switch (modifier) {
      case "Mod":
      case "Meta":
        return "⌘";
      case "Ctrl":
        return "⌃";
      case "Alt":
        return "⌥";
      case "Shift":
        return "⇧";
      default:
        return modifier;
    }
  }

  switch (modifier) {
    case "Mod":
      return "Ctrl";
    case "Meta":
      return "Win";
    default:
      return modifier;
  }
}

function formatCodeLabel(code: string): string {
  if (CODE_LABELS.has(code)) {
    return CODE_LABELS.get(code)!;
  }

  const keyMatch = /^Key([A-Z])$/.exec(code);
  if (keyMatch) {
    return keyMatch[1];
  }

  const digitMatch = /^Digit([0-9])$/.exec(code);
  if (digitMatch) {
    return digitMatch[1];
  }

  return code;
}

function detectShortcutPlatform(): "mac" | "windows" | "linux" {
  if (typeof navigator === "undefined") {
    return "windows";
  }

  const platform =
    (navigator as Navigator & {
      userAgentData?: {
        platform?: string;
      };
    }).userAgentData?.platform ??
    navigator.platform ??
    "";
  if (/mac/i.test(platform)) {
    return "mac";
  }

  if (/linux/i.test(platform)) {
    return "linux";
  }

  return "windows";
}
