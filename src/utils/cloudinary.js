import { v2 as cloudinary} from "cloudinary";
import fs from "fs"

cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET 
    });

const uploadOnCloudinary = async (localFilePath) => { 

    try {
        if(!localFilePath) return null
        // Upload the file on cloudinary
        const response= await cloudinary.uploader.upload(localFilePath,{
            resource_type: "auto"
        })
        // file uploaded succesfuly
        // console.log("File Uploaded successfully on Cloudinary",response.url)
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file if the upload operation gets failed
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file if the upload operation gets failed
        return null
    }
}

export {uploadOnCloudinary}