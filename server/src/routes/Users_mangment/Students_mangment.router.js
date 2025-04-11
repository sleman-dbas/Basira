const express = require('express');
const routes = express.Router();
const auth_controller = require('../../controllers/Users_mangment/Students_mangment.controller')
const verify_token  = require('../../middelWare/verifyToken')
const {localvariables} = require('../../utils/generateOTP')
// const multer = require('multer')
// const appError = require('../utils/handleError');
// const checkSuspendStatus = require('../middleWare/suspendedUsers');

// const diskStorage = multer.diskStorage({
//     destination: function(req,file,cb){
//         console.log('file',file)
//         cb(null,'uploads')
//     },
//     filename:function(req,file,cb){
//         const ext = file.mimetype.split('/')[1]
//         const fileName = `user-${Date.now()}.${ext}`
        
//         cb(null,fileName)
//     }
// })
// const fileFilter = (req,file,cb)=>{
//     const imageType = file.mimetype.split('/')[0]
    
//     if(imageType == 'image' ){
//         return cb(null,true)
//     }else{
//         const errors = ['file must be an image']
//         return cb(appError.create(errors[0],400,false,errors))
//     }
// } 
// const uploads = multer({
//     storage:diskStorage,
//     fileFilter:fileFilter
// })
// const upload = multer().any(); 

routes.route('/register').post(auth_controller.signUpUser);
// routes.route('/login').post(auth_controller.login);
// routes.route('/generateOTP').post(localvariables,auth_controller.generateOTP);
// routes.route('/checkOTP').post(auth_controller.checkOTP);
// routes.route('/verifyOTP').post(auth_controller.verifyOTP);
// routes.route('/updateUser').post(verify_token,checkSuspendStatus,uploads.single('profile'),auth_controller.updatedUser);
// routes.route('/resetPassword').post(auth_controller.resetPassword);
// routes.route('/forgetPassword').post(auth_controller.generateOTP);
// routes.route('/getUserByEmail').post(auth_controller.getUserByEmail);
// routes.route('/logout').post(verify_token,auth_controller.logout);
// routes.route('/education_levels').get(verify_token,auth_controller.education_levels);
// routes.route('/Vibe').get(verify_token,auth_controller.Vibe);
// routes.route('/getNationality').get(verify_token,auth_controller.getNationality);


module.exports = routes ;