// This is a very reusable code as we can use it to upload files on cloudinary anywhere
import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'
import { ApiError } from './ApiError.js';

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Here in our application we want to upload file first in the server then it will be uploaded in the cloudinary and if successfully uploaded in the cloudinary then it should be deleted from the server

const uploadOnCloudinary = async(localFilePath: any) => {
    try {
        if(!localFilePath) return null

        // Upload the file on cloudinary    
       const response = await cloudinary.uploader.upload(localFilePath,{
            // Options
            resource_type : 'auto' // It will automatically detect the type of the file
        })
        
        // File has been uploaded successfully
        // console.log("File has been uploaded on cloudinary successfully",response.url) // todo: log the response
        // Once the files has been uploaded on the cloud then delete them from local server
        console.log(response)
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        // Link of fs : https://nodejs.org/api/fs.html#fspromisesunlinkpath
        // Unlinking means we're breaking the link of this file from our filesystem, means it won't exist anymore
        fs.unlinkSync(localFilePath) // Remove the locally saved temporary file as the upload operation got failed
        return null
    }
}


function getPublicIdFromUrl(url: string) {
    const parts = url.split('/')
    const fileNameWithExtension = parts[parts.length - 1]
    const fileName = fileNameWithExtension.split('.')[0] 
    return fileName
  }

  
  const deleteFromCloudinary = async(url: string) => {

    // First collect the public_Id from URL using the getPublicIdFromUrl function
    try {
        const public_Id = getPublicIdFromUrl(url)
        console.log(public_Id)
        const res = await cloudinary.uploader.destroy(public_Id)
   
        return res
    } catch (error) {
        throw new ApiError(500, "Unable to delete file from cloudinary")
    }
  }

  





export {uploadOnCloudinary,
    deleteFromCloudinary
}