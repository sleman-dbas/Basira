const express = require('express');
const routes = express.Router();
const dashboard_usermangment_controller = require('../../controllers/Dashboard_managment/Dashboard.controller')
const authorize = require('../../middelWare/allowedToJs')
const verifyToken = require('../../middelWare/verifyToken')

routes.route("/users/:id/permissions").put(verifyToken,authorize('update', 'permissions'),dashboard_usermangment_controller.updatePermission)
routes.route('/users/:id').put(verifyToken,authorize('update', 'role'),dashboard_usermangment_controller.updateUser)
routes.route("/suspendedUser/:userId").post(verifyToken,authorize('update', 'suspendUsers'),dashboard_usermangment_controller.suspendedUser)
routes.route("/getAllUsers").get(verifyToken,authorize('read', 'users'),dashboard_usermangment_controller.getAllUsers)
routes.route("/getStatistics").get(verifyToken,authorize('read', 'statsic'),dashboard_usermangment_controller.getStatistics)
routes.route("/search").get(verifyToken,authorize('read', 'users'),dashboard_usermangment_controller.getUserByPartialNameOrEmail)
routes.route("/getInactiveVolunteers").get(verifyToken,authorize('read', 'volunterrs'),dashboard_usermangment_controller.getInactiveVolunteers)
routes.route("/toggleVolunteerStatus/:userId").put(verifyToken,authorize('update', 'volunterrs'),dashboard_usermangment_controller.toggleVolunteerStatus)
routes.route("/deleteVolunteer/:userId").delete(verifyToken,authorize('delete', 'volunterrs'),dashboard_usermangment_controller.deleteVolunteer)
routes.route("/deleteUser/:userId").delete(verifyToken,authorize('delete', 'users'),dashboard_usermangment_controller.deleteUser)



module.exports = routes;