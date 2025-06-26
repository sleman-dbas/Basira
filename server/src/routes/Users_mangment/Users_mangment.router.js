const express = require('express');
const routes = express.Router();
const authUsers_controller = require('../../controllers/Users_mangment/Users_mangment.controller')
const verify_token  = require('../../middelWare/verifyToken')
const {localvariables} = require('../../utils/generateOTP')


routes.route('/login').post(authUsers_controller.login);
routes.route('/save-token').post(verify_token, authUsers_controller.saveFcmToken);
routes.route('/generateOTP').post(localvariables,authUsers_controller.generateOTP);
routes.route('/checkOTP').post(authUsers_controller.checkOTP);
routes.route('/verifyOTP').post(authUsers_controller.verifyOTP);
// routes.route('/updateUser').post(verify_token,checkSuspendStatus,uploads.single('profile'),authUsers_controller.updatedUser);
routes.route('/resetPassword').post(authUsers_controller.resetPassword);
routes.route('/forgetPassword').post(authUsers_controller.generateOTP);
routes.route('/getUserByEmail').post(authUsers_controller.getUserByEmail);
routes.route('/logout').post(verify_token,authUsers_controller.logout);
routes.route('/education_levels').get(verify_token,authUsers_controller.education_levels);


module.exports = routes ;