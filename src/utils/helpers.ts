import fs from 'fs'
import logger from '../logger/winston.logger.js';
import { Request } from 'express';



// description returns the file's local path in the file system to assist future removal
 
export const getLocalPath = (fileName: string) => {
  return `public/images/${fileName}`;
};


// description returns the file's static path from where the server is serving the static image
export const getStaticFilePath = (req: Request, fileName: string) => {
  return `${req.protocol}://${req.get("host")}/images/${fileName}`;
};



export const removeLocalFile = (localPath: any) => {
  fs.unlink(localPath, (err) => {
    if (err) logger.error("Error while removing local files: ", err);
    else {
      logger.info("Removed local: ", localPath);
    }
  });
};

