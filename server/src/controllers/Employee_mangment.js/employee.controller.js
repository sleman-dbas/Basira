const bcryptjs = require('bcryptjs');
const Volunteers = require('../../models/volunteers'); 
const Users = require('../../models/Users');
const News = require("../../models/News.model")
const appError = require('../../utils/handelError');
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
    const volunteers = await Users.find({ isVolunteer: true });
    return res.status(200).json({ status: true, message: 'All volunteers', data: volunteers });
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
    changedStatusUser.active = true;
    await changedStatusUser.save();
    res.status(200).json({ status: true, message: 'تمت عملية التعديل بنجاح', data: changedStatusUser });
  } catch (error) {
    next(appError.create(error.message, 400, false));
  }
};

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
}
module.exports={
    changeActiveStatus,
    getAllVolunteers,
    deleteVolunteer,
    upload,
    createNews,
    deleteNews,
    getAllNews,
    getSingleNew
}