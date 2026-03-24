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
require('dotenv').config();

// Función para generar número de orden con formato: ORD_YYYYMMDD_000001 (consecutivo GLOBAL)
const generarNumeroOrden = async () => {
    try {
        const fecha = new Date();
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        const fechaFormateada = `${anio}${mes}${dia}`;
        
        // Buscar la ÚLTIMA orden creada en GENERAL (no solo por fecha)
        const ultimaOrden = await OrdenTrabajo.findOne({
            order: [['id', 'DESC']] // Ordenar por ID descendente para obtener la última
        });
        
        let numeroConsecutivo = 1;
        
        if (ultimaOrden && ultimaOrden.numero_orden) {
            // Extraer el número consecutivo de la última orden (último segmento después del último _)
            const partes = ultimaOrden.numero_orden.split('_');
            const ultimoNumero = parseInt(partes[partes.length - 1], 10);
            if (!isNaN(ultimoNumero)) {
                numeroConsecutivo = ultimoNumero + 1;
            }
        }
        
        // Formatear el número consecutivo a 6 dígitos
        const consecutivoFormateado = String(numeroConsecutivo).padStart(6, '0');
        
        return `ORD_${fechaFormateada}_${consecutivoFormateado}`;
        
    } catch (error) {
        console.error('Error generando número de orden:', error);
        // Fallback: generar con timestamp si hay error
        const timestamp = Date.now().toString().slice(-6);
        const fecha = new Date();
        const fechaFormateada = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
        return `ORD_${fechaFormateada}_${timestamp}`;
    }
};

// Función para generar serial de PCB con formato: PCB-IDORDEN-000001 (consecutivo por orden)
const generarSerialPCB = async (orden_id, numeroConsecutivo) => {
    try {
        // Formato: PCB-{orden_id}-{consecutivo de 6 dígitos}
        const consecutivoFormateado = String(numeroConsecutivo).padStart(6, '0');
        return `PCB-${orden_id}-${consecutivoFormateado}`;
        
    } catch (error) {
        console.error('Error generando serial:', error);
        // Fallback: generar con timestamp si hay error
        const timestamp = Date.now().toString().slice(-6);
        return `PCB-${orden_id}-${timestamp}`;
    }
};

// API CREAR ORDEN DE TRABAJO (con creación automática de seriales de piezas)
/*supervisorRoute.post("/generar-orden-trabajo", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { cantidad_planeada, estacion_actual_id } = req.body;
            
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
            
            // Validar estación si se proporcionó
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
            
            // Crear los seriales de las piezas según la cantidad planeada
            const piezasCreadas = [];
            
            for (let i = 1; i <= cantidad_planeada; i++) {
                // Generar serial para cada pieza (consecutivo por orden)
                const serial = await generarSerialPCB(nuevaOrden.id, i);
                
                const nuevaPieza = await Pieza.create({
                    serial: serial,
                    orden_id: nuevaOrden.id,
                    estacion_actual_id: estacion_actual_id || null,
                    estatus: 'En Proceso SMT',
                    fecha_registro: new Date()
                }, { transaction });
                
                piezasCreadas.push({
                    id: nuevaPieza.id,
                    serial: nuevaPieza.serial
                });
            }
            
            // Commit de la transacción
            await transaction.commit();
            
            // Respuesta exitosa con detalles de la orden y las piezas creadas
            res.status(201).json({
                success: true,
                message: `Orden de trabajo creada exitosamente con ${cantidad_planeada} piezas`,
                data: {
                    orden: {
                        id: nuevaOrden.id,
                        numero_orden: nuevaOrden.numero_orden,
                        cantidad_planeada: nuevaOrden.cantidad_planeada,
                        estatus: nuevaOrden.estatus,
                        fecha_inicio: nuevaOrden.fecha_inicio,
                        fecha_fin: nuevaOrden.fecha_fin
                    },
                    piezas: piezasCreadas,
                    resumen: {
                        total_piezas_creadas: piezasCreadas.length,
                        estacion_inicial: estacion_actual_id || 'No especificada'
                    }
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
);*/

// API CREAR ORDEN DE TRABAJO (con creación automática de seriales de piezas y registro de movimientos) --EXPERTMENTAL
supervisorRoute.post("/generar-orden-trabajo", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { cantidad_planeada, estacion_actual_id } = req.body;
            
            // TEMPORAL: Usar un usuario fijo (ID 1) hasta que tengas el middleware
            // Cambia esto por req.usuario.id cuando tengas el middleware
            const usuarioId = 1; // Supervisor que crea la orden
            
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
            
            // Validar estación si se proporcionó
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
            
            // Verificar que el usuario existe
            const usuarioExiste = await Usuario.findByPk(usuarioId, { transaction });
            if (!usuarioExiste) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `El usuario con ID ${usuarioId} no existe en la base de datos`
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
            
            // Crear los seriales de las piezas según la cantidad planeada
            const piezasCreadas = [];
            const movimientosCreados = [];
            
            for (let i = 1; i <= cantidad_planeada; i++) {
                // Generar serial para cada pieza
                const serial = await generarSerialPCB(nuevaOrden.id, i);
                
                // Crear la pieza
                const nuevaPieza = await Pieza.create({
                    serial: serial,
                    orden_id: nuevaOrden.id,
                    estacion_actual_id: estacion_actual_id || null,
                    estatus: 'En Proceso SMT',
                    fecha_registro: new Date()
                }, { transaction });
                
                piezasCreadas.push({
                    id: nuevaPieza.id,
                    serial: nuevaPieza.serial
                });
                
                // REGISTRAR MOVIMIENTO DE CREACIÓN DE LA PIEZA
                const movimiento = await Movimiento.create({
                    pieza_id: nuevaPieza.id,
                    estatus_anterior: null, // No hay estatus anterior porque se acaba de crear
                    estatus_nuevo: 'En Proceso SMT',
                    cambiado_por: usuarioId,
                    fecha: new Date()
                }, { transaction });
                
                movimientosCreados.push({
                    id: movimiento.id,
                    pieza_id: nuevaPieza.id,
                    serial: nuevaPieza.serial,
                    estatus_nuevo: 'En Proceso SMT'
                });
            }
            
            // Commit de la transacción
            await transaction.commit();
            
            // Respuesta exitosa con detalles de la orden, piezas y movimientos
            res.status(201).json({
                success: true,
                message: `Orden de trabajo creada exitosamente con ${cantidad_planeada} piezas`,
                data: {
                    orden: {
                        id: nuevaOrden.id,
                        numero_orden: nuevaOrden.numero_orden,
                        cantidad_planeada: nuevaOrden.cantidad_planeada,
                        estatus: nuevaOrden.estatus,
                        fecha_inicio: nuevaOrden.fecha_inicio,
                        fecha_fin: nuevaOrden.fecha_fin
                    },
                    piezas: piezasCreadas,
                    movimientos: {
                        total: movimientosCreados.length,
                        registros: movimientosCreados
                    },
                    resumen: {
                        total_piezas_creadas: piezasCreadas.length,
                        estacion_inicial: estacion_actual_id || 'No especificada',
                        usuario_creador: usuarioExiste.nombre
                    }
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error creando orden de trabajo:', error);
            
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

//**********MEJORAR
// API ESTADISTICAS DE ORDEN DE TRABAJO // cuales ordenes estan en “en proceso smt”, “en calidad” “ok” “retrabajo” y “scrap” 
supervisorRoute.get("/orden-trabajo/estadistica/:numero_orden", 
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
                    message: `Orden de trabajo con ID ${id} no encontrada`
                });
            }
            
            // Estadísticas de piezas
            const totalPiezas = orden.piezas?.length || 0;
            const piezasEnProceso = orden.piezas?.filter(p => p.estatus === 'En Proceso SMT').length || 0;
            const piezasEnCalidad = orden.piezas?.filter(p => p.estatus === 'En Calidad').length || 0;
            const piezasOK = orden.piezas?.filter(p => p.estatus === 'OK').length || 0;
            const piezasRetrabajo = orden.piezas?.filter(p => p.estatus === 'Retrabajo').length || 0;
            const piezasScrap = orden.piezas?.filter(p => p.estatus === 'Scrap').length || 0;
            
            res.json({
                success: true,
                data: {
                    orden: orden,
                    estadisticas: {
                        total: totalPiezas,
                        en_proceso_smt: piezasEnProceso,
                        en_calidad: piezasEnCalidad,
                        ok: piezasOK,
                        retrabajo: piezasRetrabajo,
                        scrap: piezasScrap,
                        avance: ((piezasOK / totalPiezas) * 100).toFixed(2) + '%'
                    },
                    piezas: orden.piezas
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












