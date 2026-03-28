const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const Rol = require('../models/Rol');

// Middleware para verificar que el usuario está autenticado
const verificarAutenticacion = async (req, res, next) => {
    let token;

    // Verificar si viene el token en el header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Obtener token
            token = req.headers.authorization.split(' ')[1];

            // Verificar token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Obtener usuario del token
            req.usuario = await Usuario.findByPk(decoded.id, {
                include: [{
                    model: Rol,
                    attributes: ['id', 'nombre']
                }],
                attributes: { exclude: ['password'] }
            });

            if (!req.usuario) {
                return res.status(401).json({
                    success: false,
                    message: "Usuario no encontrado"
                });
            }

            if (!req.usuario.activo) {
                return res.status(401).json({
                    success: false,
                    message: "Usuario inactivo"
                });
            }

            return next();
        } catch (error) {
            console.error('Error verificando token:', error);
            return res.status(401).json({
                success: false,
                message: "Token inválido"
            });
        }
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "No autorizado, token requerido"
        });
    }
};

// Middleware para verificar roles específicos
const verificarRol = (rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message: "No autorizado"
            });
        }

        const rolUsuario = req.usuario.rol.nombre;
        
        if (rolesPermitidos.includes(rolUsuario)) {
            return next();
        } else {
            return res.status(403).json({
                success: false,
                message: `Acceso denegado. Se requiere uno de estos roles: ${rolesPermitidos.join(', ')}`
            });
        }
    };
};

// Middleware para verificar permisos específicos por ID de rol
const verificarRolId = (rolesIdsPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message: "No autorizado"
            });
        }

        if (rolesIdsPermitidos.includes(req.usuario.rol_id)) {
            return next();
        } else {
            return res.status(403).json({
                success: false,
                message: "Acceso denegado para este rol"
            });
        }
    };
};

module.exports = {
    verificarAutenticacion,
    verificarRol,
    verificarRolId
};