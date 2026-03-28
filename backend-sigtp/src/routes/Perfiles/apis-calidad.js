const express = require("express");
const calidadRoute = express.Router();
const AsyncHandler = require("express-async-handler");
const Usuario = require("../../models/Usuario");
const Rol = require("../../models/Rol");
const Pieza = require("../../models/Pieza");
const InspeccionCalidad = require("../../models/InspeccionCalidad");
const OrdenTrabajo = require("../../models/OrdenTrabajo");
const Estacion = require("../../models/Estacion");
const Movimiento = require("../../models/Movimiento");
const protect = require("../../middlewares/Auth");
const { sequelize } = require('../../models');
const { Op } = require('sequelize');
require('dotenv').config();


// API 1: PARA ACTUALIZAR ESTADO DE PIEZA Y REGISTRAR INSPECCIÓN DE CALIDAD //OMITIR MIDDLWARE POR EL MOMENTO
calidadRoute.put("/actualizar-estado-pieza/:id", 
    // protect, // COMENTADO TEMPORALMENTE HASTA QUE EL MIDDLEWARE ESTÉ LISTO
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { id } = req.params;
            const { resultado, descripcion_falla } = req.body;
            
            // Validar que el resultado sea válido
            const resultadosValidos = ['OK', 'Retrabajo', 'Scrap'];
            if (!resultado || !resultadosValidos.includes(resultado)) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Resultado inválido. Debe ser uno de: ${resultadosValidos.join(', ')}`
                });
            }
            
            // Validar descripción de falla solo para Retrabajo o Scrap
            if ((resultado === 'Retrabajo' || resultado === 'Scrap') && !descripcion_falla) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Para resultado "${resultado}" es obligatorio proporcionar una descripción de la falla`
                });
            }
            
            // Buscar la pieza
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
            
            // Verificar que la pieza esté en estado "En Calidad"
            if (pieza.estatus !== 'En Calidad') {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `La pieza está en estado "${pieza.estatus}". Solo se pueden inspeccionar piezas en estado "En Calidad"`,
                    estatus_actual: pieza.estatus
                });
            }
            
            // TEMPORAL: Usar un usuario fijo (ID 1) hasta que tengas el middleware
            // Asegúrate de que exista un usuario con ID 4 en tu base de datos
            const usuarioId = 4; // Cambia esto por un ID que exista en tu tabla usuarios
            
            // Verificar que el usuario existe (opcional, para evitar errores)
            const usuarioExiste = await Usuario.findByPk(usuarioId, { transaction });
            if (!usuarioExiste) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `El usuario con ID ${usuarioId} no existe en la base de datos. Por favor, verifica.`
                });
            }
            
            // Guardar estado anterior
            const estatusAnterior = pieza.estatus;
            
            // Actualizar el estado de la pieza según el resultado
            let nuevoEstatus;
            if (resultado === 'OK') {
                nuevoEstatus = 'OK';
            } else if (resultado === 'Retrabajo') {
                nuevoEstatus = 'Retrabajo';
            } else if (resultado === 'Scrap') {
                nuevoEstatus = 'Scrap';
            }
            
            await pieza.update({
                estatus: nuevoEstatus
            }, { transaction });
            
            // Crear el registro de inspección de calidad
            const inspeccion = await InspeccionCalidad.create({
                pieza_id: pieza.id,
                resultado: resultado,
                descripcion_falla: (resultado === 'OK') ? null : descripcion_falla,
                revisado_por: usuarioId,
                fecha: new Date()
            }, { transaction });
            
            await transaction.commit();
            
            // Respuesta exitosa
            res.json({
                success: true,
                message: `Pieza ${pieza.serial} inspeccionada y marcada como "${resultado}"`,
                data: {
                    pieza: {
                        id: pieza.id,
                        serial: pieza.serial,
                        estatus_anterior: estatusAnterior,
                        estatus_nuevo: nuevoEstatus,
                        orden: pieza.orden
                    },
                    inspeccion: {
                        id: inspeccion.id,
                        resultado: inspeccion.resultado,
                        descripcion_falla: inspeccion.descripcion_falla,
                        revisado_por: usuarioId,
                        fecha: inspeccion.fecha
                    }
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error en inspección de calidad:', error);
            res.status(500).json({
                success: false,
                message: "Error interno al procesar la inspección de calidad",
                error: error.message
            });
        }
    })
);


// API 2: CONSULTAR PIEZAS DE UNA ORDEN CON ESTATUS "EN CALIDAD"
calidadRoute.get("/orden/:orden_id/piezas-en-calidad", 
    AsyncHandler(async (req, res) => {
        try {
            const { orden_id } = req.params;
            
            // Verificar que la orden existe
            const orden = await OrdenTrabajo.findByPk(orden_id, {
                attributes: ['id', 'numero_orden', 'cantidad_planeada', 'estatus']
            });
            
            if (!orden) {
                return res.status(404).json({
                    success: false,
                    message: `Orden de trabajo con ID ${orden_id} no encontrada`
                });
            }
            
            // Buscar todas las piezas de la orden con estatus "En Calidad"
            const piezasEnCalidad = await Pieza.findAll({
                where: {
                    orden_id: orden_id,
                    estatus: 'En Calidad'
                },
                include: [
                    {
                        model: OrdenTrabajo,
                        as: 'orden',
                        attributes: ['id', 'numero_orden', 'cantidad_planeada', 'estatus']
                    },
                    {
                        model: Estacion,
                        as: 'estacion',
                        attributes: ['id', 'nombre', 'descripcion']
                    }
                ],
                order: [['id', 'ASC']]
            });
            
            // Estadísticas de calidad
            const totalPiezasOrden = await Pieza.count({
                where: { orden_id: orden_id }
            });
            
            const piezasEnProceso = await Pieza.count({
                where: { 
                    orden_id: orden_id,
                    estatus: 'En Proceso SMT'
                }
            });
            
            const piezasOK = await Pieza.count({
                where: { 
                    orden_id: orden_id,
                    estatus: 'OK'
                }
            });
            
            const piezasRetrabajo = await Pieza.count({
                where: { 
                    orden_id: orden_id,
                    estatus: 'Retrabajo'
                }
            });
            
            const piezasScrap = await Pieza.count({
                where: { 
                    orden_id: orden_id,
                    estatus: 'Scrap'
                }
            });
            
            res.json({
                success: true,
                data: {
                    orden: orden,
                    resumen_calidad: {
                        total_piezas_orden: totalPiezasOrden,
                        piezas_en_calidad: piezasEnCalidad.length,
                        piezas_en_proceso: piezasEnProceso,
                        piezas_ok: piezasOK,
                        piezas_retrabajo: piezasRetrabajo,
                        piezas_scrap: piezasScrap,
                        porcentaje_calidad: totalPiezasOrden > 0 
                            ? ((piezasEnCalidad.length / totalPiezasOrden) * 100).toFixed(2) + '%' 
                            : '0%'
                    },
                    piezas: piezasEnCalidad
                }
            });
            
        } catch (error) {
            console.error('Error consultando piezas en calidad:', error);
            res.status(500).json({
                success: false,
                message: "Error al consultar las piezas en calidad"
            });
        }
    })
);

// API 3: CONSULTAR UNA PIEZA ESPECÍFICA EN CALIDAD POR SU SERIAL
calidadRoute.get("/pieza-en-calidad/serial/:serial", 
    AsyncHandler(async (req, res) => {
        try {
            const { serial } = req.params;
            
            const pieza = await Pieza.findOne({
                where: {
                    serial: serial,
                    estatus: 'En Calidad'
                },
                include: [
                    {
                        model: OrdenTrabajo,
                        as: 'orden',
                        attributes: ['id', 'numero_orden', 'cantidad_planeada', 'estatus']
                    },
                    {
                        model: Estacion,
                        as: 'estacion',
                        attributes: ['id', 'nombre', 'descripcion']
                    }
                ]
            });
            
            if (!pieza) {
                return res.status(404).json({
                    success: false,
                    message: `Pieza con serial ${serial} no encontrada o no está en estado "En Calidad"`
                });
            }
            
            res.json({
                success: true,
                data: pieza
            });
            
        } catch (error) {
            console.error('Error consultando pieza en calidad:', error);
            res.status(500).json({
                success: false,
                message: "Error al consultar la pieza en calidad"
            });
        }
    })
);

// API 4: CONSULTAR TODAS LAS PIEZAS EN CALIDAD (SIN FILTRO DE ORDEN)
calidadRoute.get("/todas-piezas-en-calidad", 
    AsyncHandler(async (req, res) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            
            const offset = (page - 1) * limit;
            
            const { count, rows } = await Pieza.findAndCountAll({
                where: {
                    estatus: 'En Calidad'
                },
                include: [
                    {
                        model: OrdenTrabajo,
                        as: 'orden',
                        attributes: ['id', 'numero_orden', 'cantidad_planeada']
                    },
                    {
                        model: Estacion,
                        as: 'estacion',
                        attributes: ['id', 'nombre']
                    }
                ],
                order: [['fecha_registro', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.json({
                success: true,
                data: {
                    total: count,
                    page: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    piezas: rows
                }
            });
            
        } catch (error) {
            console.error('Error consultando todas las piezas en calidad:', error);
            res.status(500).json({
                success: false,
                message: "Error al consultar las piezas en calidad"
            });
        }
    })
);

module.exports = calidadRoute;