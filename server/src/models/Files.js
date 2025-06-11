const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new mongoose.Schema({
    file_type: { type: String, required: true },
    description: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    receivedAt: { type: Date, required: true },
    deliveredAt: { type: Date },
    requiredDuration: { type: Number, required: true },
    urgent: { type: String, default: "عادي" },
    filePath: { type: String },
    assignedUsers: { type: Schema.Types.ObjectId, ref: 'Users' }, // صاحب الملف 

    fileParts: [{ 
        partName: String, // اسم الجزء المقسم
        assignedVolunteer: { type: Schema.Types.ObjectId, ref: 'Volunteers' }, // المتطوع المكلف بهذا الجزء
        status: { type: String, enum: ['pending', 'completed'], default: 'pending' } // حالة هذا الجزء
    }]
});

let Files = mongoose.model('Files', fileSchema, 'files');

module.exports = Files;
