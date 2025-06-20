const express = require('express');
const routes = express.Router();
const employeeMangmentController = require('../../controllers/Employee_mangment.js/employee.controller')
const authorize = require('../../middelWare/allowedToJs')
const verifyToken = require('../../middelWare/verifyToken')


// routes.route('/get-all-volunteers').get(verifyToken,authorize("read",'users'),employeeMangmentController.getAllVolunteers);
routes.route('/get-all-volunteers').get(verifyToken,employeeMangmentController.getAllVolunteers);
routes.route('/delete-volunteer/:userId').delete(verifyToken,employeeMangmentController.deleteVolunteer);
routes.route('/change-active-status/:userId').put(verifyToken,employeeMangmentController.changeActiveStatus);
routes.route("/create-news").post(verifyToken,employeeMangmentController.upload.single("file"), employeeMangmentController.createNews);
routes.route("/update-news/:newId").put(verifyToken,employeeMangmentController.upload.single("file"),employeeMangmentController.updateNews);
routes.route("/delete-news/:newId").delete(verifyToken,employeeMangmentController.deleteNews);
routes.route("/get-all-news").get(verifyToken,employeeMangmentController.getAllNews);
routes.route("/get-single-new/:newId").get(verifyToken,employeeMangmentController.getSingleNew);
routes.route('/display-all-volunteers-statistic').get(verifyToken,employeeMangmentController.displayAllVolunteersStatistics);
routes.route('/export-all-volunteers-statistic').get(verifyToken,employeeMangmentController.exportAllVolunteersStatistics);
routes.route('/display-all-UrgentFiles').get(verifyToken,authorize("قراءة","ملفات"),employeeMangmentController.getUrgentFiles);
routes.route('/add-file-forVolunteers').post(verifyToken,employeeMangmentController.assignPartToVolunteer);
routes.route("/getVolunteerStatsByName").get(verifyToken,employeeMangmentController.getVolunteerStatsByName)
routes.route("/getVolunteerInfoByName").get(verifyToken,employeeMangmentController.getVolunteerInfoByName)

module.exports = routes;