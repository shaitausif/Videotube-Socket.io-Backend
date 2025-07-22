import fs from 'fs'
import logger from '../logger/winston.logger';



// description returns the file's local path in the file system to assist future removal
 
export const getLocalPath = (fileName) => {
  return `public/images/${fileName}`;
};


// description returns the file's static path from where the server is serving the static image
export const getStaticFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/images/${fileName}`;
};



export const removeLocalFile = (localPath) => {
  fs.unlink(localPath, (err) => {
    if (err) logger.error("Error while removing local files: ", err);
    else {
      logger.info("Removed local: ", localPath);
    }
  });
};

