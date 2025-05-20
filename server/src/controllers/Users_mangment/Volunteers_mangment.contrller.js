const bcryptjs = require('bcryptjs');
const Volunteers = require('../../models/volunteers'); // تأكد من استيراد النماذج بشكل صحيح
const Users = require('../../models/Users');
const appError = require('../../utils/handelError');
const generateJwt = require('../../utils/genrateJWT');
const {generateOTP}  = require('../../utils/generateOTP');
const { sendMail } = require('../../utils/sendMail');
const multer = require("multer");
const path = require('path');

const addVolunteer = async (req, res, next) => {
    const { email, password, username, EducationLevel, age, gender, studyField, studyYear } = req.body;

    // التحقق مما إذا كان البريد الإلكتروني موجودًا مسبقًا
    const isExisting = await findUserByEmail(email);
    if (isExisting) {
        const errors = ['البريد الإلكتروني موجود بالفعل'];
        const error = appError.create(errors[0], 422, false, errors);
        return next(error);
    }

    // إنشاء المستخدم الجديد
    const newUser = await createUser(email, password, username, EducationLevel, age, gender, studyField, studyYear);
    if (!newUser) {
        const errors = ['تعذر إنشاء المستخدم الجديد'];
        const error = appError.create(errors[0], 400, false, errors);
        return next(error);
    }

    // تسجيل المتطوع وربطه بالمستخدم
    const newVolunteer = await createVolunteer(newUser._id);
    if (!newVolunteer) {
        const errors = ['تعذر إنشاء سجل المتطوع'];
        const error = appError.create(errors[0], 400, false, errors);
        return next(error);
    };


    req.app.locals.OTP = generateOTP();
    await sendMail({
        to: email,
        OTP: req.app.locals.OTP,
    });

    return res.status(201).json({ status: true, message: 'تمت العملية بنجاح! يجب أن تتلقى بريدًا إلكترونيًا', data: null });
};

// إنشاء سجل المتطوع وربطه بالمستخدم
const createVolunteer = async (userId) => {
    const newVolunteer = new Volunteers({
      userId,
      completedFiles: [], // الملفات المنجزة
      pendingFiles: [], // الملفات غير المنجزة
      waitingFiles: [] // الملفات المنتظرة
    });
  
    try {
      await newVolunteer.save();
      return newVolunteer;
    } catch (error) {
      console.log(error);
      return false;
    }
};

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
    next(appError.create(error.message, 400, false));
  }
};

const deleteVolunteer = async (req, res, next) => {
  const userId = req.params.userId;
  try {
    const deletedVolunteer = await Users.findByIdAndDelete(userId);
    res.status(200).json();
  } catch (error) {
    next(appError.create(error.message, 400, false));
  }
};

const changeActiveStatus = async (req, res, next) => {
  const userId = req.params.userId;
  try {
    const changedStatusUser = await Users.findById(userId);
    changedStatusUser.active = true;
    await changedStatusUser.save();
  } catch (error) {
    next(appError.create(error.message, 400, false));
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
  findUserByEmail,
  getAllVolunteers,
  deleteVolunteer,
  changeActiveStatus
}