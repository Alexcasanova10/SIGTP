const express = require("express");
const supervisorRoute = express.Router();
const AsyncHandler = require("express-async-handler");
const Usuario = require("../../models/Usuario");
const Rol = require("../../models/Rol");
const Estacion = require("../../models/Estacion");
const OrdenTrabajo = require("../../models/OrdenTrabajo");
const protect = require("../../middlewares/Auth");
const bcrypt = require('bcryptjs');
const { sequelize } = require('../../models');
require('dotenv').config();

// Función para generar número de orden con formato: ORD_YYYYMMDD_000001
const generarNumeroOrden = async () => {
    try {
        const fecha = new Date();
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        const fechaFormateada = `${anio}${mes}${dia}`;
        
        const prefijo = `ORD_${fechaFormateada}_`;
        
        // Buscar la última orden con el mismo prefijo de fecha
        const ultimaOrden = await OrdenTrabajo.findOne({
            where: {
                numero_orden: {
                    [sequelize.Sequelize.Op.like]: `${prefijo}%`
                }
            },
            order: [['numero_orden', 'DESC']]
        });
        
        let numeroConsecutivo = 1;
        
        if (ultimaOrden && ultimaOrden.numero_orden) {
            // Extraer el número consecutivo de la última orden
            const partes = ultimaOrden.numero_orden.split('_');
            const ultimoNumero = parseInt(partes[partes.length - 1], 10);
            if (!isNaN(ultimoNumero)) {
                numeroConsecutivo = ultimoNumero + 1;
            }
        }
        
        // Formatear el número consecutivo a 6 dígitos
        const consecutivoFormateado = String(numeroConsecutivo).padStart(6, '0');
        
        return `${prefijo}${consecutivoFormateado}`;
        
    } catch (error) {
        console.error('Error generando número de orden:', error);
        // Fallback: generar con timestamp si hay error
        const timestamp = Date.now().toString().slice(-6);
        const fecha = new Date();
        const fechaFormateada = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
        return `ORD_${fechaFormateada}_${timestamp}`;
    }
};

// API CREAR ORDEN DE TRABAJO
supervisorRoute.post("/generar-orden-trabajo", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { cantidad_planeada } = req.body;
            
            // Validaciones
            if (!cantidad_planeada) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "La cantidad planeada es requerida"
                });
            }
            
            if (cantidad_planeada <= 0) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "La cantidad planeada debe ser mayor a 0"
                });
            }
            
            // Generar número de orden automático
            const numeroOrden = await generarNumeroOrden();
            
            // Crear la orden de trabajo
            const nuevaOrden = await OrdenTrabajo.create({
                numero_orden: numeroOrden,
                cantidad_planeada: cantidad_planeada,
                estatus: 'Planeada',
                fecha_inicio: new Date(),
                fecha_fin: null
            }, { transaction });
            
            // Commit de la transacción
            await transaction.commit();
            
            // Respuesta exitosa
            res.status(201).json({
                success: true,
                message: "Orden de trabajo creada exitosamente",
                data: {
                    id: nuevaOrden.id,
                    numero_orden: nuevaOrden.numero_orden,
                    cantidad_planeada: nuevaOrden.cantidad_planeada,
                    estatus: nuevaOrden.estatus,
                    fecha_inicio: nuevaOrden.fecha_inicio,
                    fecha_fin: nuevaOrden.fecha_fin
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error creando orden de trabajo:', error);
            
            // Manejo de error por duplicado
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({
                    success: false,
                    message: "Error: Número de orden duplicado, intenta nuevamente"
                });
            }
            
            res.status(500).json({
                success: false,
                message: "Error interno al crear la orden de trabajo",
                error: error.message
            });
        }
    })
);

// API CONSULTAR ORDEN DE TRABAJO POR ID
supervisorRoute.get("/orden-trabajo/:id", 
    AsyncHandler(async (req, res) => {
        try {
            const { id } = req.params;
            
            // Buscar la orden por ID
            const orden = await OrdenTrabajo.findByPk(id);
            
            if (!orden) {
                return res.status(404).json({
                    success: false,
                    message: `Orden de trabajo con ID ${id} no encontrada`
                });
            }
            
            res.json({
                success: true,
                data: {
                    id: orden.id,
                    numero_orden: orden.numero_orden,
                    cantidad_planeada: orden.cantidad_planeada,
                    estatus: orden.estatus,
                    fecha_inicio: orden.fecha_inicio,
                    fecha_fin: orden.fecha_fin
                }
            });
            
        } catch (error) {
            console.error('Error consultando orden:', error);
            res.status(500).json({
                success: false,
                message: "Error al consultar la orden de trabajo"
            });
        }
    })
);

// API CONSULTAR ORDEN DE TRABAJO POR NÚMERO DE ORDEN
supervisorRoute.get("/orden-trabajo/numero/:numero_orden", 
    AsyncHandler(async (req, res) => {
        try {
            const { numero_orden } = req.params;
            
            // Buscar la orden por número de orden
            const orden = await OrdenTrabajo.findOne({
                where: { numero_orden: numero_orden }
            });
            
            if (!orden) {
                return res.status(404).json({
                    success: false,
                    message: `Orden de trabajo ${numero_orden} no encontrada`
                });
            }
            
            res.json({
                success: true,
                data: {
                    id: orden.id,
                    numero_orden: orden.numero_orden,
                    cantidad_planeada: orden.cantidad_planeada,
                    estatus: orden.estatus,
                    fecha_inicio: orden.fecha_inicio,
                    fecha_fin: orden.fecha_fin
                }
            });
            
        } catch (error) {
            console.error('Error consultando orden:', error);
            res.status(500).json({
                success: false,
                message: "Error al consultar la orden de trabajo"
            });
        }
    })
);

// API LISTAR TODAS LAS ÓRDENES DE TRABAJO (con opción de filtro)
supervisorRoute.get("/ordenes-trabajo", 
    AsyncHandler(async (req, res) => {
        try {
            const { estatus, page = 1, limit = 10 } = req.query;
            
            const where = {};
            if (estatus) {
                where.estatus = estatus;
            }
            
            const offset = (page - 1) * limit;
            
            const { count, rows } = await OrdenTrabajo.findAndCountAll({
                where,
                order: [['fecha_inicio', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.json({
                success: true,
                data: {
                    total: count,
                    page: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    ordenes: rows
                }
            });
            
        } catch (error) {
            console.error('Error listando órdenes:', error);
            res.status(500).json({
                success: false,
                message: "Error al listar las órdenes de trabajo"
            });
        }
    })
);

// API ACTUALIZAR ESTATUS POR NUMERO DE ORDEN (opcional)
supervisorRoute.put("/orden-trabajo/:numero_orden/estatus", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            // const { id } = req.params;
            const { numero_orden } = req.params;

            const { estatus } = req.body;
            
            const estatusValidos = ['Planeada', 'En Proceso', 'Pausada', 'Finalizada'];
            
            if (!estatus || !estatusValidos.includes(estatus)) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Estatus inválido. Debe ser uno de: ${estatusValidos.join(', ')}`
                });
            }
            
            // const orden = await OrdenTrabajo.findByPk(id, { transaction });

            // Buscar la orden por número de orden
            const orden = await OrdenTrabajo.findOne({
                where: { numero_orden: numero_orden }
            });
            
            if (!orden) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: `Orden de trabajo con #ID ${numero_orden} no encontrada`
                });
            }
            
            // Si se finaliza, registrar fecha_fin
            const updateData = { estatus };
            if (estatus === 'Finalizada') {
                updateData.fecha_fin = new Date();
            }
            
            await orden.update(updateData, { transaction });
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: `Orden actualizada a estatus: ${estatus}`,
                data: orden
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error actualizando estatus:', error);
            res.status(500).json({
                success: false,
                message: "Error al actualizar estatus de la orden"
            });
        }
    })
);

// API CREAR ESTACIÓN
supervisorRoute.post("/crear-estacion", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { nombre, descripcion } = req.body;
            
            // Validación: nombre es requerido
            if (!nombre) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "El nombre de la estación es requerido"
                });
            }
            
            // Validar que no exista una estación con el mismo nombre
            const estacionExistente = await Estacion.findOne({
                where: { nombre: nombre },
                transaction
            });
            
            if (estacionExistente) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Ya existe una estación con el nombre: ${nombre}`
                });
            }
            
            // Crear la estación
            const nuevaEstacion = await Estacion.create({
                nombre: nombre,
                descripcion: descripcion || null
            }, { transaction });
            
            await transaction.commit();
            
            res.status(201).json({
                success: true,
                message: "Estación creada exitosamente",
                data: {
                    id: nuevaEstacion.id,
                    nombre: nuevaEstacion.nombre,
                    descripcion: nuevaEstacion.descripcion
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error creando estación:', error);
            res.status(500).json({
                success: false,
                message: "Error interno al crear la estación"
            });
        }
    })
);

// API LISTAR TODAS LAS ESTACIONES
supervisorRoute.get("/estaciones", 
    AsyncHandler(async (req, res) => {
        try {
            const estaciones = await Estacion.findAll({
                order: [['id', 'ASC']]
            });
            
            res.json({
                success: true,
                data: estaciones,
                total: estaciones.length
            });
            
        } catch (error) {
            console.error('Error listando estaciones:', error);
            res.status(500).json({
                success: false,
                message: "Error al listar las estaciones"
            });
        }
    })
);

// API CONSULTAR ESTACIÓN POR ID
supervisorRoute.get("/estacion/:id", 
    AsyncHandler(async (req, res) => {
        try {
            const { id } = req.params;
            
            const estacion = await Estacion.findByPk(id);
            
            if (!estacion) {
                return res.status(404).json({
                    success: false,
                    message: `Estación con ID ${id} no encontrada`
                });
            }
            
            res.json({
                success: true,
                data: estacion
            });
            
        } catch (error) {
            console.error('Error consultando estación:', error);
            res.status(500).json({
                success: false,
                message: "Error al consultar la estación"
            });
        }
    })
);

// API ACTUALIZAR ESTACIÓN (opcional)
supervisorRoute.put("/estacion/:id", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { id } = req.params;
            const { nombre, descripcion } = req.body;
            
            // Buscar la estación
            const estacion = await Estacion.findByPk(id, { transaction });
            
            if (!estacion) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: `Estación con ID ${id} no encontrada`
                });
            }
            
            // Si se actualiza el nombre, verificar que no exista otra con ese nombre
            if (nombre && nombre !== estacion.nombre) {
                const estacionExistente = await Estacion.findOne({
                    where: { nombre: nombre },
                    transaction
                });
                
                if (estacionExistente) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Ya existe una estación con el nombre: ${nombre}`
                    });
                }
            }
            
            // Actualizar
            await estacion.update({
                nombre: nombre || estacion.nombre,
                descripcion: descripcion !== undefined ? descripcion : estacion.descripcion
            }, { transaction });
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: "Estación actualizada exitosamente",
                data: estacion
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error actualizando estación:', error);
            res.status(500).json({
                success: false,
                message: "Error al actualizar la estación"
            });
        }
    })
);
 

module.exports = supervisorRoute;












module.exports = supervisorRoute;