// Runs once when the server starts (next dev, next start), before it accepts requests.
import { startupProblem } from "./server/startup-check";

export function register() {
  const problem = startupProblem(process.env);
  if (problem) throw new Error(problem);
}
