const Users = require("../../models/Users");
const Volunteers = require("../../models/volunteers");
const appError = require('../../utils/handelError')
const Files = require('../../models/Files')

module.exports.updatePermission = async (req, res) => {
  try {
      const { id } = req.params;
      const { permissions } = req.body;

      const user = await Users.findById(req.currentUser.id);
      const targetUser = await Users.findById(id);

      if (!targetUser) {
          return res.status(404).json({ error: 'User not found' });
      }
      
      targetUser.permissions = permissions;
      await targetUser.save();
      res.status(200).json({status:true,message:'successfuly..!',data:null});
  } catch (err) {
      res.status(400).json({ error: err.message });
  }
}

module.exports.updateUser =  async (req, res) => {
  try {
      const { id } = req.params;
      const updates = req.body;
      console.log(updates);
      
      const user = await Users.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

      if (!user) {
          return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json({status:true,message:'successfuly..!',data:null});
  } catch (err) {
      res.status(400).json({ error: err.message });
  }
};

module.exports.suspendedUser = async (req, res, next) => {
    const user_id = req.params.userId;
    
    const { duration } = req.body;  
    try {
        const user = await Users.findById(user_id,"username isSuspended suspendedUntil ");

        if (!user) {
            const errors = ['User not found'];
            const error = appError.create(errors[0], 404, false, errors);
            return next(error);
        }

        //Calculate the date and time of the suspension end
        const suspendedUntil = new Date();
        suspendedUntil.setMinutes(suspendedUntil.getMinutes() + duration);

        user.isSuspended = true;
        user.suspendedUntil = suspendedUntil;

        await user.save();

        res.status(200).json({ status: true, message: "User suspended successfully", data: { user } });
    } catch (err) {
        const errors = [err.message || err];
        const error = appError.create(errors[0], 500, false, errors);
        return next(error);
    }
};

module.exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await Users.find()
      .select('username email role permissions isVolunteer')
      .sort({role: 1, isVolunteer: -1 , username: 1 }); // ترتيب حسب الدور ثم الاسم ثم حالة التطوع

    const formattedUsers = users.map(user => ({
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      isVolunteer: user.isVolunteer
    }));

    return res.status(200).json({ 
      status: true, 
      message: 'All users', 
      data: { users: formattedUsers, numberOfUsers: formattedUsers.length } 
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

module.exports.getUserByPartialNameOrEmail = async (req, res, next) => {
  try {
    const { username, email } = req.query; // الحصول على اسم المستخدم والبريد الإلكتروني كـ query parameters
    
    const filter = {};
    if (username) filter.username = { $regex: new RegExp(username, 'i') }; // تأكد أن `$regex` يأخذ نصًا
    if (email) filter.email = { $regex: new RegExp(email, 'i') };

    const users = await Users.find(filter).select('username email role permissions isVolunteer');

    if (!users.length) {
      return res.status(200).json({ status: true, message: 'No users found',data:[] });
    }

    const formattedUsers = users.map(user => ({
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      isVolunteer: user.isVolunteer
    }));

    return res.status(200).json({ 
      status: true, 
      message: 'User(s) found', 
      data: { users: formattedUsers, numberOfUsers: formattedUsers.length } 
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

module.exports.getInactiveVolunteers = async (req, res, next) => {
  try {
    // البحث عن المتطوعين في جدول Volunteers فقط
    const volunteers = await Volunteers.find()
      .populate({
        path: 'userId', 
        match: { isVolunteer: false }, // البحث عن المستخدم الذي لديه isVolunteer: false
        select: '_id username email active isVolunteer' // تحديد الحقول المطلوبة
      });

    // تصفية المتطوعين الذين لديهم مستخدم مرتبط وتنطبق عليه الشروط
    const filteredVolunteers = volunteers.filter(volunteer => volunteer.userId && volunteer.userId.isVolunteer === false);

    if (!filteredVolunteers.length) {
      return res.status(200).json({ status: true, message: 'No inactive volunteers found',data:[] });
    }

    const formattedUsers = filteredVolunteers.map(volunteer => ({
      userId: volunteer.userId._id,
      username: volunteer.userId.username,
      email: volunteer.userId.email,
      active: volunteer.userId.active,
      isVolunteer: volunteer.userId.isVolunteer,
      specialties: volunteer.specialties || null,
      examFilePath: volunteer.examFilePath || null,
      joinDate: volunteer.joinDate || null
    }));

    return res.status(200).json({ 
      status: true, 
      message: 'Inactive volunteers retrieved successfully', 
      data: { users: formattedUsers, numberOfUsers: formattedUsers.length } 
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

module.exports.toggleVolunteerStatus = async (req, res, next) => {
  try {
    const  userId  = req.params.userId; // الحصول على معرف المستخدم من الطلب

    // العثور على المستخدم
    const user = await Users.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    // تحديث الحالة بتبديل القيم
    user.active = !user.active; // عكس قيمة active
    user.isVolunteer = !user.isVolunteer; // عكس قيمة isVolunteer
    await user.save(); // حفظ التغييرات

    return res.status(200).json({ 
      status: true, 
      message: 'User status updated successfully', 
      data: { userId: user._id, username: user.username, active: user.active, isVolunteer: user.isVolunteer } 
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

module.exports.deleteVolunteer = async (req, res, next) => {
  try {
    const { userId } = req.params; // الحصول على معرف المستخدم من الطلب

    // البحث عن المتطوع وحذفه
    const volunteer = await Volunteers.findOneAndDelete({ userId });
    if (!volunteer) {
      return res.status(404).json({ status: false, message: 'Volunteer not found' });
    }

    // البحث عن المستخدم المرتبط وحذفه
    const user = await Users.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    return res.status(200).json({ 
      status: true, 
      message: 'Volunteer and user deleted successfully', 
      data: { userId } 
    });
  } catch (error) {
    return next(appError.create(error.message, 400, false));
  }
};

module.exports.deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params; // استلام معرف المستخدم المطلوب حذفه
    
    if (!userId) {
      return res.status(400).json({ status: false, message: 'User ID is required' });
    }

    // البحث عن المستخدم المطلوب حذفه
    const user = await Users.findById(userId).select('_id username email role permissions isVolunteer');
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    // إذا كان المستخدم متطوعًا، حذفه أيضًا من `Volunteers`
    if (user.isVolunteer) {
      await Volunteers.findOneAndDelete({ userId });

      // تحديث جميع الملفات بحيث يتم إزالة معرف المتطوع من كل جزء داخل `fileParts`
      await Files.updateMany(
        { 'fileParts.assignedVolunteer': userId },
        { $set: { 'fileParts.$[].assignedVolunteer': null } } // تعيين `assignedVolunteer` إلى `null` لجميع الأجزاء
      );
    }

    // حذف المستخدم من `Users`
    await Users.findByIdAndDelete(userId);

    return res.status(200).json({ 
      status: true, 
      message: 'User deleted successfully', 
      data: { deletedUserId: userId } 
    });
  } catch (error) {
    console.log(error.message);
    
    return next(appError.create(error.message, 400, false));
  }
};

module.exports.getStatistics = async (req, res, next) => {
  try {
    // إجمالي المستخدمين
    const totalUsers = await Users.countDocuments();

    // المتطوعين الفعّالين
    const activeVolunteers = await Volunteers.countDocuments({ activeVolunteer: true });

    // عدد المهام المكتملة (ملفات مكتملة)
    const completedFiles = await Files.countDocuments({ status: 'completed' });
    const totalFiles = await Files.countDocuments();

    const completionRate = totalFiles === 0 
      ? '0%' 
      : ((completedFiles / totalFiles) * 100).toFixed(2) + '%';

    res.status(200).json({
      status: true,
      message: 'تم جلب الإحصائيات بنجاح',
      data: {
        totalUsers,
        activeVolunteers,
        totalFiles,
        completionRate
      }
    });
  } catch (error) {
    console.log(error);
    
    return next(appError.create("فشل في جلب الإحصائيات", 500, false));
  }
};

