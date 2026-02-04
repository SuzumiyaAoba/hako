import { serve } from "bun";
import { app } from "./app";

const resolvePort = (): number => {
  const raw = process.env["PORT"]?.trim();
  if (!raw) {
    return 3000;
  }
  const parsed = Number.parseInt(raw, 10);
  const isValid = Number.isInteger(parsed) && (parsed === 0 || (parsed >= 1 && parsed <= 65535));
  if (!isValid) {
    console.error(`Invalid PORT: "${raw}". Use 0 or an integer between 1 and 65535.`);
    process.exit(1);
  }
  return parsed;
};

const port = resolvePort();

serve({
  port,
  fetch: app.fetch,
});

console.log(`@hako/web listening on http://localhost:${port}`);
