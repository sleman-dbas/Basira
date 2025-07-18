const express = require('express');
const routes = express.Router();
const authVolunteers_controller = require('../../controllers/Users_mangment/Volunteers_mangment.contrller')
const verify_token  = require('../../middelWare/verifyToken')
const { localvariables } = require('../../utils/generateOTP')
const volunteersMangmentController = require("../../controllers/Users_mangment/Volunteers_mangment.contrller");
const employeeMangmentController = require('../../controllers/Employee_mangment.js/employee.controller')
const multer = require('multer');
const fs = require('fs')

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      const uploadPath = 'voices/';
      if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath);
      }
      cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
  }
});
const uploadvoice = multer({ storage: storage });
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
routes.route('/get-all-volunteers').get(verify_token,employeeMangmentController.getAllVolunteers);
routes.route('/delete-volunteer/:userId').delete(verify_token,employeeMangmentController.deleteVolunteer);
routes.route('/change-active-status/:userId').get(verify_token,employeeMangmentController.changeActiveStatus);
routes.route('/display-volunteer-completed-files/:userId').get(verify_token,volunteersMangmentController.displayVolunteerCompletedFiles);
routes.route('/display-volunteer-cansled-files/:userId').get(verify_token,volunteersMangmentController.displayVolunteerCansledFiles);
routes.route('/display-volunteer-waiting-files/:userId').get(verify_token,volunteersMangmentController.displayVolunteerWaitingFiles);
routes.route('/display-volunteer-Statistic/:userId').get(verify_token,volunteersMangmentController.displayVolunteerStatistic);
routes.route('/export-volunteer-Statistic/:userId').get(verify_token,volunteersMangmentController.exportVolunteerStatistic);
routes.post('/complete-file/:userId', uploadvoice.single('audioFile'),verify_token, volunteersMangmentController.completeFileUpload);
routes.get('/download/:filename', volunteersMangmentController.downloadFile);


module.exports = routes ;