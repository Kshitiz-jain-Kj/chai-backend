import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req,res) => { 
    // user details from frontend
    // validate krna - not empty
    // check if user already exists : check username and email
    // check avatar and valideate not empty
    // fileupload wala system
    // image ko cloudianry mein bhjena localstorage wali chiz 
    //  cloudinary se response ka url lena pdega 
    // create user objects - create entry in db
    // remove password and refresh token from entry 
    // check response and usercreated successfully // return response
    

    const {username,fullName,email,password}  = req.body
    console.log("usernme: ",username)
    console.log("email: ",email)
    // if (fullName == ""){
    //     throw new ApiError(400,"FUll Name is required")
    // } Basic Method

    // An Alternative using some 
    if([username,fullName,email,password].some((field) => field?.trim() === ""))
    {
        throw new ApiError(400,"All fields are neccessary")
    }
    const existedUser = User.findOne({
            $or: [{username},{email}]
        })  
    if (existedUser)
    {
        throw new ApiError(409 , "Username or email already exists")
    }
    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage[0]?.path
    if(!avatarLocalPath){
        throw new ApiError(404,"Avatar file is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar){
        throw new ApiError(404,"Avatar file is required not went on CLoudinary")
    }
    const user = await User.create({
        username: username.toLowerCase() ,
        email,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        password

    })
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser){
        throw new ApiError(500,"Something went wrong while registering the User ")
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User Registered Successfully ")
    )
 })
 export {registerUser}
