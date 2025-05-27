const bcryptjs = require('bcryptjs');
const Volunteers = require('../../models/volunteers'); // تأكد من استيراد النماذج بشكل صحيح
const Users = require('../../models/Users');
const appError = require('../../utils/handelError');

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


module.exports={
    changeActiveStatus,
    getAllVolunteers,
    deleteVolunteer
}