const express = require('express');
const routes = express.Router();
const Students_FileController = require('../../controllers/Files_mangment/Students_Files')

routes.route("/user-file-upload").post(Students_FileController.upload.single("file"), Students_FileController.uploadFile);

module.exports = routes ;