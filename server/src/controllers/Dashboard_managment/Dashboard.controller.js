const Users = require("../../models/Users");



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