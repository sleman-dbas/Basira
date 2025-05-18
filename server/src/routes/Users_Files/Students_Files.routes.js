const express = require('express');
const routes = express.Router();
const Students_FileController = require('../../controllers/Files_mangment/Students_Files')

routes.post('/upload', Students_FileController.uploadFile);

module.exports = routes ;