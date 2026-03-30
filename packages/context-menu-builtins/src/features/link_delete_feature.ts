import type { LeaferGraphContextMenuBuiltinFeatureDefinition } from "../types";

export const linkDeleteFeature: LeaferGraphContextMenuBuiltinFeatureDefinition = {
  id: "linkDelete",
  register({ registerResolver, removeLink }) {
    return registerResolver("link-delete", (context) => {
      const linkId = context.target.kind === "link" ? context.target.id : undefined;
      if (!linkId) {
        return [];
      }

      return [
        {
          key: "builtin-link-delete",
          label: "删除连线",
          order: 90,
          danger: true,
          onSelect() {
            removeLink(linkId, context);
          }
        }
      ];
    });
  }
};
