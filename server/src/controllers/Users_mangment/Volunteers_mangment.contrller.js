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


// const addVolunteer = async (req, res, next) => {
//   try {
//       const { email, password, username, EducationLevel, age, gender, studyField, studyYear } = req.body;
//       const file = req.file; // الملف المرفوع

//       if (!file) {
//           const errors = ['يجب رفع ملف!'];
//           const error = appError.create(errors[0], 400, false, errors);
//               return next(error)
//       }

//       // التحقق مما إذا كان البريد الإلكتروني موجودًا مسبقًا
//       const isExisting = await findUserByEmail(email);
//       if (isExisting) {
//           const errors = ['البريد الإلكتروني موجود بالفعل'];
//           const error = appError.create(errors[0], 422, false, errors);
//               return next(error)
//       }

//       // إنشاء المستخدم الجديد
//       const newUser = await createUser(email, password, username, EducationLevel, age, gender, studyField, studyYear);
//       if (!newUser) {
//           const errors = ['تعذر إنشاء المستخدم الجديد'];
//           const error = appError.create(errors[0], 400, false, errors);
//           return next(error)
//         }
//         console.log(newUser);
        
//       // تسجيل المتطوع وربطه بالمستخدم + تخزين مسار الملف
//       const newVolunteer = await createVolunteer(newUser._id, file.path);
//       if (!newVolunteer) {
//           const errors = ['تعذر إنشاء سجل المتطوع'];
//           const error= appError.create(errors[0], 400, false, errors);
//           return next(error)
//         }

//       // إنشاء رمز OTP وإرساله بالبريد الإلكتروني
//       req.app.locals.OTP = generateOTP();
//       await sendMail({
//           to: email,
//           OTP: req.app.locals.OTP,
//       });

//       return res.status(201).json({
//           status: true,
//           message: 'تمت العملية بنجاح! يجب أن تتلقى بريدًا إلكترونيًا',
//           data: { filePath: file.path } // تضمين المسار في الاستجابة
//       });

//   } catch (err) {
//     console.log(err);
    
//      const  errors =[err.message,'حدث خطأ أثناء تنفيذ العملية']
//        const error = appError.create(errors, 500, false, errors);
//       return next(error)
//     }
// };

// إنشاء سجل المتطوع وربطه بالمستخدم

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

module.exports = { createVolunteer };


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
    //1 take the volunteer id
    const userId = req.params.userId;
    //2 find the volunteer 
    const user = await Users.findById(userId);
    //3 check if the user is found
    if (!user) {
      return res.status(404).json({ status: false, message: 'المتطوع غير موجود' });
    }
    //4 find the statistics to this volunteer
    const statistics = await Volunteers.findOne({ userId: userId });
    // console.log(statistic);
    //5 return completed files statistic to the volunteer
    const completedFilesStatistic = statistics.completedFiles;
    res.status(200).json({ status: true, message: 'تمت العملية بنجاح , احصاحية الملفات المكتملة : ', data: completedFilesStatistic })
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

const displayVolunteerWaitingFiles = async (req, res, next) => {
  try {
    //1 take the volunteer id
    const userId = req.params.userId;
    //2 find the volunteer 
    const user = await Users.findById(userId);
    //3 check if the user is found
    if (!user) {
      return res.status(404).json({ status: false, message: 'المتطوع غير موجود' });
    }
    //4 find the statistics to this volunteer
    const statistics = await Volunteers.findOne({ userId: userId });
    //5 return completed files statistic to the volunteer
    const waitingFilesStatistic = statistics.waitingFiles;
    res.status(200).json({ status: true, message: 'تمت العملية بنجاح , احصائية الملفات غير المكتملة : ', data: waitingFilesStatistic });
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



module.exports = {
  addVolunteer,
  upload,
  displayVolunteerCompletedFiles,
  displayVolunteerWaitingFiles,
  displayVolunteerStatistic,
  exportVolunteerStatistic
};