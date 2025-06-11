const express = require('express');
const routes = express.Router();
const Students_FileController = require('../../controllers/Files_mangment/Students_Files')
verfiy_token = require('../../middelWare/verifyToken')
// const {VolunteerManager,PDFProcessor} = require('../../controllers/Files_mangment/Students_Files')

// **إضافة نقطة النهاية إلى `Express`**
const multer = require('multer');




const storage = multer.diskStorage({
    destination: 'temp',
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });


routes.route("/user-file-upload").post(verfiy_token,Students_FileController.upload.single("file"), Students_FileController.uploadFile);
routes.post('/receive_processed_file', upload.single('file'), Students_FileController.receiveProcessedFile);
routes.get('/download-completed-voices/:userId', Students_FileController.getFileForUser);

module.exports = routes ;