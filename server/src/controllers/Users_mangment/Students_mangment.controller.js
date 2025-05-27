const bcryptjs = require('bcryptjs');
const { generateOTP } = require("../../utils/generateOTP");
const { sendMail } = require("../../utils/sendMail");
const  Users = require('../../models/Users');
const generateJwt = require('../../utils/genrateJWT');
const fs = require('fs');
const path = require('path');
const appError = require('../../utils/handelError');


module.exports.signUpStudnts = async (req, res,next) => {
  const { email, password , username,EducationLevel,age,gender, studyField, studyYear } = req.body;
//   let  profile = `uploads/${req.file.filename}`;
    console.log(email);
    
  const isExisting = await findUserByEmail(email);
  if (isExisting) {
    const errors = ['the email is already exist']
    const error = appError.create(errors[0],422,false,errors)
    return next(error)
  }
  const newUser = await createUser(email,password,username,EducationLevel,age,gender,studyField,studyYear);
  if (!newUser) {
    const errors = ['Unable to create new user']
    const error = appError.create(errors[0],400,false,errors)
    return next(error)
  }
  // req.app.locals.OTP =  generateOTP();
  // console.log(req.app.locals.OTP );
  
  // await sendMail({
  //   to: email,
  //   OTP: req.app.locals.OTP,
  // });
  return res.status(201).json({status:true,message:'success..! ',data:newUser});

};  

const findUserByEmail = async (email) => {
  const user = await Users.findOne({
    email,
  });
  if (!user) {
    return false;
  }
  return user;
};

const createUser = async (email,password,username,EducationLevel,age,gender,studyField,studyYear) => {
    
  const hashedPassword =  bcryptjs.hashSync(password,10);
    
  const newUser = new Users({
    email,
    password: hashedPassword,
    age,
    EducationLevel,
    username,
    gender,
    studyField,
    studyYear,
    active:true
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






