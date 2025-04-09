const { AbilityBuilder, Ability } = require('@casl/ability');

function defineAbilitiesFor(user) {
    const { can, cannot, rules } = new AbilityBuilder(Ability);
    
    if (user.role === 'superAdmin') {
        can('manage', 'all');
    } else {
        user.permissions.forEach(permission => {
            const [action, resource] = permission.split(':');
            can(action, resource);
        });

        if (user.role === 'admin') {
            cannot('update', 'role', { role: { $in: ['admin', 'superAdmin'] } });
            cannot('update', 'permissions', { role: { $in: ['admin', 'superAdmin'] } });
        }

        if (user.role === 'employee') {
            cannot('update', 'role');
            cannot('update', 'permissions', { role: { $in: ['employee', 'admin', 'superAdmin'] } });
        }

        if (user.role === 'user') {
            cannot('update', 'role');
            cannot('update', 'permissions');
        }
    }

    return new Ability(rules);
}

module.exports = defineAbilitiesFor;
