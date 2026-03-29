const express = require("express");
const supervisorRoute = express.Router();
const AsyncHandler = require("express-async-handler");
const Usuario = require("../../models/Usuario");
const Rol = require("../../models/Rol");
const Estacion = require("../../models/Estacion");
const OrdenTrabajo = require("../../models/OrdenTrabajo");
const Pieza = require("../../models/Pieza"); 
const Movimiento = require("../../models/Movimiento");
const protect = require("../../middlewares/Auth");
const { sequelize } = require('../../models');
const { Op } = require('sequelize');
require('dotenv').config();

// Genera: ORD-KIA-001, ORD-TOY-005, etc.
const generarNumeroOrden = async (proyecto) => {
    try {
        const prefijo = `ORD-${proyecto.substring(0, 3).toUpperCase()}-`;
        
        const ultimaOrden = await OrdenTrabajo.findOne({
            where: {
                numero_orden: { [Op.like]: `${prefijo}%` }
            },
            order: [['numero_orden', 'DESC']]
        });

        let siguienteNumero = 1;
        if (ultimaOrden) {
            // Extrae el número después del último guion
            const partes = ultimaOrden.numero_orden.split('-');
            const ultimoNumero = parseInt(partes[partes.length - 1], 10);
            siguienteNumero = isNaN(ultimoNumero) ? 1 : ultimoNumero + 1;
        }

        return `${prefijo}${siguienteNumero.toString().padStart(3, '0')}`;
    } catch (error) {
        console.error('Error en generarNumeroOrden:', error);
        return `ORD-${proyecto.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-3)}`;
    }
};

// Genera: SN-KIA-001, SN-TOY-005, etc. (Independiente por proyecto)
const generarSerialPieza = async (proyecto) => {
    try {
        const prefijo = `SN-${proyecto.substring(0, 3).toUpperCase()}-`;
        
        const ultimaPieza = await Pieza.findOne({
            where: {
                serial: { [Op.like]: `${prefijo}%` }
            },
            order: [['serial', 'DESC']]
        });

        let siguienteNumero = 1;
        if (ultimaPieza) {
            const partes = ultimaPieza.serial.split('-');
            const ultimoNumero = parseInt(partes[partes.length - 1], 10);
            siguienteNumero = isNaN(ultimoNumero) ? 1 : ultimoNumero + 1;
        }

        return { prefijo, siguienteNumero };
    } catch (error) {
        console.error('Error en generarSerialPieza:', error);
        throw error;
    }
};

// API CREAR ORDEN DE TRABAJO (con creación automática de seriales de piezas y registro de movimientos)
supervisorRoute.post("/generar-orden-trabajo", AsyncHandler(async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { cantidad_planeada, estacion_actual_id, proyecto } = req.body;
        const usuarioId = 13; // Ajustar cuando tengas Auth middleware

        // 1. Validaciones
        if (!cantidad_planeada || !proyecto) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "cantidad_planeada y proyecto (KIA/TOYOTA) son obligatorios"
            });
        }

        // Validar si el proyecto es válido para el ENUM
        if (!['KIA', 'TOYOTA'].includes(proyecto.toUpperCase())) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: "Proyecto inválido. Use KIA o TOYOTA" });
        }

        // 2. Generar número de orden (Ej: ORD-KIA-001)
        const numeroOrden = await generarNumeroOrden(proyecto);

        // 3. Crear la orden de trabajo
        const nuevaOrden = await OrdenTrabajo.create({
            numero_orden: numeroOrden,
            cantidad_planeada: cantidad_planeada,
            proyecto: proyecto.toUpperCase(),
            estatus: 'Planeada',
            fecha_inicio: new Date()
        }, { transaction });

        // 4. Preparar la secuencia de Seriales
        // Obtenemos desde dónde empezar la numeración global de este proyecto
        let { prefijo, siguienteNumero } = await generarSerialPieza(proyecto);

        const piezasCreadas = [];
        const movimientosCreados = [];

        // 5. Crear piezas y movimientos en bucle
        for (let i = 0; i < cantidad_planeada; i++) {
            const serialUnico = `${prefijo}${(siguienteNumero + i).toString().padStart(3, '0')}`;

            const nuevaPieza = await Pieza.create({
                serial: serialUnico,
                orden_id: nuevaOrden.id,
                estacion_actual_id: estacion_actual_id || null,
                estatus: 'En Proceso SMT',
                fecha_registro: new Date()
            }, { transaction });

            // Registrar Movimiento inicial para cada pieza
            const movimiento = await Movimiento.create({
                pieza_id: nuevaPieza.id,
                estatus_anterior: null,
                estatus_nuevo: 'En Proceso SMT',
                cambiado_por: usuarioId,
                fecha: new Date()
            }, { transaction });

            piezasCreadas.push({ id: nuevaPieza.id, serial: nuevaPieza.serial });
        }

        await transaction.commit();

        res.status(201).json({
            success: true,
            message: `Orden ${numeroOrden} generada con ${cantidad_planeada} piezas.`,
            data: {
                orden_id: nuevaOrden.id,
                numero_orden: nuevaOrden.numero_orden,
                proyecto: nuevaOrden.proyecto,
                piezas: piezasCreadas
            }
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('ERROR:', error);
        res.status(500).json({
            success: false,
            message: "Error al generar la orden y piezas",
            error: error.message
        });
    }
}));



// API CONSULTAR ORDEN DE TRABAJO CON SUS PIEZAS
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

// API ESTADISTICAS DE ORDEN DE TRABAJO // cuales ordenes estan en “en proceso smt”, “en calidad” “ok” “retrabajo” y “scrap” 
 
supervisorRoute.get("/orden-trabajo/estadistica/:numero_orden", 
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


// API ACTUALIZAR ESTATUS DE ORDEN
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
                    message: `Orden de trabajo con ID ${numero_orden} no encontrada`
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


// API LISTAR TODAS LAS ÓRDENES DE TRABAJO
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
                include: [{
                    model: Pieza,
                    as: 'piezas',
                    attributes: ['id', 'estatus'],
                    required: false
                }],
                order: [['fecha_inicio', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            // Agregar estadísticas básicas a cada orden
            const ordenesConEstadisticas = rows.map(orden => {
                const piezas = orden.piezas || [];
                const total = piezas.length;
                const piezasOK = piezas.filter(p => p.estatus === 'OK').length;
                
                return {
                    id: orden.id,
                    numero_orden: orden.numero_orden,
                    cantidad_planeada: orden.cantidad_planeada,
                    estatus: orden.estatus,
                    fecha_inicio: orden.fecha_inicio,
                    fecha_fin: orden.fecha_fin,
                    estadisticas: {
                        total_piezas: total,
                        piezas_ok: piezasOK,
                        avance: total > 0 ? ((piezasOK / total) * 100).toFixed(2) + '%' : '0%'
                    }
                };
            });
            
            res.json({
                success: true,
                data: {
                    total: count,
                    page: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    ordenes: ordenesConEstadisticas
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



//------------------APIS MENOS RELEVANTES, PERO ÚTILES

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












