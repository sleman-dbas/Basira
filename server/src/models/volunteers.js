const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const volunteerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true }, // ربط المستخدم بالمتطوع
    completedFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Files' }], // الملفات المنجزة
    pendingFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Files' }], // الملفات غير المنجزة
    waitingFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Files' }], // الملفات المنتظرة
    examFilePath: { type: String }, // مسار ملف الاختبار
    telegramId: { type: String, required: true }, // معرّف التلغرام
    preferredRegistrationTime: { type: String }, // الوقت المفضل للتسجيل
    registrationSection: { type: String }, // قسم التسجيلات
    knownLanguages: [{ type: String }], // اللغات التي يجيدها المتطوع (يمكن اختيار أكثر من لغة)
    readingInterests: [{ type: String }] // مجالات القراءة (يمكن اختيار أكثر من مجال)
});

let Volunteers = mongoose.model('Volunteers', volunteerSchema, 'volunteers');
module.exports = Volunteers;
