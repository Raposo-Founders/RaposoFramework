declare global {
  const workspace: Workspace;

  interface _G {
    Raposo: {
      Systems: Record<string, unknown>;
      Controllers: Record<string, unknown>;
      Environment: unknown;
    }
  }
}
