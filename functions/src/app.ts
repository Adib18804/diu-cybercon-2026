import express, { Request, Response } from "express";
import cors from "cors";
import apiRoutes from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { errorResponse } from "./utils/responseFormatter";

const app = express();

// Enable Cross-Origin Resource Sharing (CORS)
app.use(
  cors({
    origin: true, // Reflect request origin, or configure specific domains for strict security
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  })
);

// Built-in JSON and urlencoded body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Support routing both with and without the /api prefix for flexibility across emulators, rewrites, and direct invocations
app.use("/api", apiRoutes);
app.use("/", apiRoutes);

// Catch-all 404 handler for unmatched API routes
app.use((req: Request, res: Response) => {
  res.status(404).json(
    errorResponse(`Route not found: [${req.method}] ${req.originalUrl}`, "NOT_FOUND")
  );
});

// Centralized error handling middleware
app.use(errorHandler);

export default app;
