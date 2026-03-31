export type RouteSyncIntent =
  | {
      kind: "select";
      chatId: string;
      navigation: "replace" | "push";
    }
  | {
      kind: "clear";
      navigation: { method: "replace" | "push"; href: string };
    };
