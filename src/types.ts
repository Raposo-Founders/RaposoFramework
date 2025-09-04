declare global {
  const workspace: Workspace;

  interface _G {
    Systems: Record<string, unknown>;
    ClientEnv: unknown;
    RaposoEnv: unknown;
  }
}
