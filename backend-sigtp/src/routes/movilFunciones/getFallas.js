const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const { QueryTypes } = require("sequelize");

const { sequelize } = require("../../models");

// Equivalente JS de getFallas.php
// GET /api/movil/get-fallas
router.get("/get-fallas", AsyncHandler(async (req, res) => {
    const query = `
        SELECT 
            f.id,
            f.descripcion,
            f.prioridad,
            f.estatus_falla,
            DATE_FORMAT(f.fecha, '%H:%i') AS hora,
            e.url_imagen AS imagen
        FROM fallas_tecnicas f
        LEFT JOIN evidencias e ON f.id = e.falla_id
        ORDER BY f.id DESC
    `;

    try {
        const filas = await sequelize.query(query, { type: QueryTypes.SELECT });

        const fallas = filas.map(row => ({
            id: row.id,
            descripcion: row.descripcion,
            prioridad: row.prioridad,
            estatus_falla: row.estatus_falla,
            hora: row.hora,
            imagen: row.imagen || ""
        }));

        // Igual que el PHP: devolver solo el array
        return res.json(fallas);
    } catch (error) {
        console.error("Error getFallas:", error);
        return res.status(500).json({ error: true, mensaje: error.message });
    }
}));

module.exports = router;
