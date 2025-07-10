import mongoose from "mongoose";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken"
const generateAccessandRefreshToken = async(userId)=>{
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()
    // user.accessToken = accessToken
    user.refreshToken = refreshToken 
    await user.save({validateBeforeSave: false})
    return {accessToken,refreshToken}
}

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
    // console.log(req)
    // console.log("Above was req UPar")
    // console.log(req.files)
    // if (fullName == ""){
    //     throw new ApiError(400,"FUll Name is required")
    // } Basic Method

    // An Alternative using some 
    if([username,fullName,email,password].some((field) => field?.trim() === ""))
    {
        throw new ApiError(400,"All fields are neccessary")
    }
    const existedUser = await User.findOne({
            $or: [{username},{email}]
        })  
    if (existedUser)
    {
        throw new ApiError(409 , "Username or email already exists")
    }
    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

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

const loginUser = asyncHandler(async(req,res)=>{
     // Firstly email password from frontend se lo
     /* email password ko validate kro db se
     access token and refresh token generate
     send cookies    
     user ka refresh token and db ka refresh token if same toh bina password entry    
     */

   const {username,email,password} = req.body
   console.log(email)
   if(!username && !email){
    throw new ApiError(400,"Username or email is required")
   }
   const user = await User.findOne({$or:[{username},{email}]})
   if (!user){
    throw new ApiError(404,"User don't exist !")
   }
   const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid)
   {
    throw new ApiError(401,"Password is incorrect")
   }
   const {accessToken,refreshToken} = await generateAccessandRefreshToken(user._id)
   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
   
   const options ={
    secure: true,
    httpOnly : true,
   }
   return res.status(200).cookie("accessToken",accessToken,options)
   .cookie("refreshToken",refreshToken,options)
   .json(new ApiResponse(200,
    {
        user: loggedInUser,accessToken,refreshToken
    },
    "User Logged In Successfully"
   ))

})

const logOutUser = asyncHandler(async (req,res)=>{
    await User.findByIdAndUpdate(req.user._id,{
        $unset : {refreshToken: 1} // This removes the field from document
    },
    {
        new: true
    })
    const options ={
    secure: true,
    httpOnly : true,
   }
   return res.status(200)
   .clearCookie("accessToken",options)
   .clearCookie("refreshToken",options)
   .json(new ApiResponse(200, {} ,"User Logged Out Successfully"))
})
const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401,"Unauthorized request")
    }
    
    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
       if (!user) {
        throw new ApiError(401,"Refresh Token is Invalid")
       }
    
       if (incomingRefreshToken != user?.refreshToken) {
        throw new ApiError(401,"Refresh Token is expired or Used")
       }
    
       const options = {
        httpOnly: true,
        secure: true
       }
    
        const {accessToken,newRefreshToken} = await generateAccessandRefreshToken(user._id)
    
       return res
            .status(200)
            .cookie("accessToken",accessToken,options)
            .cookie("refreshToken",newRefreshToken,options)
            .json(new ApiResponse(
                200,
                {accessToken,refreshToken : newRefreshToken},
                "Access token refreshed successfuly "
            ))
    
    } catch (error) {
        throw new ApiError(401,error?.message || "invalid Refresh Token")
    }
})
const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword , newPassword} = req.body
    const user =  await User.findById(req.user?._id)
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordValid){
        throw new ApiError(401,"Password is incorrect")
    }
    user.password = newPassword
   await user.save({validateBeforeSave: false})
    return res.status(200).json(new ApiResponse(201,{},"Password is changed Successfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    // const currentUser = req.user
    return res
    .status(200)
    .json(200,req.user,"fetched Successfully")
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const { email,fullName } = req.body
    if (!fullName || !email) {
        throw new ApiError(404,"Email or Full-Name is required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {$set: {
            fullName,
            email: email
        }},
        {new: true}
    ).select("-password")
    return res.status(200).json(new ApiResponse(200,user, "Credentials like FullName and Email Updated Successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path
    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar Path not Accessible")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(500,"Error while Uploading file to Cloudinary")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {avatar : avatar.url}
        },
        {new: true}
    ).select("-password")
    // await user.save({validateBeforeSave: false})
    return res.status(200).json(new ApiResponse(
        200,
        user,
        "Avatar updated Successfully"
    ))
})
const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400,"Cover Image Path not Accessible")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(500,"Error while Uploading file to Cloudinary")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {coverImage : coverImage.url}
        },
        {new: true}
    ).select("-password")
    // await user.save({validateBeforeSave: false})
    return res.status(200).json(new ApiResponse(
        200,
        user,
        "Cover Image updated Successfully"
    ))

})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params
    if (!username?.trim()) {
        throw new ApiError(400,"Username is missing")
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"



            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscriberCount : {
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size : "$subscribedTo"
                },
                isSubscribed : {
                    $cond:{
                        if:{$in: [req.user?._id, "$subscribers.subscriber"]   },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                username:1,
                subscriberCount:1,
                channelsSubscribedToCount:1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email:1
            }
        }
    ])
    if (!channel?.length)
    {
        throw new ApiError(401,"Channel does not exist")
    }
    return res
    .status(200)
    .json(new ApiResponse(200,channel[0],"User channel fetched successfully"))
})

const getWatchHistory = asyncHandler(async (req,res)=>{
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: { $first: "$owner" }
                        }
                    }
                ]
            }
        }
    ]);
    
    return res.status(200).json(new ApiResponse(200, user[0]?.watchHistory || [], "Watch history fetched successfully"));
})
export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
 }
