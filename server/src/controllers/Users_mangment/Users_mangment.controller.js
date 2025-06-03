const bcryptjs = require('bcryptjs');
const { generateOTP } = require("../../utils/generateOTP");
const { sendMail } = require("../../utils/sendMail");
const  User = require('../../models/Users');
const generateJwt = require('../../utils/genrateJWT');
const fs = require('fs');
const path = require('path');
const appError = require('../../utils/handelError');
const Users = require('../../models/Users');
 

module.exports.login = async (req,res,next)=>{
  const {email,password} = req.body
  if(!email&&!password){
    const errors = ['email and password are required']
      const error = appError.create(errors[0],401,false,errors)
      return next(error)
  }
  
  
  const user = await User.findOne({email:email})
  
  if(!user){
    const errors = ['user not found']
      const error = appError.create(errors[0],422,false,errors)
      return next(error)
  }

  if(user.active == false){
    const errors = ['User not verified']
      const error = appError.create(errors[0],401,false,errors)
      return next(error)
  }
  const matchedPassword = await bcryptjs.compare(password,user.password) 
    
  if(user && matchedPassword){
      const token = await generateJwt({email:user.email, id:user._id ,username:user.username})

        user.token=token;

        await user.save();
        
      return res.status(200).json({status:true,message:"SUCCSESS",data:{user}})
  }else{
      const errors = ['wrong password','something wrong'] 
      const error = appError.create(errors[0],302,false)
      return next(error)
  }
}; 
 
const findUserByEmail = async (email) => {
  const user = await User.findOne({
    email,
  });
  if (!user) {
    return false;
  }
  return user;
};

const createUser = async (email,password,username,EducationLevel,age,gender,studyField,studyYear) => {
    
  const hashedPassword =  bcryptjs.hashSync(password,10);
    
  const newUser = new User({
    email,
    password: hashedPassword,
    age,
    EducationLevel,
    username,
    gender,
    studyField,
    studyYear
  });
  if (!newUser) {
    return false;
  }
  try {

    const token = await generateJwt({email:newUser.email, id:newUser._id,username:newUser.username })
    newUser.token = token
    newUser.save();
    return newUser;
  } catch (error) {
    console.log(error);
    return false;
  }
};

module.exports.generateOTP = async (req,res,next)=>{
  const {email} = req.body
  req.app.locals.OTP =  generateOTP();
  console.log(req.app.locals.OTP);
  
  await sendMail({
    to: email,
    OTP: req.app.locals.OTP,
  });
  res.status(201).send({status:true,message:"you should receive a mail"})  
};

module.exports.verifyOTP = async (req,res,next)=>{
  const {email,code} = req.body
  console.log(email,code);
  
  const user = await Users.findOne({email:email},"_id FullName username email Nationality CurrentAddress Bios profile EducationLevel age gender Vibe token birthday ")
  
  if(!user){
    const errors = ['user not found']
    const error = appError.create(errors[0],302,false,errors)
    return next(error)
  }

  if((req.app.locals.OTP) === (code)){
    req.app.locals.OTP = null ;
    req.app.locals.resetSesstion = true
 
      user.active = true ; 
      await user.save();

    return res.status(201).json({status:true,message:'Verify successfully!',data:{user}});
  }
  const errors = ['Invalid OTP']
  const error = appError.create(errors[0],422,false,errors)
  return next(error)
};

module.exports.updatedUser = async (req, res, next) => {
  const { first_name, last_name, username, Bios, address, links, gender, mobile } = req.body;
  const currentUser = await User_model.findById(req.currentUser.id);
  const link = JSON.parse(links);
  if (!currentUser) {
      const errors = ['user not found', 'unauthorized'];
      const error = appError.create(errors[0], 302, false, errors);
      return next(error);
  }
  let profile = currentUser.profile;
  if (req.file) {
      if (currentUser.profile && currentUser.profile !== 'uploads/profile.png') {
          const oldProfilePath = path.join(__dirname, '..', currentUser.profile);
          fs.access(oldProfilePath, fs.constants.F_OK, (err) => {
              if (!err) {
                  fs.unlink(oldProfilePath, (err) => {
                      if (err) {
                          console.error('Failed to delete old profile:', err);
                      } else {
                          console.log('Old profile deleted successfully');
                      }
                  });
              } else {
                  console.log('Old profile does not exist, skipping deletion');
              }
          });
      }
      profile = `uploads/${req.file.filename}`;
  }
  const fieldsToUpdate = {
      first_name,
      last_name,
      username,
      profile,
      Bios,
      address,
      links: link,
      gender,
      mobile
  };
  const user = await User_model.findByIdAndUpdate(req.currentUser.id, fieldsToUpdate, { new: true });
  if (!user) {
      const errors = ['user not found', 'unauthorized'];
      const error = appError.create(errors[0], 302, false, errors);
      return next(error);
  }
  const userObject = user.toObject();
  userObject.links = userObject.links.map(link => {
      const { _id, ...rest } = link;
      return rest;
  });
  delete userObject.token;
  delete userObject.password;
  res.status(200).json({
      status: true,
      message: 'success',
      data: userObject
  });
};

module.exports.resetPassword = async (req, res,next) => {

  try {
    if(!req.app.locals.resetSesstion){
      const errors = ['Session expired']
      const error = appError.create(errors[0],440,false,errors)
      return next(error)      
    }
    const {email,newpassword} = req.body

    try {
      const user = await User_model.findOne({email:email})
      if (!user) {
        const errors = ['the email doesnt exist']
        const error = appError.create(errors[0],302,false,errors)
          return next(error)
      }
          bcryptjs.hash(newpassword,10)
            .then(hashedPassword=>{
              User_model.updateOne({email:user.email},{password:hashedPassword})
                .then(()=>{
                  req.app.locals.OTP = null ;
                  req.app.locals.resetSesstion = false ; 
                  return res.status(201).send({status:true,message:"Record update ...!"})
                })
                .catch((err)=>{
                  const errors = [err]
                  const error = appError.create(errors[0],500,false,errors)
                  return next(error)
                })
            })
            .catch((err)=>{
              const errors = ['Enable to hash password',err]
              const error = appError.create(errors[0],500,false,errors)
              return next(error)
            })
    } catch (err) {
      const errors = [err]
      const error = appError.create(errors[0],500,false,errors)
      return next(error)    
    }
  } catch (err) {
    const errors = [err]
    const error = appError.create(errors[0],500,false,errors)
    return next(error)     
  }
};

module.exports.logout = async (req,res,next)=>{
  const user = await User_model.findById(req.currentUser.id)
  
  if(!user){
    const errors = ['user not found']
    const error = appError.create(errors[0],302,false,errors)
    return next(error)
  }
  user.token = null ; 
  user.save();
  res.status(200).send({status:true,message:"SUCCSESS",data:null})
};

//we use this api for restpassword
module.exports.checkOTP = async(req,res,next)=>{
  const {email,code} = req.body
  const user = await User_model.findOne({email:email})
  
  if(!user){
    const errors = ['user not found']
    const error = appError.create(errors[0],302,false,errors)
    return next(error)
  }  
  
  if((req.app.locals.OTP) === (code)){
    req.app.locals.OTP = null ;
    req.app.locals.resetSesstion = true

  
    return res.status(201).json({status:true,message:'Verify successfully!',data:null});
  }
  const errors = ['Invalid OTP']
  const error = appError.create(errors[0],422,false,errors)
  return next(error)
};

module.exports.getUserByEmail = async (req,res,next)=>{
  const {email} = req.body
  const user = await User_model.findOne({email:email});
  if (!user) {
    const errors = ['the email doesnt exist']
    const error = appError.create(errors[0],302,false,errors)
      return next(error)
  } 
  return res.status(200).json({status:true,message:'success!',data:{_id:user.id,profile:user.profile,username:user.username,email:user.email}});
};

module.exports.education_levels = async (req,res,next) => {
 levels = [
   "Primary School",
   "High School",
   "Bachelor's Degree",
   "Master's Degree",
   "BHD"
 ]

 res.status(200).json({status:true,message:"success....!",data:levels});

};

module.exports.education_levels = async (req,res,next) => {
    levels = [
      "Primary School",
      "High School",
      "Bachelor's Degree",
      "Master's Degree",
      "BHD"
    ]
   
    res.status(200).json({status:true,message:"success....!",data:levels});
   
};
   
