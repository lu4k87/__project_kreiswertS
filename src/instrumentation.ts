// Läuft einmal beim Start des Servers (next dev, next start), bevor er Anfragen annimmt.
import { authSecretProblem } from "./server/startup-check";

export function register() {
  const problem = authSecretProblem(process.env);
  if (problem) throw new Error(problem);
}
