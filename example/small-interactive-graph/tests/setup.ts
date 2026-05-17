import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

if (!("CanvasRenderingContext2D" in globalThis)) {
	Object.defineProperty(globalThis, "CanvasRenderingContext2D", {
		configurable: true,
		value: class CanvasRenderingContext2D {}
	});
}

if (!("Path2D" in globalThis)) {
	Object.defineProperty(globalThis, "Path2D", {
		configurable: true,
		value: class Path2D {}
	});
}

const canvasContextStub = new Proxy(
	{},
	{
		get(target, property) {
			if (property in target) {
				return target[property as keyof typeof target];
			}

			return () => undefined;
		},
		set(target, property, value) {
			Object.defineProperty(target, property, {
				configurable: true,
				value,
				writable: true
			});

			return true;
		}
	}
);

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
	configurable: true,
	value(contextId: string) {
		return contextId === "2d" ? canvasContextStub : null;
	}
});
