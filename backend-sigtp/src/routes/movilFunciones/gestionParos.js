const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const { QueryTypes } = require("sequelize");

const { sequelize } = require("../../models");

// Equivalente JS del script PHP de gestión de paros
// Endpoint único: POST /api/movil/gestion-paros con body { accion: "...", ... }
router.post("/gestion-paros", AsyncHandler(async (req, res) => {
    const accion = req.body.accion || "";

    switch (accion) {
        case "historial": {
            const sql = `
                SELECT p.id, p.motivo, p.fecha_inicio, p.fecha_fin, o.numero_orden 
                FROM paros_linea p
                INNER JOIN ordenes_trabajo o ON p.orden_id = o.id
                ORDER BY p.id DESC
            `;

            try {
                const filas = await sequelize.query(sql, { type: QueryTypes.SELECT });

                const datos = filas.map((row) => ({
                    ...row,
                    estado: !row.fecha_fin ? "ACTIVO" : "SOLUCIONADO",
                }));

                return res.json(datos);
            } catch (error) {
                console.error("Error historial paros_linea:", error);
                return res.json({ exito: false, mensaje: error.message });
            }
        }

        case "verificar_alerta": {
            const ultimoId = parseInt(req.body.ultimo_id, 10) || 0;

            const sql = `
                SELECT id, '¡NUEVO PARO DETECTADO!' AS titulo, motivo AS mensaje 
                FROM paros_linea 
                WHERE id > :ultimoId AND fecha_fin IS NULL 
                ORDER BY id DESC 
                LIMIT 1
            `;

            try {
                const filas = await sequelize.query(sql, {
                    replacements: { ultimoId },
                    type: QueryTypes.SELECT,
                });

                const resultado = filas.length > 0 ? filas[0] : null;
                return res.json(resultado);
            } catch (error) {
                console.error("Error verificar_alerta paros_linea:", error);
                return res.json({ exito: false, mensaje: error.message });
            }
        }

        default:
            return res.json({ exito: false, mensaje: "Acción inválida" });
    }
}));

module.exports = router;
