const express = require('express');
const routes = express.Router();
const employeeMangmentController = require('../../controllers/Employee_mangment.js/employee.controller')
const authorize = require('../../middelWare/allowedToJs')
const verifyToken = require('../../middelWare/verifyToken')

routes.route("/users/:id/permissions").put(verifyToken,authorize('update', 'permissions'),dashboard_usermangment_controller.updatePermission)



module.exports = routes;