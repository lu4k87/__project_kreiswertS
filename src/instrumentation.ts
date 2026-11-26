// Runs once when the server starts (next dev, next start), before it accepts requests.
import { authSecretProblem } from "./server/startup-check";

export function register() {
  const problem = authSecretProblem(process.env);
  if (problem) throw new Error(problem);
}
