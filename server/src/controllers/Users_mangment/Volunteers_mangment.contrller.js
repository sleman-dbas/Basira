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
      const { email, password, username, EducationLevel, age, gender, studyField, studyYear } = req.body;
      const file = req.file; // الملف المرفوع

      if (!file) {
          const errors = ['يجب رفع ملف!'];
          return next(appError.create(errors[0], 400, false, errors));
      }

      // التحقق مما إذا كان البريد الإلكتروني موجودًا مسبقًا
      const isExisting = await findUserByEmail(email);
      if (isExisting) {
          const errors = ['البريد الإلكتروني موجود بالفعل'];
          return next(appError.create(errors[0], 422, false, errors));
      }

      // إنشاء المستخدم الجديد
      const newUser = await createUser(email, password, username, EducationLevel, age, gender, studyField, studyYear);
      if (!newUser) {
          const errors = ['تعذر إنشاء المستخدم الجديد'];
          return next(appError.create(errors[0], 400, false, errors));
      }

      // تسجيل المتطوع وربطه بالمستخدم + تخزين مسار الملف
      const newVolunteer = await createVolunteer(newUser._id, file.path);
      if (!newVolunteer) {
          const errors = ['تعذر إنشاء سجل المتطوع'];
          return next(appError.create(errors[0], 400, false, errors));
      }

      // إنشاء رمز OTP وإرساله بالبريد الإلكتروني
      req.app.locals.OTP = generateOTP();
      await sendMail({
          to: email,
          OTP: req.app.locals.OTP,
      });

      return res.status(201).json({
          status: true,
          message: 'تمت العملية بنجاح! يجب أن تتلقى بريدًا إلكترونيًا',
          data: { filePath: file.path } // تضمين المسار في الاستجابة
      });

  } catch (error) {
      return next(appError.create('حدث خطأ أثناء تنفيذ العملية', 500, false, [error.message]));
  }
};

// إنشاء سجل المتطوع وربطه بالمستخدم
const createVolunteer = async (userId, filePath) => {
    const newVolunteer = new Volunteers({
        userId,
        examFilePath: filePath, // تخزين مسار الملف داخل قاعدة البيانات
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

const createUser = async (email, password, username, EducationLevel, age, gender, studyField, studyYear, next) => {
  try {
      // التحقق من صحة كلمة المرور
      if (!password || typeof password !== 'string') {
          const errors = ['كلمة المرور غير صالحة أو مفقودة!'];
          const error = appError.create(errors[0], 400, false, errors);
          return next(error);
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
          const errors = ['فشل في إنشاء معرف المستخدم!'];
          const error = appError.create(errors[0], 400, false, errors);
          return next(error);
      }

      // إنشاء رمز JWT
      const token = await generateJwt({ email: newUser.email, id: newUser._id, username: newUser.username });
      newUser.token = token;
      await newUser.save();

      return newUser;
  } catch (error) {
      const errors = ['حدث خطأ غير متوقع أثناء إنشاء المستخدم'];
      return next(appError.create(errors[0], 500, false, errors));
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

const getAllVolunteers = async (req, res, next) => {
  try {
    const volunteers = await Users.find({ isVolunteer: true });
    return res.status(200).json({ status: true, message: 'All volunteers', data: volunteers });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

const deleteVolunteer = async (req, res, next) => {
  const userId = req.params.userId;
  try {
    const deletedVolunteer = await Users.findByIdAndDelete(userId);
    if (!deletedVolunteer) {
      return res.status(404).json({ status: false, message: 'المتطوع غير موجود' });
    }
    res.status(200).json({ status: true, message: 'تمت عملية الحذف بنجاح', data: null });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

const changeActiveStatus = async (req, res, next) => {
  const userId = req.params.userId;
  try {
    const changedStatusUser = await Users.findById(userId);
    if (!changedStatusUser) {
      return res.status(404).json({ status: false, message: 'المتطوع غير موجود' });
    }
    changedStatusUser.active = true;
    await changedStatusUser.save();
    res.status(200).json({ status: true, message: 'تمت عملية التعديل بنجاح', data: changedStatusUser });
  } catch (error) {
    next(appError.create(error.message, 400, false));
  }
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
// // تحديث سجل الملف لربط المتطوع به
// const updateFileAssignment = async (fileId, volunteerId, receivedAt, requiredDuration) => {
//   try {
//     const updatedFile = await Files.findByIdAndUpdate(fileId, {
//       completedBy: volunteerId,
//       receivedAt,
//       requiredDuration
//     }, { new: true });

//     return updatedFile;
//   } catch (error) {
//     console.log(error);
//     return false;
//   }
// };
module.exports = {
  addVolunteer,
  getAllVolunteers,
  deleteVolunteer,
  changeActiveStatus,
  upload,
  displayVolunteerCompletedFiles,
  displayVolunteerWaitingFiles
};