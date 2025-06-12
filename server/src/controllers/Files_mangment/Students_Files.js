const Files = require("../../models/Files");
const appError = require('../../utils/handelError');
const multer = require("multer");
const path = require('path');
const fs = require("fs");
const axios = require('axios');
const FormData = require('form-data');
const Volunteers = require('../../models/volunteers'); // جلب المخطط
const { PDFDocument } = require('pdf-lib');
const Users = require("../../models/Users");
const crypto = require('crypto'); // لتوليد أسماء عشوائية

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

class VolunteerManager {
    async getAllVolunteers() {
        try {
            return await Volunteers.find();
        } catch (error) {
            console.error('Error fetching volunteers:', error);
            return [];
        }
    }


// async selectVolunteer(file_specialty, isUrgent,file_id) {
//     try {
//         // **جلب جميع المتطوعين النشطين الذين لا يملكون ملفات قيد التنفيذ**
//         const volunteers = await Volunteers.find({
//             activeVolunteer: true,
//             waitingFiles: { $size: 0 } // يجب ألا يكون المتطوع منشغلًا بملف حاليًا
//         });

//         // **تصفية المتطوعين بناءً على التخصص وحالة الاستعجال**
//         let eligible = volunteers.filter(v => {
//             const specialtyMatch = v.specialties.includes(file_specialty); // يجب أن يكون التخصص مطابقًا
//             const urgencyMatch = isUrgent ? v.availableForUrgentFiles : true; // حالة المستعجل

//             return specialtyMatch && urgencyMatch;
//         });

//         if (!eligible.length) {
//             console.log("❌ لا يوجد متطوع متاح لديه نفس التخصص.");
//             return null;
//         }

//         // **اختيار المتطوع الذي لديه أقل عدد من الساعات المنجزة هذا الأسبوع**
//         const minHours = Math.min(...eligible.map(v => v.completedHoursThisWeek));
//         const candidates = eligible.filter(v => v.completedHoursThisWeek === minHours);
//         const selected = candidates[Math.floor(Math.random() * candidates.length)];

//         // **تحديث بيانات المتطوع بعد اختياره**
//         await Volunteers.findByIdAndUpdate(selected._id, {
//             $set: { assignmentDate: new Date() },
//             $inc: { completedHoursThisWeek: 1 },
//             $push: { waitingFiles: file_id } 
//         });

//         console.log(`✅ تم اختيار المتطوع: ${selected.telegramId}`);
//         return selected;
//     } catch (error) {
//         console.error("❌ خطأ أثناء اختيار المتطوع:", error);
//         return null;
//     }
// }

async selectVolunteer(file_specialty, isUrgent, file_id) {
    try {
        // **جلب جميع المتطوعين النشطين الذين لا يملكون ملفات قيد التنفيذ**
        const volunteers = await Volunteers.find({
            activeVolunteer: true,
            waitingFiles: { $size: 0 }
        });

        // **تصفية المتطوعين بناءً على التخصص وحالة الاستعجال**
        let eligible = volunteers.filter(v => {
            const specialties = Array.isArray(v.specialties) ? v.specialties : [];
            const specialtyMatch = specialties.includes(file_specialty);
            const urgencyMatch = isUrgent ? v.availableForUrgentFiles : true;

            return specialtyMatch && urgencyMatch;
        });

        if (!eligible.length) {
            console.log("❌ لا يوجد متطوع متاح لديه نفس التخصص.");
            return null;
        }

        // **اختيار المتطوع الذي لديه أقل عدد من الساعات المنجزة هذا الأسبوع**
        const minHours = Math.min(...eligible.map(v => v.completedHoursThisWeek));
        const candidates = eligible.filter(v => v.completedHoursThisWeek === minHours);
        const selected = candidates[Math.floor(Math.random() * candidates.length)];

        // **تحديث بيانات المتطوع بعد اختياره**
        await Volunteers.findByIdAndUpdate(selected._id, {
            $set: { 
                assignmentDate: new Date(),
                activeVolunteer: false // **جعل المتطوع غير نشط لأنه استلم ملف**
            },
            $inc: { completedHoursThisWeek: 1 },
            $push: { waitingFiles: file_id }
        });

        console.log(`✅ تم اختيار المتطوع: ${selected.telegramId} وأصبح غير متاح.`);
        return selected;
    } catch (error) {
        console.error("❌ خطأ أثناء اختيار المتطوع:", error);
        return null;
    }
}


}

const uploadFile = async (req, res, next) => {
    const {  description, urgent, file_type } = req.body;
    const file = req.file;

    if (!file) {
        return next(appError.create('يجب رفع ملف!', 400, false));
    }

    const filePath = req.file.path;
    const receivedAt = new Date();
    let requiredDuration = urgent ? 3 : 72;
    let deliveredAt = new Date(receivedAt.getTime() + requiredDuration * 60 * 60 * 1000);
    // **إنشاء سجل جديد للملف في قاعدة البيانات**
    const newFile = new Files({
        file_type,
        description,
        assignedUsers:req.currentUser.id,
        uploadedAt: receivedAt,
        receivedAt,
        deliveredAt,
        requiredDuration,
        urgent,
        filePath,
        fileParts: []
    });

    try {
        const savedFile = await newFile.save();
        const file_id = savedFile._id;
        
        // **تقسيم ملف PDF باستخدام `pdfProcessor`**
        const outputFiles = await pdfProcessor.splitPdf(filePath, "temp/output");

        let results = [];
        for (let idx = 0; idx < outputFiles.length; idx++) {
            const volunteer = await volunteerManager.selectVolunteer(file_type, urgent,file_id);
            if (!volunteer) {
                results.push({ part: idx + 1, error: "لا يوجد متطوع متاح لهذا الجزء" });
            } else {
                results.push({
                    part: idx + 1,
                    volunteer: volunteer.telegramId,
                    file_path: outputFiles[idx]
                });

                // **تحديث قاعدة البيانات لكل جزء**
                await Files.findByIdAndUpdate(file_id, {
                    $push: { fileParts: { partName: outputFiles[idx], assignedVolunteer: volunteer._id } }
                });
            }
        }

        res.status(201).json({ 
            status: true, 
            message: "تم رفع وإسناد الملف وأجزائه بنجاح!", 
            file_id, 
            results 
        });

    } catch (error) {
        console.log(error);
        
        return next(appError.create('خطأ في رفع الملف ومعالجته!', 500, false));
    }
};

const receiveProcessedFile = async (req, res) => {
    const file = req.file;
    const { file_id, partName, assignedVolunteer } = req.body;
    console.log(req.body);
    
    if (!file) {
        return res.status(400).json({ error: "لم يتم إرسال ملف معالج من Flask" });
    }

    try {
        const updatedFile = await Files.findByIdAndUpdate(file_id, {
            $push: { 
                fileParts: { 
                    partName, 
                    assignedVolunteer, 
                    status: "pending" 
                } 
            }
        }, { new: true });

        res.status(200).json({ 
            status: true, 
            message: "تم تحديث البيانات وإضافة الجزء الجديد!", 
            updatedFile 
        });

    } catch (error) {
        return res.status(500).json({ error: "حدث خطأ أثناء تحديث بيانات الملف" });
    }
};

const resetVolunteerAssignments = async () => {
    try {
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

        // **جلب جميع المتطوعين الذين لديهم ملفات في `waitingFiles`**
        const volunteers = await Volunteers.find({ waitingFiles: { $exists: true, $ne: [] } });

        let updates = [];

        for (let volunteer of volunteers) {
            let updatedWaitingFiles = [];
            let updatedPendingFiles = [...volunteer.pendingFiles]; // نسخ الملفات الحالية

            // **التحقق من كل ملف في `waitingFiles`**
            for (let fileId of volunteer.waitingFiles) {
                const file = await Files.findById(fileId);
                if (!file) continue; // **إذا لم يتم العثور على الملف، تخطاه**

                // **التأكد من أن الملف قد مر عليه أكثر من 3 أيام**
                if (file.uploadedAt && file.uploadedAt <= threeDaysAgo) {
                    updatedPendingFiles.push(fileId); // نقل الملف إلى `pendingFiles`
                } else {
                    updatedWaitingFiles.push(fileId); // الاحتفاظ به في `waitingFiles`
                }
            }

            // **تحضير التحديثات**
            updates.push({
                updateOne: {
                    filter: { _id: volunteer._id },
                    update: { 
                        $set: { 
                            waitingFiles: updatedWaitingFiles,
                            pendingFiles: updatedPendingFiles,
                            activeVolunteer: updatedWaitingFiles.length === 0 // إذا لم يعد هناك ملفات انتظار، إعادة المتطوع إلى نشط
                        } 
                    }
                }
            });
        }

        // **تنفيذ جميع التحديثات دفعة واحدة**
        if (updates.length > 0) {
            await Volunteers.bulkWrite(updates);
            console.log(`✅ تم تحديث ${updates.length} متطوع.`);
        } else {
            console.log("🔍 لا يوجد متطوعون بحاجة للتحديث.");
        }

    } catch (error) {
        console.error("❌ خطأ أثناء إعادة تعيين المهام:", error);
    }
};

// **تحديث المتطوعين كل ساعتين**
setInterval(resetVolunteerAssignments, 7200000);

class PDFProcessor {
    async splitPdf(inputPdfPath, outputPrefix) {
        try {
            const pdfBytes = fs.readFileSync(inputPdfPath);
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const totalPages = pdfDoc.getPageCount();
            const outputFiles = [];

            if (totalPages < 20) {
                outputFiles.push(await this.savePdfRange(pdfDoc, 0, totalPages, this.generateRandomFilename(1, outputPrefix)));
            } else if (totalPages <= 29) {
                const mid = Math.floor(totalPages / 2);
                outputFiles.push(await this.savePdfRange(pdfDoc, 0, mid, this.generateRandomFilename(1, outputPrefix)));
                outputFiles.push(await this.savePdfRange(pdfDoc, mid, totalPages, this.generateRandomFilename(2, outputPrefix)));
            } else {
                let startPage = 0;
                let partNum = 1;
                while (startPage < totalPages) {
                    let endPage = Math.min(startPage + 10, totalPages);
                    outputFiles.push(await this.savePdfRange(pdfDoc, startPage, endPage, this.generateRandomFilename(partNum, outputPrefix)));
                    partNum++;
                    startPage = endPage;
                }
            }
            return outputFiles.map(file => path.basename(file));

        } catch (error) {
            console.error("Failed to process PDF:", error);
            return [];
        }
    }

    async savePdfRange(originalPdf, start, end, outputPath) {
        const newPdf = await PDFDocument.create();
        for (let i = start; i < end; i++) {
            const [copiedPage] = await newPdf.copyPages(originalPdf, [i]);
            newPdf.addPage(copiedPage);
        }
        const pdfBytes = await newPdf.save();
        fs.writeFileSync(outputPath, pdfBytes);
        return outputPath;
    }

    // **دالة توليد اسم عشوائي بعد الترقيم**
    generateRandomFilename(partNum, outputPrefix) {
        const randomString = crypto.randomBytes(4).toString('hex'); // توليد نص عشوائي قصير
        return `${outputPrefix}_part${partNum}_${randomString}.pdf`; // يحتفظ بالترقيم ويضيف اسمًا عشوائيًا
    }
}


const volunteerManager = new VolunteerManager();
const pdfProcessor = new PDFProcessor();

// fun تستخدم لاضافة المتطوعيا تلقائبا 
const addVolunteers = async (volunteersData) => {
    for (let data of volunteersData) {
        try {
            // **البحث عن المستخدم المتطابق حسب الاسم (إذا كان موجودًا)**
            let user = await Users.findOne({ username: data["name"] });

            if (!user) {
                // **إنشاء مستخدم جديد**
                user = new Users({
                    username: data["name"],
                    email: `${data["name"].replace(/\s+/g, '').toLowerCase()}@example.com`,
                    password: "hashedpassword123",
                    age: "غير محدد",
                    gender: "غير محدد",
                    EducationLevel: "غير محدد",
                    active: true,
                    role: "user",
                    isVolunteer: true
                });
                await user.save();
            }

            // **إعداد كائن المتطوع الجديد**
            const volunteer = new Volunteers({
                userId: user._id,
                telegramId: `${data["name"].replace(/\s+/g, '').toLowerCase()}_telegram`,
                preferredRegistrationTime: data["التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير"] || "غير محدد",
                registrationSection: "غير محدد",
                knownLanguages: [],
                readingInterests: [],
                completedFiles: [],
                pendingFiles: [],
                waitingFiles: [],
                examFilePath: null,
                specialties: data["specialties"] !== "Null" ? [data["specialties"]] : [],
                maxWeeklyHours: data["maxWeeklyHours"] || 5,
                availableForUrgentFiles: data["availableForUrgentFiles"] || false,
                availableDaysForUrgent: data["availableDaysForUrgent"] !== "Null"
                    ? data["availableDaysForUrgent"].split(", ")
                    : [],
                completedHoursThisWeek: data["completedHoursThisWeek"] || 0,
                activeVolunteer: true,
                assignmentDate: data["assignmentDate"] !== "Null" ? new Date(data["assignmentDate"]) : null,
                apologyCount: data["apologyCount"] || 0
            });

            await volunteer.save();
            console.log(`✅ تمت إضافة المتطوع: ${data["name"]}`);
        } catch (error) {
            console.error(`❌ خطأ في إضافة المتطوع ${data["name"]}:`, error);
        }
    }
};
// **استدعاء الدالة بعد جلب البيانات**
const volunteersData = [
    {
        "name": "مارينا داىهو",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "أسماء سمور",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ألمى سمكري",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "أنوار المحمد ",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "بيان مظلوم ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "تقى الشلاح",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "دانية عاشور",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "راما الفرواتي",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "رشا الخضراء ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "رنا اليوسف",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سدرة الحاج حمود ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سدرة الحاج حمود ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سلام طرحها",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سمية رحيباني",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سوسن اسماعيل",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "صبا عزام",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "عبد الظاهر صابرين ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "عبد الله رحمة ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "غيداء عوض",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "فرح السويداني",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "لين زعبوبة",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "منى مكّي",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نجلاء شنير",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ليلا حتى الساعة 6:00 صباحا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نور الهدى محمد المحمود ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نور نتوف",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هبة مواس",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هيا الوهب",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "وسام مولا ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ياسمين الاعوج",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "يمام عودة",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "رولا سفور",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الإثنين",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "بنان عادل شموط",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الإثنين, الثلاثاء, الأربعاء, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "مريم هديه",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الإثنين, الثلاثاء, الأربعاء, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "رنيم دحروج ",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الأحد",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "جودي القاضي ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الأربعاء, الخميس",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نور القاضي ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الأربعاء, الخميس",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "محمد يمان العصيري",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الثلاثاء, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "شيرين موسى",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ميمنه الخطيب",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نسرين البغدادي ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سدرة حموش",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "تغريد الحداد ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سمر السليمان",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الأحد, الإثنين, الثلاثاء, الأربعاء, الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "إيمان كرنبة",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "فرح قره طحان",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "Null",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "الاء حمدان",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "البتول اسماعيل",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "أريج الزعبي",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ليلا حتى الساعة 6:00 صباحا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "رزانابو عبدالله",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "رغد الشيخ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "رغد مظلوم ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "زهراء الصوص",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ساندي عصفور",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سهام طراد ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "شام الحمدان ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "علا شرف الدين",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "علا شرف الدين",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "غالية مازن الحرش",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "لجين تامر",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ميساء بركات",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ندى عرموش",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نور توتونجي",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هند العواك",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هيا السليمان ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ولاء سبتي",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هديل عمار",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الأحد",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "أماني عربي كاتبي",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الأحد, الإثنين, الثلاثاء, الأربعاء, الخميس",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "بيان بريِّز",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الأحد, الثلاثاء",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "زينة الله طلال القاري",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الثلاثاء",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سمر أيوبي أغابانا",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الثلاثاء",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "آلاء نصر المحمد ",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ليلا حتى الساعة 6:00 صباحا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "جنى المويل",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "رانية الكرم ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نسرين هلال الاخرس ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هبه الدهش",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سارة عبد الكريم",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الخميس",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "جيهان ابو شاش ",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نجوى ابراهيم حسن ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "شام الحمصي الطويل ",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "خوله شموط",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الإثنين, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ربى الدهش",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الأحد",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سلام موسى",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الأحد, الإثنين, الثلاثاء, الأربعاء",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "فاطمة ازرق",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الأحد, الإثنين, الثلاثاء, الأربعاء, الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "جودي طربين",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سعاد المنصور",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "محمد مأمون ملص",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "جنى ذيبان ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "حقوق",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "اسراء ناعورة",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "رياضيات",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "شفاء درغام",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "رياضيات",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "مروة محمد",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "رياضيات",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نور بعلبكي",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "رياضيات",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هادية غومخوي",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "رياضيات",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "أميره ناعورة",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "رياضيات",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الخميس",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "رندة الحلبي",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "رياضيات",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "أبرار البوشي",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "رياضيات",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الأحد, الإثنين, الثلاثاء, الأربعاء, الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "يارا سبسوب",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "رياضيات",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "تبارك أحمد بقله ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "حنان الخطيب ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "راما شيخ خميس",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "زين الحمصي",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "زينه شموط",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "شهد كوانيني ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "عمار البوظلي ",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "محمد مجد دكاك",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "محمود الحمد",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نور الهدى الخربوطلي ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نيفين عمر",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هبة المكي",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هداية الله محمد سليم العجي",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ليلا حتى الساعة 6:00 صباحا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هيَا البدوي",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ليلا حتى الساعة 6:00 صباحا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": false,
        "availableDaysForUrgent": "Null",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ربا نزار قباني",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الإثنين, الأربعاء, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "وفاء بني المرجة ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الإثنين, الثلاثاء",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "يمان صباغ",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الإثنين, الثلاثاء, الأربعاء, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هبه المحمد ",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الإثنين, الثلاثاء, الأربعاء, الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "فاديا المصري ",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الأحد",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "غالية طيري",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الأحد, الإثنين, الثلاثاء, الأربعاء, الخميس",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ريم الطّويل ",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الثلاثاء, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هدى المصري ",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الثلاثاء, الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ألمى شبيكة ",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "آمنة هيكل",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "طيف شحرور ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "فاطمة بكار",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ليلا حتى الساعة 6:00 صباحا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "منار بسام بلور",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "مؤمنة حمزة",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "نوره الزعبي ",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "وفاء كنعان ",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ظهرا حتى الساعة 6:00 مسائا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "يمام كسار ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "فاطمه صوان",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "لينة زين",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "هزار فريد الحواصلي ",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ايمان الشهاب ",
        "maxWeeklyHours": 3,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "كل الأوقات مناسبة",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الأحد, الإثنين, الثلاثاء, الأربعاء, الخميس, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "يمنى السيد أحمد ",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ليلا حتى الساعة 6:00 صباحا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الأحد, الإثنين, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "ياسر الشمالي ",
        "maxWeeklyHours": 4,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الأحد, الثلاثاء, الخميس",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "آية بغدادي",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 مساءا حتى الساعة 12:00 ليلا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "سوسن الواوي",
        "maxWeeklyHours": 6,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 12:00 ليلا حتى الساعة 6:00 صباحا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الجمعة",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    },
    {
        "name": "حلا مدور",
        "maxWeeklyHours": 2,
        "التفضيلات الشخصية لأوقات التسجيل مع العلم بأنه سيصلكم ملف 1 للتسجيل خلال الاسبوع بأقصى تقدير": "من الساعة 6:00 صباحا حتى الساعة 12:00 ظهرا",
        "specialties": "قرآن كريم وشعر",
        "availableForUrgentFiles": true,
        "availableDaysForUrgent": "السبت, الخميس",
        "completedHoursThisWeek": 0,
        "هل يسجل حاليا؟": false,
        "assignmentDate": "Null",
        "حالة المتطوع (فعال - متوقف)": true,
        "apologyCount": 0
    }
];  
// addVolunteers(volunteersData);


// عند جاهزية الملف يصل للمستخدم للتنزيل 
const getFileForUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;

    // البحث عن الملف الذي يملكه المستخدم
    const fileEntry = await Files.findOne({ assignedUsers: userId, status: 'completed' });
    
    if (!fileEntry || !fileEntry.filePath) {
      return res.status(404).json({ status: false, message: 'لم يتم العثور على ملف لهذا المستخدم' });
    }

    const originalFilePath = fileEntry.filePath;

    // التحقق من أن الملف موجود
    if (!fs.existsSync(originalFilePath)) {
      return res.status(404).json({ status: false, message: 'الملف غير موجود أو تمت إزالته' });
    }

    res.download(originalFilePath, (err) => {
      if (err) {
        return next(appError.create(err.message, 500, false));
      }
    });

  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};






module.exports = {
    uploadFile,
    upload,
    receiveProcessedFile,
    VolunteerManager,
    PDFProcessor,
    getFileForUser
}