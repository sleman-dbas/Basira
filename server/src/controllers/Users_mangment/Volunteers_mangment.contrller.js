const bcryptjs = require('bcryptjs');
const Volunteers = require('../../models/volunteers'); // تأكد من استيراد النماذج بشكل صحيح
const Users = require('../../models/Users');
const appError = require('../../utils/handelError');
const generateJwt = require('../../utils/genrateJWT');
const {generateOTP}  = require('../../utils/generateOTP');
const { sendMail } = require('../../utils/sendMail');


module.exports.signUpVolunteer = async (req, res, next) => {
  const { email, password, username, EducationLevel, age, gender, studyField, studyYear } = req.body;

  console.log(email);

  // التحقق مما إذا كان البريد الإلكتروني موجودًا مسبقًا
  const isExisting = await findUserByEmail(email);
  if (isExisting) {
    const errors = ['The email already exists'];
    const error = appError.create(errors[0], 422, false, errors);
    return next(error);
  }

  // إنشاء المستخدم الجديد
  const newUser = await createUser(email, password, username, EducationLevel, age, gender, studyField, studyYear);
  if (!newUser) {
    const errors = ['Unable to create new user'];
    const error = appError.create(errors[0], 400, false, errors);
    return next(error);
  }

  // تسجيل المتطوع مع ربطه بالمستخدم
  const newVolunteer = await createVolunteer(newUser._id);
  if (!newVolunteer) {
    const errors = ['Unable to create volunteer record'];
    const error = appError.create(errors[0], 400, false, errors);
    return next(error);
  }

  // تحديث سجل الملف لربط المتطوع به
//   const updatedFile = await updateFileAssignment(fileId, newVolunteer._id, receivedAt, requiredDuration);
//   if (!updatedFile) {
//     const errors = ['Unable to assign file'];
//     const error = appError.create(errors[0], 400, false, errors);
//     return next(error);
//   }

  req.app.locals.OTP = generateOTP();
  console.log(req.app.locals.OTP);

  await sendMail({
    to: email,
    OTP: req.app.locals.OTP,
  });

  return res.status(201).json({ status: true, message: 'Success..! You should receive a mail', data: null });
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
  

const createUser = async (email,password,username,EducationLevel,age,gender,studyField,studyYear) => {
    
  const hashedPassword =  bcryptjs.hashSync(password,10);
    
  const newUser = new Users({
    email,
    password: hashedPassword,
    age,
    EducationLevel,
    username,
    gender,
    studyField,
    studyYear,
    isVolunteer:true
  });
  if (!newUser) {
    return false;
  }
  try {

    const token = await generateJwt({email:newUser.email, id:newUser._id,username:newUser.username })
    newUser.token = token
    await newUser.save();
    return newUser;
  } catch (error) {
    console.log(error);
    return false;
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
