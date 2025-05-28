const express = require('express');
const routes = express.Router();
const employeeMangmentController = require('../../controllers/Employee_mangment.js/employee.controller')
const authorize = require('../../middelWare/allowedToJs')
const verifyToken = require('../../middelWare/verifyToken')


routes.route('/get-all-volunteers').get(verifyToken,authorize("read",'users'),employeeMangmentController.getAllVolunteers);
routes.route('/delete-volunteer/:userId').delete(employeeMangmentController.deleteVolunteer);
routes.route('/change-active-status/:userId').get(employeeMangmentController.changeActiveStatus);
routes.route('/display-all-volunteers-statistic').get(employeeMangmentController.displayAllVolunteersStatistics);
routes.route('/export-all-volunteers-statistic').get(employeeMangmentController.exportAllVolunteersStatistics);

module.exports = routes;