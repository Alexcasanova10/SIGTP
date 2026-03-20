const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
require('dotenv').config();

const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Prioridad 1: Token de los headers de autorización
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } 
  // Prioridad 2: Token de la sesión
  else if (req.session && req.session.token) {
    token = req.session.token;
  }

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: "No estás autorizado, token requerido" 
    });
  }

  try {
    // Verificar el token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token decodificado:", decodedToken); // Para debug

    // Buscar el usuario por ID incluyendo su rol
    const usuario = await Usuario.findByPk(decodedToken.id, {
      include: [{
        model: Rol,
        attributes: ['id', 'nombre', 'descripcion']
      }],
      attributes: { exclude: ['password'] } // No incluir la contraseña
    });

    if (!usuario) {
      return res.status(401).json({ 
        success: false,
        message: "Usuario no encontrado" 
      });
    }

    if (!usuario.activo) {
      return res.status(401).json({ 
        success: false,
        message: "Usuario inactivo" 
      });
    }

    // Asignar el usuario completo al request
    req.usuario = usuario;
    
    // También asignar campos individuales para fácil acceso
    req.usuario.id = usuario.id;
    req.usuario.nombre = usuario.nombre;
    req.usuario.numero_empleado = usuario.numero_empleado;
    req.usuario.rol = usuario.rol;
    req.usuario.rol_id = usuario.rol_id;
    req.usuario.activo = usuario.activo;

    console.log("Usuario autenticado:", {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol ? usuario.rol.nombre : 'Sin rol'
    });

    return next();
    
  } catch (err) {
    console.error("Error de token:", err);
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: "Token inválido" 
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: "Token expirado" 
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: "Error de autenticación" 
    });
  }
});

module.exports = protect;