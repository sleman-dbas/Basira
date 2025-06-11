const bcryptjs = require('bcryptjs');
const Volunteers = require('../../models/volunteers'); // تأكد من استيراد النماذج بشكل صحيح
const Users = require('../../models/Users');
const appError = require('../../utils/handelError');
const generateJwt = require('../../utils/genrateJWT');
const {generateOTP}  = require('../../utils/generateOTP');
const { sendMail } = require('../../utils/sendMail');
const multer = require("multer");
const path = require('path');
const fs = require("fs");
const XLSX = require('xlsx');

// fluent-ffmpeg
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
        'audio/mpeg', // MP3
        'audio/mp4', // MP4 (يستخدم للصوت والفيديو)
        'audio/x-m4a', // M4A
        'audio/wav', // WAV
        'audio/ogg', // OGG
        'audio/flac', // FLAC
        'audio/aac', // AAC
        'audio/x-ms-wma', // WMA
        'audio/x-matroska' // MKA (Matroska audio)
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('نوع الملف غير مدعوم! فقط ملفات الصوت الشهيرة مسموحة'), false);
    }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // الحد الأقصى لحجم الملف (20MB)
  fileFilter: fileFilter
});



const addVolunteer = async (req, res, next) => {
  try {
    const { email, password, username, EducationLevel, age, gender, studyField, studyYear, telegramId, preferredRegistrationTime, registrationSection, knownLanguages, readingInterests } = req.body;
    const file = req.file;

    if (!file) {
      return next(appError.create('يجب رفع ملف!', 400, false));
    }

    // التحقق مما إذا كان البريد الإلكتروني موجود مسبقًا
    const isExisting = await findUserByEmail(email);
    if (isExisting) {
      return next(appError.create('البريد الإلكتروني موجود بالفعل', 422, false));
    }

    // إنشاء المستخدم الجديد
    const newUser = await createUser(email, password, username, EducationLevel, age, gender, studyField, studyYear);
    if (!newUser || !newUser._id) {
      return next(appError.create('تعذر إنشاء المستخدم الجديد', 400, false));
    }

    // تسجيل المتطوع وربطه بالمستخدم + تخزين مسار الملف
    const newVolunteer = await createVolunteer(newUser._id, file.path, telegramId, preferredRegistrationTime, registrationSection, knownLanguages, readingInterests);
    if (!newVolunteer) {
      return next(appError.create('تعذر إنشاء سجل المتطوع', 400, false));
    }

    // إنشاء رمز OTP وإرساله بالبريد الإلكتروني
    req.app.locals.OTP = generateOTP();
    console.log(req.app.locals.OTP);
    
    await sendMail({ to: email, OTP: req.app.locals.OTP });

    return res.status(201).json({
      status: true,
      message: 'تمت العملية بنجاح! يجب أن تتلقى بريدًا إلكترونيًا',
      data: { filePath: file.path }
    });

  } catch (err) {
    console.error(err);
    return next(appError.create(err.message || 'حدث خطأ أثناء تنفيذ العملية', 500, false));
  }
};

const createVolunteer = async (userId, filePath, telegramId, preferredRegistrationTime, registrationSection, knownLanguages, readingInterests) => {
    const newVolunteer = new Volunteers({
        userId,
        examFilePath: filePath, // تخزين مسار الملف داخل قاعدة البيانات
        telegramId, // معرف التلغرام
        preferredRegistrationTime, // الوقت المفضل للتسجيل
        registrationSection, // قسم التسجيلات
        knownLanguages, // اللغات التي يجيدها المتطوع
        readingInterests, // مجالات القراءة
        completedFiles: [], // الملفات المنجزة
        pendingFiles: [], // الملفات غير المنجزة
        waitingFiles: [] // الملفات المنتظرة
    });

    try {
        await newVolunteer.save();
        return newVolunteer;
    } catch (error) {
        console.error(error);
        return false;
    }
};

const createUser = async (email, password, username, EducationLevel, age, gender, studyField, studyYear) => {
  try {
    // التحقق من صحة كلمة المرور
    if (!password || typeof password !== 'string') {
      throw appError.create('كلمة المرور غير صالحة أو مفقودة!', 400, false);
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcryptjs.hash(password, 10);

    // إنشاء المستخدم
    const newUser = new Users({
      email,
      password: hashedPassword,
      age,
      EducationLevel,
      username,
      gender,
      studyField,
      studyYear,
      isVolunteer: false
    });

    // حفظ المستخدم في قاعدة البيانات
    await newUser.save();

    // التحقق من وجود معرف المستخدم
    if (!newUser._id) {
      throw appError.create('فشل في إنشاء معرف المستخدم!', 400, false);
    }

    // إنشاء رمز JWT
    const token = await generateJwt({ email: newUser.email, id: newUser._id, username: newUser.username });
    newUser.token = token;
    await newUser.save();

    return newUser;
  } catch (err) {
    console.error(err);
    throw appError.create(err.message || 'حدث خطأ غير متوقع أثناء إنشاء المستخدم', 500, false);
  }
};

const findUserByEmail = async (email) => {
    const user = await Users.findOne({
      email,
    });
    if (!user) {
      return false;
    }
    return user;
};

const displayVolunteerCompletedFiles = async (req, res, next) => {
  try {
    // استخراج معرف المتطوع من الطلب
    const userId = req.params.userId;

    // البحث عن المتطوع في قاعدة البيانات
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'المتطوع غير موجود' });
    }

    // البحث عن سجل المتطوع في قاعدة البيانات
const volunteerRecord = await Volunteers.findOne({ userId: userId }).populate('completedFiles');
    if (!volunteerRecord || !volunteerRecord.completedFiles) {
      return res.status(404).json({ status: false, message: 'لم يتم العثور على ملفات مكتملة لهذا المتطوع' });
    }

    // استخراج البيانات المطلوبة لكل ملف مكتمل
    const completedFiles = volunteerRecord.completedFiles.map(file => ({
      id: file._id,
      title: file.title,
      description: file.description,
      filePath: file.filePath // إضافة المسار الكامل للملف
    }));
    
    // إرسال البيانات إلى العميل
    res.status(200).json({
      status: true,
      message: 'تمت العملية بنجاح، قائمة الملفات المكتملة:',
      data: completedFiles
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

const displayVolunteerCansledFiles = async (req, res, next) => {
  try {
    // استخراج معرف المتطوع من الطلب
    const userId = req.params.userId;

    // البحث عن المتطوع في قاعدة البيانات
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'المتطوع غير موجود' });
    }

    // البحث عن سجل المتطوع في قاعدة البيانات
const volunteerRecord = await Volunteers.findOne({ userId: userId }).populate('pendingFiles');
    if (!volunteerRecord || !volunteerRecord.pendingFiles) {
      return res.status(404).json({ status: false, message: 'لم يتم العثور على ملفات ملغاة لهذا المتطوع' });
    }

    // استخراج البيانات المطلوبة لكل ملف ملغى
    const canceledFiles = volunteerRecord.pendingFiles.map(file => ({
      id: file._id,
      title: file.title,
      description: file.description,
      filePath: file.filePath // إضافة المسار الكامل للملف
    }));

    // إرسال البيانات إلى العميل
    res.status(200).json({
      status: true,
      message: 'تمت العملية بنجاح، قائمة الملفات الملغاة:',
      data: canceledFiles
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

const displayVolunteerWaitingFiles = async (req, res, next) => {
  try {
    // استخراج معرف المتطوع من الطلب
    const userId = req.params.userId;

    // البحث عن المتطوع في قاعدة البيانات
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'المتطوع غير موجود' });
    }

    // البحث عن سجل المتطوع وجلب الملفات المرتبطة به
    const volunteerRecord = await Volunteers.findOne({ userId: userId })
      .populate({
        path: 'waitingFiles',
        select: '_id file_type description filePath fileParts'
      });


    if (!volunteerRecord || !volunteerRecord.waitingFiles.length) {
      return res.status(404).json({ status: false, message: 'لم يتم العثور على ملفات غير مكتملة لهذا المتطوع' });
    }

    console.log(volunteerRecord);

    // استخراج البيانات المطلوبة لكل ملف غير مكتمل
    const waitingFiles = volunteerRecord.waitingFiles.map(file => ({
      id: file._id,
      file_type: file.file_type,
      description: file.description,
      filePath: file.filePath,
      file_name: file.fileParts.length > 0 ? file.fileParts[0].partName : 'غير متوفر'
    }));

    // إرسال البيانات إلى العميل
    res.status(200).json({
      status: true,
      message: 'تمت العملية بنجاح، قائمة الملفات غير المكتملة:',
      data: waitingFiles
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

const displayVolunteerStatistic = async (req, res, next) => {
  try {
    // 1 - الحصول على معرف المتطوع
    const userId = req.params.userId;

    // 2 - البحث عن المتطوع
    const user = await Users.findById(userId);

    // 3 - التحقق مما إذا كان المتطوع موجودًا
    if (!user) {
      return res.status(404).json({ status: false, message: 'المتطوع غير موجود' });
    }

    // 4 - جلب إحصائيات المتطوع
    const volunteerStats = await Volunteers.findOne({ userId });

    if (!volunteerStats) {
      return res.status(404).json({ status: false, message: 'لا توجد بيانات لهذا المتطوع' });
    }

    // 5 - تجهيز الإحصائيات وإرسالها
    const statistics = {
      completedFilesCount: volunteerStats.completedFiles.length,
      pendingFilesCount: volunteerStats.pendingFiles.length,
      waitingFilesCount: volunteerStats.waitingFiles.length,
      examFilePath: volunteerStats.examFilePath || 'لا يوجد ملف اختبار'
    };

    res.status(200).json({ status: true, message: 'تمت العملية بنجاح', data: statistics });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

const exportVolunteerStatistic = async (req, res, next) => {
  try {
    // 1 - الحصول على معرف المتطوع
    const userId = req.params.userId;

    // 2 - البحث عن المتطوع
    const user = await Users.findById(userId);

    // 3 - التحقق مما إذا كان المتطوع موجودًا
    if (!user) {
      return res.status(404).json({ status: false, message: 'المتطوع غير موجود' });
    }

    // 4 - جلب إحصائيات المتطوع
    const volunteerStats = await Volunteers.findOne({ userId });

    if (!volunteerStats) {
      return res.status(404).json({ status: false, message: 'لا توجد بيانات لهذا المتطوع' });
    }

    // 5 - تجهيز الإحصائيات مع اسم المستخدم
    const data = [{
      'معرف المستخدم': userId,
      'اسم المستخدم': user.username, // تضمين اسم المستخدم
      'عدد الملفات المكتملة': volunteerStats.completedFiles.length,
      'عدد الملفات المعلقة': volunteerStats.pendingFiles.length,
      'عدد الملفات المنتظرة': volunteerStats.waitingFiles.length,
    }];

    // إنشاء ملف Excel وتحسين تنسيق الجدول
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, {
      header: ['معرف المستخدم', 'اسم المستخدم', 'عدد الملفات المكتملة', 'عدد الملفات المعلقة', 'عدد الملفات المنتظرة'],
      skipHeader: false
    });

    // تحسين عرض الجدول
    worksheet['!cols'] = [
      { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }
    ];

    // إضافة الورقة إلى الملف
    XLSX.utils.book_append_sheet(workbook, worksheet, 'إحصائيات المتطوع');

    // تحديد المسار الصحيح لحفظ الملف
    const filePath = path.join(__dirname, `./volunteer_statistics_${user.username}.xlsx`);
    XLSX.writeFile(workbook, filePath);

    // إرسال الملف للتحميل
    res.download(filePath, `volunteer_statistics_${user.username}.xlsx`, (err) => {
      if (err) {
        return next(new Error('حدث خطأ أثناء تحميل الملف'));
      }
      setTimeout(() => {
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error('خطأ أثناء حذف الملف:', unlinkErr);
        });
      }, 5000);
    });

  } catch (error) {
    return next(new Error(error.message));
  }
};

// عند تسليم الملف لجعال ال status الخاصة بال user completed وجعل الملف اذا كل المتطوعين انهو عملهم ال status الرئيسية completed
const updateFilePartStatus = async (fileId, volunteerId) => {
  try {
    // تحديث حالة القسم الخاص بالمتطوع إلى 'completed'
    await Files.updateOne(
      { _id: fileId, "fileParts.assignedVolunteer": volunteerId },
      { $set: { "fileParts.$.status": "completed" } }
    );

    // جلب الملف للتحقق من جميع أجزائه
    const fileEntry = await Files.findById(fileId);
    
    if (!fileEntry) return;

    // التحقق مما إذا كانت جميع أجزاء الملف مكتملة
    const allPartsCompleted = fileEntry.fileParts.every(part => part.status === "completed");

    if (allPartsCompleted) {
      await Files.updateOne({ _id: fileId }, { $set: { status: "completed" } });
    }

  } catch (error) {
    console.error("خطأ أثناء تحديث حالة القسم:", error.message);
  }
};

// بعد الانتهاء من القراء رفع الملف الصوتي 
const completeFileUpload = async (req, res, next) => {
  try {
    const volunteerId = req.params.userId;
    
    // البحث عن المتطوع وجلب أول ملف في `waitingFiles`
    const volunteer = await Volunteers.findOne({ userId: volunteerId });
    if (!volunteer) {
      return res.status(404).json({ status: false, message: "المتطوع غير موجود" });
    }

    if (!volunteer.waitingFiles.length) {
      return res.status(400).json({ status: false, message: "لا توجد ملفات غير مكتملة للمتطوع" });
    }

    const fileId = volunteer.waitingFiles[0]; // اختيار أول ملف في القائمة
    const filePath = req.file.path;
    
    console.log(filePath);

    // تحديث بيانات المتطوع: إزالة الملف من `waitingFiles` وإضافته إلى `completedFiles`
    await Volunteers.updateOne(
      { userId: volunteerId },
      {
        $pull: { waitingFiles: fileId },
        $push: { completedFiles: fileId }
      }
    );

    // استدعاء تحديث حالة القسم للمتطوع بعد رفع الملف
    await updateFilePartStatus(fileId, volunteerId);

    // في حال جعل الكود لاينتظر الاخر 
    // // تنفيذ التحديث في الخلفية دون تعطيل العملية الرئيسية
    // setImmediate(() => updateFilePartStatus(fileId, volunteerId));


    res.status(200).json({
      status: true,
      message: "تم تحميل الملف وإكمال المهمة بنجاح",
      fileId: fileId,
      filePath: filePath
    });

  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};







module.exports = {
  addVolunteer,
  upload,
  createVolunteer,
  displayVolunteerCompletedFiles,
  displayVolunteerWaitingFiles,
  displayVolunteerStatistic,
  exportVolunteerStatistic,
  displayVolunteerCansledFiles,
  completeFileUpload
};