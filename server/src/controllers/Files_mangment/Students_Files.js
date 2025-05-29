const Files = require("../../models/Files");
const appError = require('../../utils/handelError');
const multer = require("multer");
const path = require('path');
const fs = require("fs");
// إعداد `multer` لرفع الملفات
const storage = multer.diskStorage({
destination: function (req, file, cb) {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
},
filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
}
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',               // PDF
        'application/msword',            // DOC (Word القديم)
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX (Word الحديث)
        'application/vnd.ms-excel',     // XLS (Excel القديم)
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX (Excel الحديث)
        'text/plain',                   // TXT
        'application/rtf',              // RTF
        'application/vnd.ms-powerpoint', // PPT (PowerPoint القديم)
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX (PowerPoint الحديث)
        'application/vnd.oasis.opendocument.text', // ODT
        'application/vnd.oasis.opendocument.spreadsheet' // ODS
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('نوع الملف غير مدعوم! فقط ملفات نصية مسموحة'), false);
    }
};


const upload = multer({
    storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // الحد الأقصى لحجم الملف (50MB)
    fileFilter: fileFilter
});

const uploadFile = async (req, res, next) => {
    const { title, description, urgent } = req.body;
    const file = req.file; // الملف المرفوع
    const filePath = req.file.path;
        if (!file) { // التحقق من وجود الملف
            const errors = ['يجب رفع ملف!'];
            return next(appError.create(errors[0], 400, false, errors));
        }
    // تحديد وقت استلام الملف
    const receivedAt = new Date();

    // حساب وقت التسليم بناءً على حالة الاستعجال
    let requiredDuration = urgent ? 3 : 72; // المستعجل: 3 ساعات، غير المستعجل: 3 أيام
    let deliveredAt = new Date(receivedAt.getTime() + requiredDuration * 60 * 60 * 1000); // حساب وقت التسليم
  
    const newFile = new Files({
        title,
        description,
        uploadedAt: receivedAt,
        receivedAt,
        deliveredAt,
        requiredDuration,
        urgent,
        filePath
    });
  
    try {
        await newFile.save();
        return res.status(201).json({ status: true, message: 'File uploaded successfully!', data: newFile });
    } catch (error) {
        console.log(error);
        const errors = ['Unable to upload file'];
        const errorObj = appError.create(errors[0], 400, false, errors);
        return next(errorObj);
    }
  };
  
module.exports = {
    uploadFile,
    upload
}