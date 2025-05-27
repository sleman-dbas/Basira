const bcryptjs = require('bcryptjs');
const Volunteers = require('../../models/volunteers'); // تأكد من استيراد النماذج بشكل صحيح
const Users = require('../../models/Users');
const appError = require('../../utils/handelError');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const getAllVolunteers = async (req, res, next) => {
  try {
    const volunteers = await Users.find({ isVolunteer: true });
    return res.status(200).json({ status: true, message: 'All volunteers', data: {volunteers,numberOfVolunteers:volunteers.length} });
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

const displayAllVolunteersStatistics = async (req, res, next) => {
  try {
    // 1 - جلب جميع المتطوعين
    const volunteers = await Volunteers.find();

    // 2 - التحقق مما إذا كان هناك متطوعون
    if (!volunteers || volunteers.length === 0) {
      return res.status(404).json({ status: false, message: 'لا يوجد متطوعون' });
    }

    // 3 - تجهيز الإحصائيات لكل متطوع
    const statistics = volunteers.map(volunteer => ({
      userId: volunteer.userId,
      completedFilesCount: volunteer.completedFiles.length,
      pendingFilesCount: volunteer.pendingFiles.length,
      waitingFilesCount: volunteer.waitingFiles.length,
      examFilePath: volunteer.examFilePath || 'لا يوجد ملف اختبار'
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





module.exports={
    changeActiveStatus,
    getAllVolunteers,
    deleteVolunteer,
    displayAllVolunteersStatistics,
    exportAllVolunteersStatistics
}