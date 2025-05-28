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