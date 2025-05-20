const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const volunteerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true }, // ربط المستخدم بالمتطوع
    completedFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Files' }], // الملفات المنجزة
    pendingFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Files' }], // الملفات غير المنجزة
    waitingFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Files' }],// الملفات المنتظرة
    examFilePath: {
        type: String
    }
});

let Volunteers = mongoose.model('Volunteers', volunteerSchema, 'volunteers');
module.exports =  Volunteers ;