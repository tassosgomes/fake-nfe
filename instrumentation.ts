export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "test") return;
  const { startSweeper } = await import("./lib/simulation/sweeper");
  startSweeper();
}
