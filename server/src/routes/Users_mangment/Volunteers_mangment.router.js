const express = require('express');
const routes = express.Router();
const authVolunteers_controller = require('../../controllers/Users_mangment/Volunteers_mangment.contrller')
const verify_token  = require('../../middelWare/verifyToken')
const { localvariables } = require('../../utils/generateOTP')
const volunteersMangmentController = require("../../controllers/Users_mangment/Volunteers_mangment.contrller");
const multer = require('multer');
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

routes.route('/add-volunteer').post(volunteersMangmentController.upload.single('file'), volunteersMangmentController.addVolunteer);
// this should be on admin folder 
routes.route('/get-all-volunteers').get(volunteersMangmentController.getAllVolunteers);
routes.route('/delete-volunteer/:userId').delete(volunteersMangmentController.deleteVolunteer);
routes.route('/change-active-status/:userId').get(volunteersMangmentController.changeActiveStatus);

routes.route('/display-volunteer-completed-files/:userId').get(volunteersMangmentController.displayVolunteerCompletedFiles);
routes.route('/display-volunteer-waiting-files/:userId').get(volunteersMangmentController.displayVolunteerWaitingFiles);
routes.route('/stats/:userId').get(volunteersMangmentController.displayVolunteerStatistic);

module.exports = routes ;