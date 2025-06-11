const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const volunteerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true }, 
    telegramId: { type: String, required: true },
    preferredRegistrationTime: { type: String }, 
    registrationSection: { type: String }, 
    knownLanguages: [{ type: String }], 
    readingInterests: [{ type: String }], 

    completedFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Files' }], 
    pendingFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Files' }], 
    waitingFiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Files' }], 

    examFilePath: { type: String }, 
    specialties: [{ type: String, default: ['Null'] }], // الاختصاصات الخاصة
    maxWeeklyHours: { type: Number, default: 5 }, // عدد الساعات التي يمكن تخصيصها
    availableForUrgentFiles: { type: Boolean, default: false }, // هل المتطوع يستطيع تسجيل ملفات مستعجلة؟
    availableDaysForUrgent: [{ type: String }], // الأيام المتاحة للملفات المستعجلة
    completedHoursThisWeek: { type: Number, default: 0 }, // عدد الساعات المنجزة هذا الأسبوع
    activeVolunteer: { type: Boolean, default: true }, // حالة المتطوع (فعال - متوقف)
    assignmentDate: { type: Date, default: null }, // تاريخ إسناد آخر ملف
    apologyCount: { type: Number, default: 0 } // عدد مرات الاعتذار
});

const Volunteers = mongoose.model('Volunteers', volunteerSchema, 'volunteers');
module.exports = Volunteers;
