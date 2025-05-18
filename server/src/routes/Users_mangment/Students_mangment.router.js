const express = require('express');
const routes = express.Router();
const authStudnts_controller = require('../../controllers/Users_mangment/Students_mangment.controller')
const authUsers_controller = require('../../controllers/Users_mangment/Users_mangment.controller')
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

routes.route('/register').post(authStudnts_controller.signUpStudnts);



module.exports = routes ;