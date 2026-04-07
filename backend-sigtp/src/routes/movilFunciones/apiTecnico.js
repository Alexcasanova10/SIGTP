const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const { QueryTypes } = require("sequelize");

const { sequelize } = require("../../models");

// Equivalente JS de apiTecnico.php
// Endpoint único: POST /api/movil/api-tecnico con body { accion: "...", ... }
router.post("/api-tecnico", AsyncHandler(async (req, res) => {
    const accion = req.body.accion || "";

    switch (accion) {
        case "obtener_fallas": {
            const sql = `
                SELECT 
                    id, 
                    linea, 
                    falla, 
                    descripcion, 
                    DATE_FORMAT(hora_registro, '%H:%i') AS hora
                FROM fallas
                WHERE estado != 'Cerrado'
            `;

            try {
                const datos = await sequelize.query(sql, { type: QueryTypes.SELECT });
                return res.json({ exito: true, datos });
            } catch (error) {
                console.error("Error obtener_fallas (técnico):", error);
                return res.json({ exito: false, mensaje: error.message });
            }
        }

        case "actualizar_falla": {
            const id = req.body.id_falla;
            const estado = req.body.estado;

            if (!id || !estado) {
                return res.json({ exito: false, mensaje: "Faltan parámetros" });
            }

            try {
                await sequelize.query(
                    "UPDATE fallas SET estado = :estado WHERE id = :id",
                    {
                        replacements: { estado, id },
                        type: QueryTypes.UPDATE
                    }
                );
                return res.json({ exito: true });
            } catch (error) {
                console.error("Error actualizar_falla (técnico):", error);
                return res.json({ exito: false, mensaje: error.message });
            }
        }

        case "obtener_retrabajos": {
            const sql = `
                SELECT 
                    id,
                    linea,
                    retrabajo
                FROM retrabajos
                WHERE estado = 'Pendiente'
            `;

            try {
                const datos = await sequelize.query(sql, { type: QueryTypes.SELECT });
                return res.json({ exito: true, datos });
            } catch (error) {
                console.error("Error obtener_retrabajos (técnico):", error);
                return res.json({ exito: false, mensaje: error.message });
            }
        }

        case "validar_retrabajo": {
            const id = req.body.id_retrabajo;
            const estado = req.body.estado; // 'Aceptado' o 'No Viable'

            if (!id || !estado) {
                return res.json({ exito: false, mensaje: "Faltan parámetros" });
            }

            try {
                await sequelize.query(
                    "UPDATE retrabajos SET estado = :estado WHERE id = :id",
                    {
                        replacements: { estado, id },
                        type: QueryTypes.UPDATE
                    }
                );
                return res.json({ exito: true });
            } catch (error) {
                console.error("Error validar_retrabajo (técnico):", error);
                return res.json({ exito: false, mensaje: error.message });
            }
        }

        default:
            return res.json({ exito: false, mensaje: "Acción inválida" });
    }
}));

module.exports = router;
