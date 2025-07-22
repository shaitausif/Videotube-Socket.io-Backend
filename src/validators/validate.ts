// This is the validate middleware responsible to centralize the error checking done by the `express-validator` `ValidationChains`.
//  * This checks if the request validation has errors.
//  * If yes then it structures them and throws an {@link ApiError} which forwards the error to the {@link errorHandler} middleware which throws a uniform response at a single place

import { validationResult, ValidationError } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors: { [key: string]: string }[] = [];

  errors.array().forEach((err: ValidationError) => {
    if ('path' in err) {
      // Only push if it's a field validation error
      extractedErrors.push({ [err.path]: err.msg });
    } else {
      // Optional: handle alternative errors
      extractedErrors.push({ general: err.msg });
    }
  });

  throw new ApiError(422, "Received data is not valid", extractedErrors );
};
