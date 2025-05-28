const Users = require('../models/Users');
const defineAbilitiesFor = require('../utils/userRole');

// Middleware للتحقق من الصلاحيات
function authorize(action, resource) {
    return async (req, res, next) => {
        const user = await Users.findById(req.currentUser.id);
        const targetUser = await Users.findById(req.params.id);

        const updates = req.body;

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const ability = defineAbilitiesFor(user);
        if (ability.can(action, resource)) {
            if (action === 'update' && resource === 'role') {
                if (updates.role === 'admin') {
                    if (user.role !== 'admin') {
                        return res.status(403).json({status:false, message: 'Forbidden: Only admin can update roles to admin.' });
                    }
                }

                if (updates.role === 'employee' && user.role !== 'admin') {
                    return res.status(403).json({status:false, message: 'Forbidden: Only admin can update roles to employee.' });
                }

                if (user.role === 'user') {
                    return res.status(403).json({status:false, message: 'Forbidden: User cannot update roles.' });
                }
            }

            if (action === 'update' && resource === 'permissions') {

                if (!targetUser) {
                    return res.status(404).json({status:false, message: 'User not found' });
                }

                if (targetUser.role === 'admin' && user.role !== 'admin') {
                    return res.status(403).json({status:false, message: 'Forbidden: Only admin can update permissions for admin.' });
                }

                if (targetUser.role === 'employee' && user.role !== 'admin') {
                    return res.status(403).json({status:false, message: 'Forbidden: Only admin can update permissions for employee.' });
                }

                if (targetUser.role === 'user' && user.role === 'employee') {
                    return res.status(403).json({status:false, message: 'Forbidden: Employee cannot update permissions.' });
                }
            }
            next();
        } else {
            res.status(403).json({status:false, message: 'Forbidden' });
        }
    };
}

module.exports = authorize;
