import { Request, Response } from "express";

const healthCheck = (_request: Request, response: Response) => {
  response
    .status(200)
    .json({ serviceName: "Remote Jobs Fetcher", version: "beta" });
};

export default healthCheck;
