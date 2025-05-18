const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new mongoose.Schema({
    title: { type: String, required: true }, // عنوان الملف
    description: { type: String }, // وصف الملف
    uploadedAt: { type: Date, default: Date.now }, // تاريخ رفع الملف
    completedBy: { type: Schema.Types.ObjectId, ref: 'Volunteers' }, // المتطوع الذي أنجزه
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' }, // حالة الملف
    receivedAt: { type: Date, required: true }, // وقت استلام الملف
    deliveredAt: { type: Date }, // وقت تسليم الملف
    requiredDuration: { type: Number, required: true }, // المدة المطلوبة لإنجاز المهمة
    urgent: { type: Boolean, default: false } // هل الملف مستعجل؟
});

let Files = mongoose.model('Files', fileSchema, 'files');

module.exports = Files ;