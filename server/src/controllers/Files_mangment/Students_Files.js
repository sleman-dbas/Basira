const Files = require("../../models/Files");

module.exports.uploadFile = async (req, res, next) => {
    const { title, description, urgent } = req.body;
  
    // تحديد وقت استلام الملف
    const receivedAt = new Date();
  
    // حساب وقت التسليم بناءً على حالة الاستعجال
    let requiredDuration = urgent ? 3 : 72; // المستعجل: 3 ساعات، غير المستعجل: 3 أيام
    let deliveredAt = new Date(receivedAt.getTime() + requiredDuration * 60 * 60 * 1000); // حساب وقت التسليم
  
    const newFile = new Files({
        title,
        description,
        uploadedAt: receivedAt,
        receivedAt,
        deliveredAt,
        requiredDuration,
        urgent
    });
  
    try {
        await newFile.save();
        return res.status(201).json({ status: true, message: 'File uploaded successfully!', data: newFile });
    } catch (error) {
        console.log(error);
        const errors = ['Unable to upload file'];
        const errorObj = appError.create(errors[0], 400, false, errors);
        return next(errorObj);
    }
  };
  