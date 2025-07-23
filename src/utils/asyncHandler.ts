import { NextFunction, Request, Response } from "express";

/**
 *
 * param {(req: import("express").Request, res:import("express").Response, next:import("express").NextFunction) => void} requestHandler
 */
const asyncHandler = (requestHandler: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

export { asyncHandler };
