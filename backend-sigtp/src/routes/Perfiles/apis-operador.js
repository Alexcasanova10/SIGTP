const express = require("express");
const operadorRoute = express.Router();
const AsyncHandler = require("express-async-handler");
const Usuario = require("../../models/Usuario");
const Rol = require("../../models/Rol");
const Pieza = require("../../models/Pieza");
const OrdenTrabajo = require("../../models/OrdenTrabajo");
const Estacion = require("../../models/Estacion");
const protect = require("../../middlewares/Auth");
const bcrypt = require('bcryptjs');
const { sequelize } = require('../../models');
require('dotenv').config();

// Función para generar número de serial con formato: PCB-YYYYMMDD-IDORDEN-000001
const generarSerialPCB = async (orden_id) => {
    try {
        const fecha = new Date();
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        const fechaFormateada = `${anio}${mes}${dia}`;
        
        const prefijo = `PCB-${fechaFormateada}-${orden_id}-`;
        
        // Buscar la última pieza con el mismo prefijo para la misma orden
        const ultimaPieza = await Pieza.findOne({
            where: {
                serial: {
                    [sequelize.Sequelize.Op.like]: `${prefijo}%`
                },
                orden_id: orden_id
            },
            order: [['serial', 'DESC']]
        });
        
        let numeroConsecutivo = 1;
        
        if (ultimaPieza && ultimaPieza.serial) {
            // Extraer el número consecutivo de la última pieza
            const partes = ultimaPieza.serial.split('-');
            const ultimoNumero = parseInt(partes[partes.length - 1], 10);
            if (!isNaN(ultimoNumero)) {
                numeroConsecutivo = ultimoNumero + 1;
            }
        }
        
        // Formatear el número consecutivo a 6 dígitos
        const consecutivoFormateado = String(numeroConsecutivo).padStart(6, '0');
        
        return `${prefijo}${consecutivoFormateado}`;
        
    } catch (error) {
        console.error('Error generando serial:', error);
        // Fallback: generar con timestamp si hay error
        const timestamp = Date.now().toString().slice(-6);
        const fecha = new Date();
        const fechaFormateada = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
        return `PCB-${fechaFormateada}-${orden_id}-${timestamp}`;
    }
};

// API INGRESAR SERIAL DE PIEZA
operadorRoute.post("/ingresar-serial-pieza", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { orden_id, estacion_actual_id } = req.body;
            
            // Validaciones
            if (!orden_id) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "El ID de la orden de trabajo es requerido"
                });
            }
            
            // Verificar que la orden de trabajo existe
            const ordenExistente = await OrdenTrabajo.findByPk(orden_id, { transaction });
            
            if (!ordenExistente) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: `Orden de trabajo con ID ${orden_id} no encontrada`
                });
            }
            
            // Verificar que la orden no esté finalizada
            if (ordenExistente.estatus === 'Finalizada') {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "No se pueden agregar piezas a una orden finalizada"
                });
            }
            
            // Si se proporciona estación, verificar que existe
            if (estacion_actual_id) {
                const estacionExistente = await Estacion.findByPk(estacion_actual_id, { transaction });
                if (!estacionExistente) {
                    await transaction.rollback();
                    return res.status(404).json({
                        success: false,
                        message: `Estación con ID ${estacion_actual_id} no encontrada`
                    });
                }
            }
            
            // Verificar cantidad de piezas registradas vs cantidad planeada
            const piezasRegistradas = await Pieza.count({
                where: { orden_id: orden_id },
                transaction
            });
            
            if (piezasRegistradas >= ordenExistente.cantidad_planeada) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `La orden ya tiene todas las piezas registradas (${piezasRegistradas}/${ordenExistente.cantidad_planeada})`
                });
            }
            
            // Generar serial automático
            const serial = await generarSerialPCB(orden_id);
            
            // Crear la pieza
            const nuevaPieza = await Pieza.create({
                serial: serial,
                orden_id: orden_id,
                estacion_actual_id: estacion_actual_id || null,
                estatus: 'En Proceso SMT',
                fecha_registro: new Date()
            }, { transaction });
            
            // Actualizar estatus de la orden a "En Proceso" si estaba "Planeada"
            if (ordenExistente.estatus === 'Planeada') {
                await ordenExistente.update({
                    estatus: 'En Proceso'
                }, { transaction });
            }
            
            await transaction.commit();
            
            res.status(201).json({
                success: true,
                message: "Pieza registrada exitosamente",
                data: {
                    id: nuevaPieza.id,
                    serial: nuevaPieza.serial,
                    orden_id: nuevaPieza.orden_id,
                    estacion_actual_id: nuevaPieza.estacion_actual_id,
                    estatus: nuevaPieza.estatus,
                    fecha_registro: nuevaPieza.fecha_registro,
                    progreso_orden: `${piezasRegistradas + 1}/${ordenExistente.cantidad_planeada}`
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error registrando pieza:', error);
            
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({
                    success: false,
                    message: "Error: Serial duplicado, intenta nuevamente"
                });
            }
            
            res.status(500).json({
                success: false,
                message: "Error interno al registrar la pieza",
                error: error.message
            });
        }
    })
);

// API CONSULTAR PIEZA POR ID
operadorRoute.get("/pieza/:id", 
    AsyncHandler(async (req, res) => {
        try {
            const { id } = req.params;
            
            const pieza = await Pieza.findByPk(id, {
                include: [
                    {
                        model: OrdenTrabajo,
                        attributes: ['id', 'numero_orden', 'cantidad_planeada', 'estatus']
                    },
                    {
                        model: Estacion,
                        attributes: ['id', 'nombre', 'descripcion']
                    }
                ]
            });
            
            if (!pieza) {
                return res.status(404).json({
                    success: false,
                    message: `Pieza con ID ${id} no encontrada`
                });
            }
            
            res.json({
                success: true,
                data: pieza
            });
            
        } catch (error) {
            console.error('Error consultando pieza:', error);
            res.status(500).json({
                success: false,
                message: "Error al consultar la pieza"
            });
        }
    })
);

// API CONSULTAR PIEZA POR SERIAL
operadorRoute.get("/pieza/serial/:serial", 
    AsyncHandler(async (req, res) => {
        try {
            const { serial } = req.params;
            
            const pieza = await Pieza.findOne({
                where: { serial: serial },
                include: [
                    {
                        model: OrdenTrabajo,
                        attributes: ['id', 'numero_orden', 'cantidad_planeada', 'estatus']
                    },
                    {
                        model: Estacion,
                        attributes: ['id', 'nombre', 'descripcion']
                    }
                ]
            });
            
            if (!pieza) {
                return res.status(404).json({
                    success: false,
                    message: `Pieza con serial ${serial} no encontrada`
                });
            }
            
            res.json({
                success: true,
                data: pieza
            });
            
        } catch (error) {
            console.error('Error consultando pieza:', error);
            res.status(500).json({
                success: false,
                message: "Error al consultar la pieza"
            });
        }
    })
);

// API ACTUALIZAR ESTATUS DE PIEZA
operadorRoute.put("/pieza/:id/estatus", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { id } = req.params;
            const { estatus, estacion_actual_id } = req.body;
            
            const estatusValidos = ['En Proceso SMT', 'En Calidad', 'OK', 'Retrabajo', 'Scrap'];
            
            if (!estatus || !estatusValidos.includes(estatus)) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Estatus inválido. Debe ser uno de: ${estatusValidos.join(', ')}`
                });
            }
            
            const pieza = await Pieza.findByPk(id, { 
                transaction,
                include: [
                    {
                        model: OrdenTrabajo,
                        attributes: ['id', 'numero_orden', 'estatus']
                    }
                ]
            });
            
            if (!pieza) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: `Pieza con ID ${id} no encontrada`
                });
            }
            
            // Actualizar datos de la pieza
            const updateData = { estatus };
            
            if (estacion_actual_id) {
                // Verificar que la estación existe
                const estacionExistente = await Estacion.findByPk(estacion_actual_id, { transaction });
                if (!estacionExistente) {
                    await transaction.rollback();
                    return res.status(404).json({
                        success: false,
                        message: `Estación con ID ${estacion_actual_id} no encontrada`
                    });
                }
                updateData.estacion_actual_id = estacion_actual_id;
            }
            
            await pieza.update(updateData, { transaction });
            
            // Registrar movimiento de estatus (opcional - para historial)
            // Aquí podrías insertar en la tabla movimientos si la tienes
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: `Estatus de pieza actualizado a: ${estatus}`,
                data: {
                    id: pieza.id,
                    serial: pieza.serial,
                    estatus_anterior: pieza.estatus,
                    estatus_nuevo: estatus,
                    estacion_actual_id: updateData.estacion_actual_id || pieza.estacion_actual_id,
                    orden: pieza.orden
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error actualizando estatus:', error);
            res.status(500).json({
                success: false,
                message: "Error al actualizar estatus de la pieza"
            });
        }
    })
);

// API LISTAR PIEZAS POR ORDEN DE TRABAJO
operadorRoute.get("/piezas/orden/:orden_id", 
    AsyncHandler(async (req, res) => {
        try {
            const { orden_id } = req.params;
            const { estatus, page = 1, limit = 10 } = req.query;
            
            const where = { orden_id: orden_id };
            if (estatus) {
                where.estatus = estatus;
            }
            
            const offset = (page - 1) * limit;
            
            const { count, rows } = await Pieza.findAndCountAll({
                where,
                include: [
                    {
                        model: Estacion,
                        attributes: ['id', 'nombre', 'descripcion']
                    }
                ],
                order: [['fecha_registro', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            // Obtener información de la orden
            const orden = await OrdenTrabajo.findByPk(orden_id, {
                attributes: ['id', 'numero_orden', 'cantidad_planeada', 'estatus']
            });
            
            res.json({
                success: true,
                data: {
                    orden: orden,
                    total: count,
                    page: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    piezas: rows
                }
            });
            
        } catch (error) {
            console.error('Error listando piezas:', error);
            res.status(500).json({
                success: false,
                message: "Error al listar las piezas"
            });
        }
    })
);


// API REGISTRO MASIVO DE PIEZAS (opcional)
operadorRoute.post("/ingresar-seriales-masivo", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { orden_id, cantidad, estacion_actual_id } = req.body;
            
            if (!orden_id || !cantidad) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Orden ID y cantidad son requeridos"
                });
            }
            
            if (cantidad <= 0 || cantidad > 100) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "La cantidad debe ser entre 1 y 100 piezas por lote"
                });
            }
            
            // Verificar orden
            const ordenExistente = await OrdenTrabajo.findByPk(orden_id, { transaction });
            
            if (!ordenExistente) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: `Orden de trabajo con ID ${orden_id} no encontrada`
                });
            }
            
            // Verificar cantidad disponible
            const piezasRegistradas = await Pieza.count({
                where: { orden_id: orden_id },
                transaction
            });
            
            const disponible = ordenExistente.cantidad_planeada - piezasRegistradas;
            
            if (cantidad > disponible) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Solo quedan ${disponible} piezas disponibles para registrar`
                });
            }
            
            // Generar múltiples piezas
            const piezasCreadas = [];
            
            for (let i = 0; i < cantidad; i++) {
                const serial = await generarSerialPCB(orden_id);
                const nuevaPieza = await Pieza.create({
                    serial: serial,
                    orden_id: orden_id,
                    estacion_actual_id: estacion_actual_id || null,
                    estatus: 'En Proceso SMT',
                    fecha_registro: new Date()
                }, { transaction });
                
                piezasCreadas.push({
                    id: nuevaPieza.id,
                    serial: nuevaPieza.serial
                });
            }
            
            // Actualizar estatus de la orden
            if (ordenExistente.estatus === 'Planeada') {
                await ordenExistente.update({
                    estatus: 'En Proceso'
                }, { transaction });
            }
            
            await transaction.commit();
            
            res.status(201).json({
                success: true,
                message: `${cantidad} piezas registradas exitosamente`,
                data: {
                    orden_id: orden_id,
                    cantidad_registrada: cantidad,
                    total_registradas: piezasRegistradas + cantidad,
                    cantidad_planeada: ordenExistente.cantidad_planeada,
                    piezas: piezasCreadas
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error registro masivo:', error);
            res.status(500).json({
                success: false,
                message: "Error al registrar piezas masivamente"
            });
        }
    })
);

module.exports = operadorRoute;