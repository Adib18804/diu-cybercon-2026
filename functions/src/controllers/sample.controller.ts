import { Request, Response, NextFunction } from "express";
import { successResponse } from "../utils/responseFormatter";
import { ApiError } from "../middlewares/errorHandler";

export const getHealth = (_req: Request, res: Response): void => {
  res.status(200).json(
    successResponse(
      {
        status: "healthy",
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
      },
      "Backend service is operational"
    )
  );
};

export const getStatus = (_req: Request, res: Response): void => {
  res.status(200).json(
    successResponse(
      {
        service: "DIU CyberCon 2026 Serverless API",
        version: "1.0.0",
        cloudProvider: "Google Cloud Platform / Firebase",
        features: ["Express on Cloud Functions", "CORS Enabled", "Scalable Routing"],
      },
      "API details retrieved successfully"
    )
  );
};

export const createSampleItem = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { title, description } = req.body;

    if (!title) {
      throw new ApiError(400, "Validation failed: 'title' is required", "INVALID_INPUT", {
        field: "title",
      });
    }

    const newItem = {
      id: `item_${Date.now()}`,
      title,
      description: description || "",
      createdAt: new Date().toISOString(),
    };

    res.status(201).json(successResponse(newItem, "Item created successfully"));
  } catch (error) {
    next(error);
  }
};
