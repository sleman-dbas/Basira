const express = require('express');
const routes = express.Router();
const dashboard_usermangment_controller = require('../../controllers/Dashboard_managment/Dashboard.controller')
const authorize = require('../../middelWare/allowedToJs')
const verifyToken = require('../../middelWare/verifyToken')

routes.route("/users/:id/permissions").put(verifyToken,authorize('update', 'permissions'),dashboard_usermangment_controller.updatePermission)
routes.route('/users/:id').put(verifyToken,authorize('update', 'role'),dashboard_usermangment_controller.updateUser)
routes.route("/suspendedUser/:userId").post(verifyToken,authorize('update', 'suspendUsers'),dashboard_usermangment_controller.suspendedUser)



module.exports = routes;