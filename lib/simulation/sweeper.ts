import { advanceDue } from "../services/invoices";
import { pruneLogs } from "../services/logs";
import { deliverDue } from "../services/webhooks";

const globalState = globalThis as typeof globalThis & { __estudoSweeper?: NodeJS.Timeout };
let ticks = 0;

export async function runTick(now = Date.now()): Promise<void> {
  ticks += 1;
  advanceDue(now);
  await deliverDue(now);
  if (ticks % 50 === 0) pruneLogs(now);
}

export function startSweeper(): void {
  if (globalState.__estudoSweeper) return;
  globalState.__estudoSweeper = setInterval(() => {
    void runTick().catch((error) => {
      console.error("Varredor da bancada falhou", error);
    });
  }, 400);
  globalState.__estudoSweeper.unref?.();
}
