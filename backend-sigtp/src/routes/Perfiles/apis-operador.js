const express = require("express");
const operadorRoute = express.Router();
const AsyncHandler = require("express-async-handler");
const Usuario = require("../../models/Usuario");
const Rol = require("../../models/Rol");
const Pieza = require("../../models/Pieza");
const OrdenTrabajo = require("../../models/OrdenTrabajo");
const Estacion = require("../../models/Estacion");
const Movimiento = require("../../models/Movimiento");

const protect = require("../../middlewares/Auth");
const { sequelize } = require('../../models');
const { Op } = require('sequelize');
require('dotenv').config();


// API ENVIAR PIEZA A CALIDAD (actualizar estatus a "En Calidad")
/*operadorRoute.put("/enviar-a-calidad",AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { serial } = req.body;
            
            // Validar que viene el serial
            if (!serial) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "El serial de la pieza es requerido"
                });
            }
            
            // Buscar la pieza por serial
            const pieza = await Pieza.findOne({
                where: { serial: serial },
                include: [
                    {
                        model: OrdenTrabajo,
                        as: 'orden',
                        attributes: ['id', 'numero_orden', 'estatus', 'cantidad_planeada']
                    }
                ],
                transaction
            });
            
            // Verificar si la pieza existe
            if (!pieza) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: `Pieza con serial ${serial} no encontrada`
                });
            }
            
            // Verificar que la pieza esté en estatus correcto para enviar a calidad
            if (pieza.estatus !== 'En Proceso SMT') {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `La pieza está en estatus "${pieza.estatus}". Solo se pueden enviar a calidad las piezas en "En Proceso SMT"`,
                    estatus_actual: pieza.estatus
                });
            }
            
            // Guardar estatus anterior para la respuesta
            const estatusAnterior = pieza.estatus;
            
            // Actualizar estatus a "En Calidad"
            await pieza.update({
                estatus: 'En Calidad'
            }, { transaction });
            
            await transaction.commit();
            
            // Respuesta exitosa
            res.json({
                success: true,
                message: `Pieza ${serial} enviada a calidad exitosamente`,
                data: {
                    id: pieza.id,
                    serial: pieza.serial,
                    estatus_anterior: estatusAnterior,
                    estatus_nuevo: 'En Calidad',
                    orden: pieza.orden ? {
                        id: pieza.orden.id,
                        numero_orden: pieza.orden.numero_orden
                    } : null,
                    fecha_actualizacion: new Date()
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error enviando pieza a calidad:', error);
            res.status(500).json({
                success: false,
                message: "Error interno al enviar la pieza a calidad"
            });
        }
    })
);*/

operadorRoute.put("/enviar-a-calidad", AsyncHandler(async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { serial } = req.body;
        
        // ID del usuario que realiza el cambio. 
        // Si usas el middleware 'protect', usa: req.usuario.id
        const usuarioId = 1; 

        // 1. Validar que viene el serial
        if (!serial) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "El serial de la pieza es requerido"
            });
        }
        
        // 2. Buscar la pieza por serial
        const pieza = await Pieza.findOne({
            where: { serial: serial },
            include: [
                {
                    model: OrdenTrabajo,
                    as: 'orden',
                    attributes: ['id', 'numero_orden']
                }
            ],
            transaction
        });
        
        // 3. Verificar si la pieza existe
        if (!pieza) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: `Pieza con serial ${serial} no encontrada`
            });
        }
        
        // 4. Verificar estatus (Solo se envía a calidad si está en SMT o Retrabajo)
        if (pieza.estatus !== 'En Proceso SMT' && pieza.estatus !== 'Retrabajo') {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `La pieza está en "${pieza.estatus}". No se puede enviar a calidad.`,
                estatus_actual: pieza.estatus
            });
        }
        
        const estatusAnterior = pieza.estatus;
        const estatusNuevo = 'En Calidad';
        
        // 5. ACTUALIZAR ESTATUS DE LA PIEZA
        await pieza.update({
            estatus: estatusNuevo
        }, { transaction });

        // 6. REGISTRAR EL MOVIMIENTO EN LA TABLA MOVIMIENTOS
        await Movimiento.create({
            pieza_id: pieza.id,
            estatus_anterior: estatusAnterior,
            estatus_nuevo: estatusNuevo,
            cambiado_por: usuarioId,
            fecha: new Date()
        }, { transaction });
        
        // 7. Commit de la transacción (Ambas operaciones se guardan)
        await transaction.commit();
        
        // Respuesta exitosa
        res.json({
            success: true,
            message: `Pieza ${serial} enviada a calidad y movimiento registrado`,
            data: {
                serial: pieza.serial,
                movimiento: {
                    de: estatusAnterior,
                    a: estatusNuevo,
                    usuario_id: usuarioId
                },
                orden: pieza.orden ? pieza.orden.numero_orden : null,
                fecha: new Date()
            }
        });
        
    } catch (error) {
        // Si algo falla, se deshace la actualización y el movimiento
        if (transaction) await transaction.rollback();
        console.error('Error enviando pieza a calidad:', error);
        res.status(500).json({
            success: false,
            message: "Error interno al procesar el envío a calidad",
            error: error.message
        });
    }
}));



// API CONSULTAR PIEZA POR SERIAL (CORREGIDA)
operadorRoute.get("/pieza/serial/:serial", 
    AsyncHandler(async (req, res) => {
        try {
            const { serial } = req.params;
            
            const pieza = await Pieza.findOne({
                where: { serial: serial },
                include: [
                    {
                        model: OrdenTrabajo,
                        as: 'orden',  // Este alias está definido en index.js
                        attributes: ['id', 'numero_orden', 'cantidad_planeada', 'estatus']
                    },
                    {
                        model: Estacion,
                        as: 'estacion',  // Este alias está definido en index.js
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

// API LISTAR TODAS LAS PIEZAS POR ORDEN DE TRABAJO (SIN PAGINACIÓN - TODAS)
operadorRoute.get("/orden-trabajo/estadistica/:numero_orden", 
    AsyncHandler(async (req, res) => {
        try {
            const { numero_orden } = req.params;
            
            // 1. IMPORTANTE: Usar 'include' para traer las piezas asociadas
            const orden = await OrdenTrabajo.findOne({
                where: { numero_orden: numero_orden },
                include: [{
                    model: Pieza,
                    as: 'piezas' // Asegúrate de que este alias coincida con tu definición en index.js o la relación
                }]
            });
            
            if (!orden) {
                return res.status(404).json({
                    success: false,
                    message: `Orden de trabajo ${numero_orden} no encontrada`
                });
            }
            
            // 2. Extraer las piezas (si no hay, inicializar como array vacío)
            const listaPiezas = orden.piezas || [];
            
            // 3. Cálculos de estadísticas
            const totalPiezas = listaPiezas.length;
            const piezasEnProceso = listaPiezas.filter(p => p.estatus === 'En Proceso SMT').length;
            const piezasEnCalidad = listaPiezas.filter(p => p.estatus === 'En Calidad').length;
            const piezasOK = listaPiezas.filter(p => p.estatus === 'OK').length;
            const piezasRetrabajo = listaPiezas.filter(p => p.estatus === 'Retrabajo').length;
            const piezasScrap = listaPiezas.filter(p => p.estatus === 'Scrap').length;
            
            // 4. Calcular avance evitando el NaN (si total es 0)
            const porcentajeAvance = totalPiezas > 0 
                ? ((piezasOK / totalPiezas) * 100).toFixed(2) 
                : "0.00";
            
            res.json({  
                success: true,
                data: {
                    orden: {
                        id: orden.id,
                        numero_orden: orden.numero_orden,
                        cantidad_planeada: orden.cantidad_planeada,
                        proyecto: orden.proyecto,
                        estatus: orden.estatus,
                        fecha_inicio: orden.fecha_inicio
                    },
                    estadisticas: {
                        total: totalPiezas,
                        en_proceso_smt: piezasEnProceso,
                        en_calidad: piezasEnCalidad,
                        ok: piezasOK,
                        retrabajo: piezasRetrabajo,
                        scrap: piezasScrap,
                        avance: `${porcentajeAvance}%`
                    },
                    // Opcional: lista de seriales para el front-end
                    detalle_piezas: listaPiezas.map(p => ({
                        serial: p.serial,
                        estatus: p.estatus
                    }))
                }
            });
            
        } catch (error) {
            console.error('Error consultando estadísticas:', error);
            res.status(500).json({
                success: false,
                message: "Error interno al procesar estadísticas"
            });
        }
    })
);




// **********************APIS MENOS RELEVANTES*************************

// API LISTAR PIEZAS POR ORDEN CON PAGINACIÓN (opcional)
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
                        as: 'estacion',
                        attributes: ['id', 'nombre', 'descripcion']
                    }
                ],
                order: [['id', 'ASC']],
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

// API ACTUALIZAR ESTATUS DE PIEZA (genérica - más flexible)
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
                        as: 'orden',
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
            
            const estatusAnterior = pieza.estatus;
            
            // Actualizar datos de la pieza
            const updateData = { estatus };
            
            if (estacion_actual_id) {
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
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: `Estatus de pieza actualizado de "${estatusAnterior}" a "${estatus}"`,
                data: {
                    id: pieza.id,
                    serial: pieza.serial,
                    estatus_anterior: estatusAnterior,
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
2
module.exports = operadorRoute;