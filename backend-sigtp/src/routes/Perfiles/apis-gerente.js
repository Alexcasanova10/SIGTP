const Estacion = require("../../models/Estacion");
const OrdenTrabajo = require("../../models/OrdenTrabajo");
const Pieza = require("../../models/Pieza"); 
const Movimiento = require("../../models/Movimiento");
const ParoLinea = require("../../models/ParoLinea");

const express = require("express");
const gerenteRoute = express.Router();
const AsyncHandler = require("express-async-handler");
const Usuario = require("../../models/Usuario");
const Rol = require("../../models/Rol");
const protect = require("../../middlewares/Auth");
const { Op } = require('sequelize'); // Asegúrate de tener Op importado

const generateToken = require("../../tokenGenerate");
const bcrypt = require('bcryptjs');
const { sequelize } = require('../../models');
require('dotenv').config();


// --- FUNCIÓN GENERADORA ACTUALIZADA ---
const generarNumeroEmpleado = async (nombreRol) => {
    try {
        // 1. Obtener letra inicial (T, I, G, O, C, S)
        const letraInicial = nombreRol.charAt(0).toUpperCase();

        // 2. Buscar el último usuario que tenga esa misma letra inicial
        const ultimoUsuario = await Usuario.findOne({
            where: {
                numero_empleado: {
                    [Op.like]: `${letraInicial}%`
                }
            },
            order: [['numero_empleado', 'DESC']],
            attributes: ['numero_empleado']
        });

        if (!ultimoUsuario || !ultimoUsuario.numero_empleado) {
            // Si es el primero de este rol, empezamos en 001
            return `${letraInicial}001`;
        }

        // 3. Extraer la parte numérica (quitamos la letra) y sumamos 1
        // Ejemplo: 'T003' -> extrae '003' -> convierte a 3 -> suma a 4
        const parteNumerica = ultimoUsuario.numero_empleado.substring(1);
        const ultimoNumero = parseInt(parteNumerica, 10);
        
        // Si por alguna razón no es un número (como el 000NaN que tenías), empezamos de 1
        const siguienteNumero = isNaN(ultimoNumero) ? 1 : ultimoNumero + 1;

        // 4. Formatear con ceros a la izquierda (3 dígitos)
        const nuevoNumeroStr = siguienteNumero.toString().padStart(3, '0');
        
        return `${letraInicial}${nuevoNumeroStr}`;
    } catch (error) {
        console.error('Error generando número de empleado:', error);
        return `ERR${Date.now().toString().slice(-3)}`;
    }
};


// API DE REGISTRO DE USUARIO
gerenteRoute.post("/registro-usuario", AsyncHandler(async (req, res) => {
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

        if (password.length < 6) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: "La contraseña debe tener al menos 6 caracteres"
            });
        }

        // 1. Verificar que el rol existe (Necesario para obtener el nombre y la letra)
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

        // 2. Generar número de empleado usando el NOMBRE DEL ROL
        const numeroEmpleado = await generarNumeroEmpleado(rolExistente.nombre);

        // Encriptar password
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        // 3. Crear el usuario
        const nuevoUsuario = await Usuario.create({
            nombre: nombre,
            numero_empleado: numeroEmpleado, // Nuevo formato: T004, G002, etc.
            password: passwordEncriptada,
            rol_id: rol_id,
            activo: true,
            fecha_creacion: new Date()
        }, { transaction });

        await transaction.commit();

        res.status(201).json({
            success: true,
            message: "Usuario registrado exitosamente",
            data: {
                id: nuevoUsuario.id,
                nombre: nuevoUsuario.nombre,
                numero_empleado: nuevoUsuario.numero_empleado,
                rol_id: nuevoUsuario.rol_id,
                rol_nombre: rolExistente.nombre,
                activo: nuevoUsuario.activo,
                fecha_creacion: nuevoUsuario.fecha_creacion
            }
        });

    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        console.error('Error en registro:', error);
        res.status(500).json({
            success: false,
            message: "Error interno del servidor al registrar usuario"
        });
    }
}));

// API Obtener KPIs de producción del día actual
gerenteRoute.get("/kpis-produccion-hoy", AsyncHandler(async (req, res) => {
    try {
        // 1. Configurar el rango de fecha (Hoy)
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);

        const finDia = new Date();
        finDia.setHours(23, 59, 59, 999);

        // 2. Consultar piezas creadas hoy y contar por estatus
        // Usamos findAll con atributos de agregación para mayor eficiencia
        const statsPiezas = await Pieza.findAll({
            where: {
                fecha_registro: {
                    [Op.between]: [inicioDia, finDia]
                }
            },
            attributes: [
                'estatus',
                [sequelize.fn('COUNT', sequelize.col('id')), 'total']
            ],
            group: ['estatus']
        });

        // 3. Consultar cuántas Órdenes de Trabajo se crearon hoy
        const totalOrdenesHoy = await OrdenTrabajo.count({
            where: {
                fecha_inicio: {
                    [Op.between]: [inicioDia, finDia]
                }
            }
        });

        // 4. Formatear los resultados para que sean fáciles de leer
        let conteos = {
            total_piezas: 0,
            ok: 0,
            retrabajo: 0,
            scrap: 0,
            en_proceso_smt: 0,
            en_calidad: 0
        };

        statsPiezas.forEach(item => {
            const total = parseInt(item.get('total'));
            const estatus = item.estatus;
            conteos.total_piezas += total;

            if (estatus === 'OK') conteos.ok = total;
            else if (estatus === 'Retrabajo') conteos.retrabajo = total;
            else if (estatus === 'Scrap') conteos.scrap = total;
            else if (estatus === 'En Proceso SMT') conteos.en_proceso_smt = total;
            else if (estatus === 'En Calidad') conteos.en_calidad = total;
        });

        // 5. Calcular First Pass Yield (FPY) - Porcentaje de piezas OK sobre el total
        const fpy = conteos.total_piezas > 0 
            ? ((conteos.ok / conteos.total_piezas) * 100).toFixed(2) 
            : "0.00";

        res.json({
            success: true,
            data: {
                fecha: inicioDia.toISOString().split('T')[0],
                resumen_ordenes: {
                    ordenes_creadas_hoy: totalOrdenesHoy
                },
                produccion_piezas: {
                    total_producido: conteos.total_piezas,
                    detalle: {
                        bueno_ok: conteos.ok,
                        retrabajo: conteos.retrabajo,
                        desecho_scrap: conteos.scrap,
                        en_linea_smt: conteos.en_proceso_smt,
                        esperando_calidad: conteos.en_calidad
                    }
                },
                indicadores_calidad: {
                    fpy_porcentaje: `${fpy}%`,
                    scrap_rate: conteos.total_piezas > 0 
                        ? ((conteos.scrap / conteos.total_piezas) * 100).toFixed(2) + '%' 
                        : '0%'
                }
            }
        });

    } catch (error) {
        console.error('Error al generar KPIs de gerencia:', error);
        res.status(500).json({
            success: false,
            message: "Error interno al obtener indicadores de producción",
            error: error.message
        });
    }
}));

//API DE CONSUTLAR PERFORMANCE POR DE ORDEND DE TRABAJO
gerenteRoute.get("/orden-trabajo/estadistica/:numero_orden", 
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


// API DE AUTORIZAR PARO DE LINEA
// API: GENERAR PARO DE LÍNEA SI HAY 3 O MÁS PIEZAS CON FALLAS HOY
gerenteRoute.post("/generar-paro-linea", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { numero_orden, motivo } = req.body;
            const registrado_por = 3; // ID estático temporal como solicitaste

            // 1. Validaciones de entrada
            if (!numero_orden || !motivo) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "El número de orden y el motivo son obligatorios"
                });
            }

            // 2. Buscar la Orden de Trabajo por su número (ORD-KIA-011)
            const orden = await OrdenTrabajo.findOne({
                where: { numero_orden: numero_orden },
                transaction
            });

            if (!orden) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: `La orden ${numero_orden} no existe`
                });
            }

            // 3. Definir el rango de tiempo de HOY (00:00:00 a 23:59:59)
            const inicioDia = new Date();
            inicioDia.setHours(0, 0, 0, 0);
            const finDia = new Date();
            finDia.setHours(23, 59, 59, 999);

            // 4. Contar piezas en Scrap o Retrabajo de esta orden HOY
            // Usamos la tabla Pieza filtrando por fecha_registro o estatus (según tu flujo)
            // Lo más preciso es contar las piezas cuyo estatus actual sea falla
            const piezasConFalla = await Pieza.count({
                where: {
                    orden_id: orden.id,
                    estatus: { [Op.in]: ['Scrap', 'Retrabajo'] },
                    // Asumimos que la falla ocurrió hoy basado en la fecha de registro 
                    // o podrías filtrar por la tabla Movimientos si quieres ser más exacto
                    fecha_registro: { [Op.between]: [inicioDia, finDia] }
                },
                transaction
            });

            // 5. Validar regla de negocio (Mínimo 3 fallas para autorizar paro)
            const LIMITE_FALLAS = 3;
            if (piezasConFalla < LIMITE_FALLAS) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `No se autoriza el paro. Se requieren al menos ${LIMITE_FALLAS} fallas hoy. (Fallas actuales: ${piezasConFalla})`,
                    fallas_detectadas: piezasConFalla
                });
            }

            // 6. Crear el registro de Paro de Línea
            const nuevoParo = await ParoLinea.create({
                orden_id: orden.id,
                motivo: motivo,
                registrado_por: registrado_por,
                fecha_inicio: new Date()
            }, { transaction });

            // 7. Opcional: Podrías actualizar el estatus de la Orden a "Detenida"
            await orden.update({ estatus: 'Pausada' }, { transaction });

            await transaction.commit();

            res.status(201).json({
                success: true,
                message: "Paro de línea autorizado y registrado exitosamente",
                data: {
                    id_paro: nuevoParo.id,
                    orden: numero_orden,
                    fallas_hoy: piezasConFalla,
                    motivo: motivo,
                    autorizado_por_id: registrado_por,
                    fecha_inicio: nuevoParo.fecha_inicio
                }
            });

        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error('Error al generar paro de línea:', error);
            res.status(500).json({
                success: false,
                message: "Error interno al procesar el paro de línea",
                error: error.message
            });
        }
    })
);

// API: LEVANTAR PARO DE LÍNEA Y REANUDAR ORDEN
gerenteRoute.put("/levantar-paro-linea/:numero_orden", 
    AsyncHandler(async (req, res) => {
        const transaction = await sequelize.transaction();
        
        try {
            const { numero_orden } = req.params;
            const { nuevo_estatus } = req.body; // Puede ser 'En Proceso' o 'Finalizada'

            // 1. Validar estatus permitido
            const estatusPermitidos = ['En Proceso', 'Finalizada'];
            const estatusFinal = nuevo_estatus || 'En Proceso';

            if (!estatusPermitidos.includes(estatusFinal)) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "El estatus de reanudación debe ser 'En Proceso' o 'Finalizada'"
                });
            }

            // 2. Buscar la orden por numero_orden
            const orden = await OrdenTrabajo.findOne({
                where: { numero_orden: numero_orden },
                transaction
            });

            if (!orden) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: `La orden ${numero_orden} no existe`
                });
            }

            // 3. Buscar el paro activo (el que no tiene fecha_fin) para esa orden
            const paroActivo = await ParoLinea.findOne({
                where: {
                    orden_id: orden.id,
                    fecha_fin: null // Buscamos el que sigue abierto
                },
                order: [['fecha_inicio', 'DESC']],
                transaction
            });

            if (!paroActivo) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `No se encontró un paro de línea activo para la orden ${numero_orden}`
                });
            }

            // 4. Actualizar el registro de Paro (Cerrar el tiempo)
            await paroActivo.update({
                fecha_fin: new Date()
            }, { transaction });

            // 5. Actualizar el estatus de la Orden de Trabajo
            await orden.update({
                estatus: estatusFinal
            }, { transaction });

            await transaction.commit();

            // 6. Calcular duración (opcional para la respuesta)
            const duracionMs = new Date() - new Date(paroActivo.fecha_inicio);
            const minutos = Math.floor(duracionMs / 60000);

            res.json({
                success: true,
                message: `Línea reanudada. Orden ${numero_orden} ahora está "${estatusFinal}"`,
                data: {
                    orden: numero_orden,
                    nuevo_estatus: estatusFinal,
                    paro_detalles: {
                        inicio: paroActivo.fecha_inicio,
                        fin: new Date(),
                        duracion_estimada: `${minutos} minutos`
                    }
                }
            });

        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error('Error al levantar paro de línea:', error);
            res.status(500).json({
                success: false,
                message: "Error interno al reanudar la línea",
                error: error.message
            });
        }
    })
);


module.exports = gerenteRoute;