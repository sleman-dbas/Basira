const express = require('express');
const routes = express.Router();
const employeeMangmentController = require('../../controllers/Employee_mangment.js/employee.controller')


routes.route('/get-all-volunteers').get(employeeMangmentController.getAllVolunteers);
routes.route('/delete-volunteer/:userId').delete(employeeMangmentController.deleteVolunteer);
routes.route('/change-active-status/:userId').get(employeeMangmentController.changeActiveStatus);

module.exports = routes;