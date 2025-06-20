const bcryptjs = require('bcryptjs');
const Volunteers = require('../../models/volunteers'); 
const Users = require('../../models/Users');
const News = require("../../models/News.model")
const appError = require('../../utils/handelError');
const multer = require("multer");
const path = require('path');
const fs = require("fs");
const XLSX = require('xlsx');
const Files = require('../../models/Files');
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
      'image/jpeg', // JPEG
      'image/png', // PNG
      'image/gif', // GIF
      'image/webp', // WEBP
      'image/bmp', // BMP
      'image/tiff', // TIFF
      'image/svg+xml' // SVG
  ];

  if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
  } else {
      cb(new Error('نوع الملف غير مدعوم! فقط ملفات الصور الشهيرة مسموحة'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // الحد الأقصى لحجم الملف (20MB)
  fileFilter: fileFilter
});

const getAllVolunteers = async (req, res, next) => {
  try {
    const volunteers = await Volunteers.find()
      .populate('userId', 'username email active') // جلب بيانات المستخدم المرتبطة
      .sort({ availableForUrgentFiles: -1 }) // ترتيب المتطوعين بحيث يأتي من يمكنه التعامل مع الملفات المستعجلة أولاً
      .select('availableDaysForUrgent  waitingFiles joinDate');

    const formattedVolunteers = volunteers.map(volunteer => ({
      userId:volunteer.userId._id,
      username: volunteer.userId.username,
      email: volunteer.userId.email,
      joinDate: volunteer.joinDate,
      active: volunteer.userId.active,
      waitingFilesCount: volunteer.waitingFiles.length,
      availableDaysForUrgent: volunteer.availableDaysForUrgent
    }));

    return res.status(200).json({ 
      status: true, 
      message: 'All volunteers', 
      data: { volunteers: formattedVolunteers, numberOfVolunteers: formattedVolunteers.length } 
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};


const deleteVolunteer = async (req, res, next) => {
  try {
    const userId = req.params.userId;
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
    
    // تبديل الحالة تلقائيًا
    changedStatusUser.active = !changedStatusUser.active;
    await changedStatusUser.save();

    res.status(200).json({ 
      status: true, 
      message: 'تم تغيير حالة المتطوع بنجاح', 
      data: { userId, newStatus: changedStatusUser.active } 
    });
  } catch (error) {
    next(appError.create(error.message, 400, false));
  }
};

// api for news 
const createNews = async (req, res, next) => {
  try {
    const { title, content } = req.body;
    
    const photo = req.file
    let photoPath = null;
    if (photo) {
      photoPath = req.file.path;
    }
    const post = await News.create({
      title,
      content,
      photo: photoPath
    });
    if (!post) {
      return next(appError.create("تعذر إنشاء المنشور", 400, false));
    }
    res.status(201).json({
      status: true,
      message: 'تمت العملية بنجاح',
      data: post
  });
  } catch (error) {
    
    return next(appError.create('حدث خطأ أثناء تنفيذ العملية', 500, false));
  }
};

const updateNews = async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const { newId } = req.params;
    const photo = req.file;

    // جهّز كائن التحديث حسب ما هو متوفّر
    const updateData = {
      ...(title && { title }),
      ...(content && { content }),
      ...(photo && { photo: photo.path })
    };

    const updatedPost = await News.findByIdAndUpdate(
      newId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPost) {
      return next(appError.create("تعذر العثور على المنشور لتحديثه", 404, false));
    }

    res.status(200).json({
      status: true,
      message: 'تم تحديث المنشور بنجاح',
      data: updatedPost
    });
  } catch (error) {
    return next(appError.create('حدث خطأ أثناء تحديث المنشور', 500, false));
  }
};


const deleteNews = async (req, res, next) => {
  try {
    const newId = req.params.newId;
    const newToDelete = await News.findByIdAndDelete(newId);
    if (!newToDelete) {
      return res.status(404).json({ status: false, message: 'المنشور غير موجود' });
    }
    res.status(200).json({
      status: true,
      message: 'تمت العملية بنجاح',
      data: null
    });
  } catch (error) {
    return next(appError.create('حدث خطأ أثناء تنفيذ العملية', 500, false));
  }
};

const getAllNews = async (req, res, next) => {
  try {
    const news = await News.find();
    if (!news) {
      return res.status(404).json({ status: false, message: 'لا يوجد اي منشورات لعرضها' });
    }
    res.status(200).json({
      status: true,
      message: 'تمت العملية بنجاح',
      data: news
    });
  } catch (error) {
    return next(appError.create('حدث خطأ أثناء تنفيذ العملية', 500, false));
  }
};

const getSingleNew = async (req, res, next) => {
  try {
    const newId = req.params.newId;
    const newToGet = await News.findById(newId);
    if (!newToGet) {
      return res.status(404).json({ status: false, message: 'المنشور غير موجود' });
    }
    res.status(200).json({
      status: true,
      message: 'تمت العملية بنجاح',
      data: newToGet
    });
  } catch (error) {
    return next(appError.create('حدث خطأ أثناء تنفيذ العملية', 500, false));
  }
};

// احصائيات المتطوعين 
const displayAllVolunteersStatistics = async (req, res, next) => {
  try {
    // 1 - جلب جميع المتطوعين
    const volunteers = await Volunteers.find().populate("userId", "username active");
    // 2 - التحقق مما إذا كان هناك متطوعون
    if (!volunteers || volunteers.length === 0) {
      return res.status(404).json({ status: false, message: 'لا يوجد متطوعون' });
    }

    // 3 - تجهيز الإحصائيات لكل متطوع
    const statistics = volunteers.map(volunteer => ({
      userId: volunteer.userId._id,
      username: volunteer.userId.username,
      active: volunteer.userId.active,
      completedFilesCount: volunteer.completedFiles.length,
      pendingFilesCount: volunteer.pendingFiles.length,
      waitingFilesCount: volunteer.waitingFiles.length,
    }));

    // 4 - إرسال الإحصائيات
    res.status(200).json({ status: true, message: 'تمت العملية بنجاح', data: {statistics,numberOfVolunteers:statistics.length} });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

const exportAllVolunteersStatistics = async (req, res, next) => {
  try {
    // جلب بيانات المتطوعين مع جلب اسم المستخدم من `Users`
    const volunteers = await Volunteers.find().populate({
      path: 'userId',
      select: 'username'
    });

    if (!volunteers || volunteers.length === 0) {
      return res.status(404).json({ status: false, message: 'لا يوجد متطوعون' });
    }

    // تجهيز البيانات لملف Excel
    const data = await Promise.all(volunteers.map(async (volunteer) => {
      let userName = 'غير معروف';

      // التحقق مما إذا كان `populate()` أرجع اسم المستخدم، وإذا لم يكن كذلك، جلبه يدويًا
      if (volunteer.userId && volunteer.userId.username) {
        userName = volunteer.userId.username;
      } else {
        const user = await Users.findById(volunteer.userId);
        if (user) userName = user.username;
      }

      return {
        'معرف المستخدم': volunteer.userId._id.toString(),
        'اسم المستخدم': userName,
        'عدد الملفات المكتملة': volunteer.completedFiles.length,
        'عدد الملفات المعلقة': volunteer.pendingFiles.length,
        'عدد الملفات المنتظرة': volunteer.waitingFiles.length,
      };
    }));

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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'إحصائيات المتطوعين');

    // حفظ الملف
    const filePath = path.join(__dirname, './volunteers_statistics.xlsx');
    XLSX.writeFile(workbook, filePath);

    // إرسال الملف للتحميل
    res.download(filePath, 'volunteers_statistics.xlsx', (err) => {
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

// عرض الملفات المستعجلة 

// const getUrgentFiles = async (req, res, next) => {
//     try {
//         const urgentFiles = await Files.find({ urgent: true }).select('file_type description uploadedAt deliveredAt fileParts');

//         let formattedFiles = [];

//         urgentFiles.forEach(file => {
//             if (file.fileParts.length > 0) {
//                 file.fileParts.forEach(part => {
//                     formattedFiles.push({
//                         file_type: file.file_type,
//                         description: file.description,
//                         uploadedAt: file.uploadedAt,
//                         deliveredAt: file.deliveredAt,
//                         partName: part.partName // إظهار اسم الجزء
//                     });
//                 });
//             } else {
//                 formattedFiles.push({
//                     file_type: file.file_type,
//                     description: file.description,
//                     uploadedAt: file.uploadedAt,
//                     deliveredAt: file.deliveredAt,
//                     partName: null // في حال لم يكن هناك تقسيم للملف
//                 });
//             }
//         });

//         res.status(200).json({
//             status: true,
//             message: 'تمت العملية بنجاح',
//             data: formattedFiles
//         });
//     } catch (error) {
//         console.error('Error fetching urgent files:', error);
//         next(appError.create(error.message, 400, false));
//     }
// };

const getUrgentFiles = async (req, res, next) => {
    try {
        const urgentFiles = await Files.find({ urgent: true }).select('file_type description uploadedAt deliveredAt fileParts');

        let formattedFiles = [];

        urgentFiles.forEach(file => {
            file.fileParts.forEach(part => {
                if (!part.assignedVolunteer) { // التأكد من أن الجزء غير مسند لأي متطوع
                    formattedFiles.push({
                        file_type: file.file_type,
                        description: file.description,
                        uploadedAt: file.uploadedAt,
                        deliveredAt: file.deliveredAt,
                        partName: part.partName // إضافة اسم الجزء غير المسند
                    });
                }
            });
        });

        res.status(200).json({
            status: true,
            message: 'تمت العملية بنجاح',
            data: formattedFiles
        });
    } catch (error) {
        console.error('Error fetching urgent files:', error);
        next(appError.create(error.message, 400, false));
    }
};

// اعطاء المهمة لمتطوع 
const assignPartToVolunteer = async (req, res, next) => {
    const { partName, userId } = req.body;

    try {
        const updatedFile = await Files.findOneAndUpdate(
            { "fileParts.partName": partName, "fileParts.assignedVolunteer": null }, // البحث عن الجزء المطلوب غير المسند
            { $set: { "fileParts.$.assignedVolunteer": userId } }, // تحديث المتطوع لهذا الجزء
            { new: true } // إرجاع الملف بعد التعديل
        );
        await Volunteers.updateOne({userId:userId},{$push:{waitingFiles:updatedFile._id}})
        if (!updatedFile) {
            return res.status(404).json({ status: false, message: 'لم يتم العثور على الملف أو أن الجزء مسند بالفعل' });
        }

        res.status(200).json({
            status: true,
            message: `تم إسناد الجزء "${partName}" إلى المتطوع بنجاح`,
            data: updatedFile
        });

    } catch (error) {
        console.error('Error assigning file part:', error);
        next(appError.create(error.message, 400, false));
    }
};

const getVolunteerStatsByName = async (req, res, next) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ status: false, message: 'يرجى إدخال اسم المستخدم للبحث' });
    }

    // جلب المستخدمين الذين تطابق أسماؤهم جزئيًا
    const users = await Users.find({
      username: { $regex: new RegExp(username, 'i') }
    });

    if (!users.length) {
      return res.status(200).json({ status: true, message: 'لا يوجد مستخدمون مطابقون', data: [] });
    }

    // جلب المتطوعين المرتبطين بهؤلاء المستخدمين
    const userIds = users.map(u => u._id);
    const volunteers = await Volunteers.find({ userId: { $in: userIds } }).populate('userId');

    const statistics = volunteers.map(volunteer => ({
      userId: volunteer.userId?._id,
      username: volunteer.userId?.username || 'غير معروف',
      active: volunteer.userId?.active ?? false,
      completedFilesCount: volunteer.completedFiles.length,
      pendingFilesCount: volunteer.pendingFiles.length,
      waitingFilesCount: volunteer.waitingFiles.length
    }));

    return res.status(200).json({
      status: true,
      message: 'تم العثور على الإحصائيات',
      data: { statistics, numberOfVolunteers: statistics.length }
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

const getVolunteerInfoByName = async (req, res, next) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ status: false, message: 'يرجى إدخال اسم المستخدم للبحث' });
    }

    // جلب المستخدمين الذين تطابق أسماؤهم جزئيًا
    const users = await Users.find({
      username: { $regex: new RegExp(username, 'i') }
    });

    if (!users.length) {
      return res.status(200).json({ status: true, message: 'لا يوجد مستخدمون مطابقون', data: [] });
    }

    // جلب المتطوعين المرتبطين بهؤلاء المستخدمين
    const userIds = users.map(u => u._id);
    const volunteers = await Volunteers.find({ userId: { $in: userIds } }).populate('userId');

    const statistics = volunteers.map(volunteer => ({
      userId: volunteer.userId?._id,
      username: volunteer.userId?.username || 'غير معروف',
      active: volunteer.userId?.active ?? false,
      waitingFilesCount: volunteer.waitingFiles.length,
      availableDaysForUrgent: volunteer.availableDaysForUrgent

    }));

    return res.status(200).json({
      status: true,
      message: 'تم العثور على الإحصائيات',
      data: { statistics, numberOfVolunteers: statistics.length }
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

module.exports={
    changeActiveStatus,
    getAllVolunteers,
    deleteVolunteer,
    upload,
    createNews,
    updateNews,
    deleteNews,
    getAllNews,
    getSingleNew,
    displayAllVolunteersStatistics,
    exportAllVolunteersStatistics,
    getUrgentFiles,
    assignPartToVolunteer,
    getVolunteerStatsByName,
    getVolunteerInfoByName
}