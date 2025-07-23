import morgan from "morgan";
import logger from "./winston.logger.js";

// This file sets up a middleware (morganMiddleware) to log HTTP requests using morgan, and routes those logs through your winston logger, specifically using the http severity level. It also skips logging in production to avoid clutter.

const stream = {
  // Use the http severity
  // This tells morgan to pass all HTTP logs (like GET /api 200) to winston using the .http() method.
  write: (message: any) => logger.http(message.trim()),
};

const skip = () => {
  // If you're not in development mode, return true so that logging is skipped (i.e., don’t log in production).
  const env = process.env.NODE_ENV || "development";
  return env !== "development";   
};

const morganMiddleware = morgan(
  // Configures how logs look:

// Example log: 127.0.0.1 GET /login 200 - 8.123 ms
  ":remote-addr :method :url :status - :response-time ms",
  { stream, skip }
);

export default morganMiddleware;
