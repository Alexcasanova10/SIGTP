const express = require("express");
const usuarioRoute = express.Router();
const AsyncHandler = require("express-async-handler");
const Usuario = require("../../models/Usuario");
const Rol = require("../../models/Rol");
const protect = require("../../middlewares/Auth");


const generateToken = require("../../tokenGenerate");
const bcrypt = require('bcryptjs');
const { sequelize } = require('../../models');
require('dotenv').config();

// Función para generar número de empleado automático (6 dígitos)
const generarNumeroEmpleado = async () => {
    try {
        // Buscar el último número de empleado registrado
        const ultimoUsuario = await Usuario.findOne({
            order: [['numero_empleado', 'DESC']],
            attributes: ['numero_empleado']
        });

        if (!ultimoUsuario || !ultimoUsuario.numero_empleado) {
            // Si no hay usuarios, empezar desde 000001
            return '000001';
        }

        // Extraer el número y convertirlo a entero
        const ultimoNumero = parseInt(ultimoUsuario.numero_empleado, 10);
        
        // Incrementar y formatear a 6 dígitos
        const nuevoNumero = (ultimoNumero + 1).toString().padStart(6, '0');
        
        return nuevoNumero;
    } catch (error) {
        console.error('Error generando número de empleado:', error);
        // En caso de error, generar uno basado en timestamp
        const timestamp = Date.now().toString().slice(-6);
        return timestamp.padStart(6, '0');
    }
};

// API DE REGISTRO DE USUARIO

usuarioRoute.post("/registro-usuario", AsyncHandler(async (req, res) => {
        // Iniciar transacción
        const transaction = await sequelize.transaction();
        
        try {
            const { nombre, password, rol_id } = req.body;

            // Validaciones básicas
            if (!nombre || !password || !rol_id) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Todos los campos son obligatorios: nombre, password, rol_id"
                });
            }

            // Validar longitud de contraseña (mínimo 6 caracteres)
            if (password.length < 6) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "La contraseña debe tener al menos 6 caracteres"
                });
            }

            // Verificar que el rol existe
            const rolExistente = await Rol.findByPk(rol_id, { transaction });
            if (!rolExistente) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `El rol con ID ${rol_id} no existe`
                });
            }

            // Verificar si ya existe un usuario con el mismo nombre
            const usuarioExistente = await Usuario.findOne({
                where: { nombre: nombre },
                transaction
            });

            if (usuarioExistente) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Ya existe un usuario con ese nombre"
                });
            }

            // Generar número de empleado automático
            const numeroEmpleado = await generarNumeroEmpleado();

            // Encriptar password
            const salt = await bcrypt.genSalt(10);
            const passwordEncriptada = await bcrypt.hash(password, salt);

            // Crear el usuario
            const nuevoUsuario = await Usuario.create({
                nombre: nombre,
                numero_empleado: numeroEmpleado,
                password: passwordEncriptada,
                rol_id: rol_id,
                activo: true,
                fecha_creacion: new Date()
            }, { transaction });

            // Commit de la transacción
            await transaction.commit();

            // Obtener el nombre del rol para la respuesta
            const rolNombre = rolExistente.nombre;

            // Respuesta exitosa (SIN TOKEN - el token se genera en login)
            res.status(201).json({
                success: true,
                message: "Usuario registrado exitosamente",
                data: {
                    id: nuevoUsuario.id,
                    nombre: nuevoUsuario.nombre,
                    numero_empleado: nuevoUsuario.numero_empleado,
                    rol_id: nuevoUsuario.rol_id,
                    rol_nombre: rolNombre,
                    activo: nuevoUsuario.activo,
                    fecha_creacion: nuevoUsuario.fecha_creacion
                }
            });

        } catch (error) {
            // Rollback en caso de error
            if (transaction && !transaction.finished) {
                await transaction.rollback();
            }
            
            console.error('Error en registro:', error);
            res.status(500).json({
                success: false,
                message: "Error interno del servidor al registrar usuario"
            });
        }
    })
);


// API LOGIN
usuarioRoute.post("/login", 
    AsyncHandler(async (req, res) => {
        try {
            const { nombre, password } = req.body;

            // Validar que vengan los campos requeridos
            if (!nombre || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Nombre de usuario y contraseña son requeridos"
                });
            }

            // Buscar usuario por nombre e incluir su rol
            const usuario = await Usuario.findOne({
                where: { 
                    nombre: nombre,
                    activo: true // Solo usuarios activos pueden iniciar sesión
                },
                include: [{
                    model: Rol,
                    attributes: ['id', 'nombre', 'descripcion']
                }]
            });

            // Verificar si el usuario existe
            if (!usuario) {
                return res.status(401).json({
                    success: false,
                    message: "Credenciales inválidas"
                });
            }

            // Verificar la contraseña
            const passwordValida = await bcrypt.compare(password, usuario.password);
            
            if (!passwordValida) {
                return res.status(401).json({
                    success: false,
                    message: "Credenciales inválidas"
                });
            }

            // Generar token JWT
            const token = generateToken(usuario.id);

            // Configurar la sesión (opcional, si usas sesiones)
            if (req.session) {
                req.session.user = {
                    id: usuario.id,
                    nombre: usuario.nombre,
                    numero_empleado: usuario.numero_empleado,
                    rol: usuario.rol,
                    activo: usuario.activo
                };
            }

            // Determinar la vista/redirección según el rol
            // const vistaSegunRol = {
            //     1: '/produccion',      // Operador
            //     2: '/calidad',          // Calidad
            //     3: '/supervisor',       // Supervisor
            //     4: '/tecnico',          // Técnico
            //     5: '/ingenieria',       // Ingeniero
            //     6: '/gerencia'          // Gerente
            // };

            // const vistaDestino = vistaSegunRol[usuario.rol_id] || '/dashboard';

            // Respuesta exitosa con token y datos del usuario
            res.json({
                success: true,
                message: "Inicio de sesión exitoso",
                data: {
                    token: token,
                    usuario: {
                        id: usuario.id,
                        nombre: usuario.nombre,
                        numero_empleado: usuario.numero_empleado,
                        // rol: {
                        //     id: usuario.rol.id,
                        //     nombre: usuario.rol.nombre,
                        //     descripcion: usuario.rol.descripcion
                        // },
                        activo: usuario.activo
                    },
                    // redireccion: {
                    //     vista: vistaDestino,
                    //     rol_nombre: usuario.rol.nombre
                    // }
                }
            });

        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({
                success: false,
                message: "Error interno del servidor"
            });
        }
    })
);

// API LOGOUT 
usuarioRoute.post("/logout", 
    AsyncHandler(async (req, res) => {
        try {
            // Opción 1: Si estás usando sesiones (express-session)
            if (req.session) {
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Error destruyendo sesión:', err);
                        return res.status(500).json({
                            success: false,
                            message: "Error al cerrar sesión"
                        });
                    }
                    
                    // Limpiar cookie de sesión
                    res.clearCookie('connect.sid'); // Nombre por defecto de la cookie de sesión
                    
                    return res.json({
                        success: true,
                        message: "Sesión cerrada exitosamente"
                    });
                });
            } 
            // Opción 2: Si solo usas JWT (el logout es client-side)
            else {
                // Con JWT, el logout se maneja del lado del cliente eliminando el token
                // Pero podemos dar una respuesta exitosa
                return res.json({
                    success: true,
                    message: "Sesión cerrada exitosamente. Elimina el token del lado del cliente."
                });
            }
        } catch (error) {
            console.error('Error en logout:', error);
            res.status(500).json({
                success: false,
                message: "Error interno del servidor"
            });
        }
    })
);

// API PERFIL
usuarioRoute.get("/perfil", protect, AsyncHandler(async (req, res) => {
  try {
    // El usuario ya viene completo del middleware protect
    // Solo necesitamos devolver la información
    const usuario = req.usuario;

    res.json({
      success: true,
      data: {
        id: usuario.id,
        nombre: usuario.nombre,
        numero_empleado: usuario.numero_empleado,
        rol: usuario.rol ? {
          id: usuario.rol.id,
          nombre: usuario.rol.nombre,
          descripcion: usuario.rol.descripcion
        } : null,
        activo: usuario.activo,
        fecha_creacion: usuario.fecha_creacion
      }
    });

  } catch (error) {
    console.error('Error en perfil:', error);
    res.status(500).json({
      success: false,
      message: "Error al obtener perfil"
    });
  }
}));

// API PARA OBTENER ROLES DISPONIBLES (útil para el frontend)
usuarioRoute.get("/roles-disponibles",
    AsyncHandler(async (req, res) => {
        try {
            const roles = await Rol.findAll({
                attributes: ['id', 'nombre', 'descripcion'],
                order: [['id', 'ASC']]
            });

            res.json({
                success: true,
                data: roles
            });
        } catch (error) {
            console.error('Error obteniendo roles:', error);
            res.status(500).json({
                success: false,
                message: "Error al obtener roles disponibles"
            });
        }
    })
);

// API PARA VERIFICAR DISPONIBILIDAD DE NOMBRE DE USUARIO
usuarioRoute.get("/verificar-nombre/:nombre",
    AsyncHandler(async (req, res) => {
        try {
            const { nombre } = req.params;
            
            const usuarioExistente = await Usuario.findOne({
                where: { nombre: nombre }
            });

            res.json({
                success: true,
                disponible: !usuarioExistente,
                message: usuarioExistente ? "Nombre de usuario no disponible" : "Nombre de usuario disponible"
            });
        } catch (error) {
            console.error('Error verificando nombre:', error);
            res.status(500).json({
                success: false,
                message: "Error al verificar disponibilidad del nombre"
            });
        }
    })
);

module.exports = usuarioRoute;