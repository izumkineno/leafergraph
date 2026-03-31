export type LeaferGraphShortcutPlatform = "mac" | "windows" | "linux";

export function resolveShortcutPlatform(
  platform?: LeaferGraphShortcutPlatform
): LeaferGraphShortcutPlatform {
  if (platform) {
    return platform;
  }

  if (typeof navigator === "undefined") {
    return "windows";
  }

  const currentPlatform =
    (navigator as Navigator & {
      userAgentData?: {
        platform?: string;
      };
    }).userAgentData?.platform ??
    navigator.platform ??
    "";
  if (/mac/i.test(currentPlatform)) {
    return "mac";
  }

  if (/linux/i.test(currentPlatform)) {
    return "linux";
  }

  return "windows";
}
