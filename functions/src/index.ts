import { onRequest } from "firebase-functions/v2/https";
import app from "./app";

// Export the Express app as a 2nd-gen Cloud Function named 'api'
export const api = onRequest(
  {
    cors: true,
    invoker: "public", // Publicly accessible trigger
    memory: "256MiB",
    timeoutSeconds: 60,
    minInstances: 0,
    maxInstances: 10,
  },
  app
);
