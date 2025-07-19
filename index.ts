import dotenv from 'dotenv'
import connectDB from './src/db'
import logger from './src/logger/winston.logger'


dotenv.config({
  path: "./.env",
});


/**
 * Starting from Node.js v14 top-level await is available and it is only available in ES modules.
 * This means you can not use it with common js modules or Node version < 14.
 */

const majorNodeVersion = +process.env.NODE_VERSION!?.split(".")[0] || 0;



