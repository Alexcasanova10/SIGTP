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

calidadRoute.put("/actualizar-estado-pieza/:serial", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { serial } = req.params; // Ahora recibimos el SERIAL (ej: SN-KIA-011)
            const { resultado, descripcion_falla } = req.body;
            
            // 1. Validar que el resultado sea válido
            const resultadosValidos = ['OK', 'Retrabajo', 'Scrap'];
            if (!resultado || !resultadosValidos.includes(resultado)) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Resultado inválido. Debe ser uno de: ${resultadosValidos.join(', ')}`
                });
            }
            
            // 2. Validar descripción de falla para dictámenes negativos
            if ((resultado === 'Retrabajo' || resultado === 'Scrap') && !descripcion_falla) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Para resultado "${resultado}" es obligatorio proporcionar una descripción de la falla`
                });
            }
            
            // 3. Buscar la pieza por SERIAL
            const pieza = await Pieza.findOne({ 
                where: { serial: serial },
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
                    message: `Pieza con serial ${serial} no encontrada`
                });
            }
            
            // 4. Verificar que la pieza esté realmente en "En Calidad"
            if (pieza.estatus !== 'En Calidad') {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `La pieza está en "${pieza.estatus}". Solo se pueden inspeccionar piezas en "En Calidad"`,
                });
            }
            
            // ID del inspector (Usuario de calidad)
            const usuarioId = 4; 
            const estatusAnterior = pieza.estatus;
            const nuevoEstatus = resultado; // OK, Retrabajo o Scrap
            
            // 5. ACTUALIZAR ESTATUS DE LA PIEZA
            await pieza.update({
                estatus: nuevoEstatus
            }, { transaction });

            // 6. REGISTRAR EL MOVIMIENTO (Trazabilidad)
            await Movimiento.create({
                pieza_id: pieza.id,
                estatus_anterior: estatusAnterior,
                estatus_nuevo: nuevoEstatus,
                cambiado_por: usuarioId,
                fecha: new Date()
            }, { transaction });
            
            // 7. REGISTRAR LA INSPECCIÓN (Detalle técnico)
            const inspeccion = await InspeccionCalidad.create({
                pieza_id: pieza.id,
                resultado: resultado,
                descripcion_falla: (resultado === 'OK') ? null : descripcion_falla,
                revisado_por: usuarioId,
                fecha: new Date()
            }, { transaction });
            
            // Guardar todo
            await transaction.commit();
            
            res.json({
                success: true,
                message: `Pieza ${pieza.serial} dictaminada como "${resultado}"`,
                data: {
                    serial: pieza.serial,
                    estatus_anterior: estatusAnterior,
                    estatus_nuevo: nuevoEstatus,
                    inspeccion_id: inspeccion.id,
                    cambiado_por: usuarioId
                },
                inspeccion: {
                    id: inspeccion.id,
                    resultado: inspeccion.resultado,
                    descripcion_falla: inspeccion.descripcion_falla,
                    revisado_por: usuarioId,
                    fecha: inspeccion.fecha
                }
            });
            
        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error('Error en inspección de calidad:', error);
            res.status(500).json({
                success: false,
                message: "Error interno al procesar la inspección",
                error: error.message
            });
        }
    })
);






// API 2: CONSULTAR PIEZAS DE UNA ORDEN CON ESTATUS "EN CALIDAD" USANDO EL NÚMERO DE ORDEN
calidadRoute.get("/orden/:numero_orden/piezas-en-calidad", 
    AsyncHandler(async (req, res) => {
        try {
            const { numero_orden } = req.params;
            
            // 1. Buscar la orden por numero_orden (ORD-KIA-011) para obtener su ID real
            const orden = await OrdenTrabajo.findOne({
                where: { numero_orden: numero_orden },
                attributes: ['id', 'numero_orden', 'cantidad_planeada', 'estatus']
            });
            
            if (!orden) {
                return res.status(404).json({
                    success: false,
                    message: `Orden de trabajo ${numero_orden} no encontrada`
                });
            }

            // Usamos el ID interno para las siguientes consultas
            const ordenIdInterno = orden.id;
            
            // 2. Buscar todas las piezas de la orden con estatus "En Calidad"
            const piezasEnCalidad = await Pieza.findAll({
                where: {
                    orden_id: ordenIdInterno,
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
            
            // 3. Estadísticas de calidad (usando el ID obtenido)
            const totalPiezasOrden = await Pieza.count({
                where: { orden_id: ordenIdInterno }
            });
            
            const piezasEnProceso = await Pieza.count({
                where: { 
                    orden_id: ordenIdInterno,
                    estatus: 'En Proceso SMT'
                }
            });
            
            const piezasOK = await Pieza.count({
                where: { 
                    orden_id: ordenIdInterno,
                    estatus: 'OK'
                }
            });
            
            const piezasRetrabajo = await Pieza.count({
                where: { 
                    orden_id: ordenIdInterno,
                    estatus: 'Retrabajo'
                }
            });
            
            const piezasScrap = await Pieza.count({
                where: { 
                    orden_id: ordenIdInterno,
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
                        porcentaje_pendiente_calidad: totalPiezasOrden > 0 
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

// API 5: OBTENER HISTORIAL DE MOVIMIENTOS DE UNA PIEZA POR SERIAL
calidadRoute.get("/pieza/:serial/historial", 
    AsyncHandler(async (req, res) => {
        try {
            const { serial } = req.params;

            // 1. Buscar la pieza para validar que existe y obtener su ID
            const pieza = await Pieza.findOne({
                where: { serial: serial },
                attributes: ['id', 'serial', 'estatus', 'fecha_registro'],
                include: [
                    {
                        model: OrdenTrabajo,
                        as: 'orden',
                        attributes: ['numero_orden', 'proyecto']
                    }
                ]
            });

            if (!pieza) {
                return res.status(404).json({
                    success: false,
                    message: `La pieza con serial ${serial} no existe.`
                });
            }

            // 2. Buscar todos los movimientos asociados a ese pieza_id
            const movimientos = await Movimiento.findAll({
                where: { pieza_id: pieza.id },
                include: [
                    {
                        model: Usuario,
                        // El alias debe coincidir con el que definiste en tu index.js/relaciones
                        // Si no pusiste alias, bórralo o usa el nombre del modelo
                        attributes: ['id', 'nombre', 'numero_empleado'] 
                    }
                ],
                order: [['fecha', 'DESC']] // De más reciente a más antiguo
            });

            // 3. Responder con la info de la pieza y su lista de movimientos
            res.json({
                success: true,
                count: movimientos.length,
                data: {
                    pieza: {
                        id: pieza.id,
                        serial: pieza.serial,
                        estatus_actual: pieza.estatus,
                        orden: pieza.orden ? pieza.orden.numero_orden : null,
                        proyecto: pieza.orden ? pieza.orden.proyecto : null,
                        fecha_creacion: pieza.fecha_registro
                    },
                    historial: movimientos.map(m => ({
                        id: m.id,
                        estatus_anterior: m.estatus_anterior,
                        estatus_nuevo: m.estatus_nuevo,
                        fecha: m.fecha,
                        usuario: m.usuario ? {
                            id: m.usuario.id,
                            nombre: m.usuario.nombre,
                            numero_empleado: m.usuario.numero_empleado
                        } : "Sistema / Desconocido"
                    }))
                }
            });

        } catch (error) {
            console.error('Error al obtener historial de la pieza:', error);
            res.status(500).json({
                success: false,
                message: "Error interno al obtener el historial",
                error: error.message
            });
        }
    })
);

module.exports = calidadRoute;