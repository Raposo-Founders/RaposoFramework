import * as conchContent from "./conch";

declare const conch: {
  ui: typeof import("./ui");
} & typeof conchContent;

export = conch;