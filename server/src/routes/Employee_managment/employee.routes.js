const express = require('express');
const routes = express.Router();
const employeeMangmentController = require('../../controllers/Employee_mangment.js/employee.controller')


routes.route('/get-all-volunteers').get(employeeMangmentController.getAllVolunteers);
routes.route('/delete-volunteer/:userId').delete(employeeMangmentController.deleteVolunteer);
routes.route('/change-active-status/:userId').get(employeeMangmentController.changeActiveStatus);
routes.route("/create-news").post(employeeMangmentController.upload.single("file"), employeeMangmentController.createNews);
routes.route("/delete-news/:newId").delete(employeeMangmentController.deleteNews);
routes.route("/get-all-news").get(employeeMangmentController.getAllNews);
routes.route("/get-single-new/:newId").get(employeeMangmentController.getSingleNew);
module.exports = routes;