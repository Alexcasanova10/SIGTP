const express = require("express");
const router = express.Router();
const AsyncHandler = require("express-async-handler");
const crypto = require("crypto");
const { Op } = require("sequelize");

const Usuario = require("../../models/Usuario");

// Equivalente JS de crudUsuarios.php
// Endpoint: POST /api/movil/crud-usuarios
router.post("/crud-usuarios", AsyncHandler(async (req, res) => {
    const data = req.body || {};

    const accion = data.accion || req.query.accion || "leer";

    switch (accion) {
        case "leer": {
            try {
                const usuarios = await Usuario.findAll({
                    where: { activo: true },
                    attributes: ["id", "nombre", "numero_empleado", "rol_id"],
                    order: [["id", "DESC"]]
                });

                return res.json({ error: false, usuarios });
            } catch (error) {
                console.error("Error leer usuarios:", error);
                return res.json({ error: true, mensaje: error.message });
            }
        }

        case "verificar": {
            const numero_empleado = data.numero_empleado;
            const id = data.id || 0;

            if (!numero_empleado) {
                // En el PHP, si falta, simplemente haría la consulta vacía; aquí respondemos explícitamente
                return res.json({ ocupado: false });
            }

            try {
                const where = { numero_empleado };
                if (id) {
                    where.id = { [Op.ne]: id };
                }

                const count = await Usuario.count({ where });
                return res.json({ ocupado: count > 0 });
            } catch (error) {
                console.error("Error verificar numero_empleado:", error);
                return res.json({ ocupado: false });
            }
        }

        case "crear": {
            const { nombre, numero_empleado, password, rol_id } = data;

            if (!nombre || !numero_empleado || !password || !rol_id) {
                return res.json({ error: true, mensaje: "Faltan campos obligatorios" });
            }

            // Replicar PHP: contraseña MD5
            const pass_md5 = crypto.createHash("md5").update(password).digest("hex");

            try {
                await Usuario.create({
                    nombre,
                    numero_empleado,
                    password: pass_md5,
                    rol_id,
                    activo: true
                });

                return res.json({ error: false });
            } catch (error) {
                console.error("Error crear usuario:", error);
                return res.json({ error: true, mensaje: error.message });
            }
        }

        case "actualizar": {
            const { id, nombre, numero_empleado, rol_id, password } = data;

            if (!id || !nombre || !numero_empleado || !rol_id) {
                return res.json({ error: true, mensaje: "Faltan campos obligatorios" });
            }

            try {
                const usuario = await Usuario.findByPk(id);
                if (!usuario) {
                    return res.json({ error: true, mensaje: "Usuario no encontrado" });
                }

                const updateData = {
                    nombre,
                    numero_empleado,
                    rol_id
                };

                if (password && password.trim() !== "") {
                    const pass_md5 = crypto.createHash("md5").update(password).digest("hex");
                    updateData.password = pass_md5;
                }

                await usuario.update(updateData);

                return res.json({ error: false });
            } catch (error) {
                console.error("Error actualizar usuario:", error);
                return res.json({ error: true, mensaje: error.message });
            }
        }

        default:
            return res.json({ error: true, mensaje: "Accion no soportada" });
    }
}));

module.exports = router;
