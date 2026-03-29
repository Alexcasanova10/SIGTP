const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrdenTrabajo = sequelize.define('ordenes_trabajo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    numero_orden: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    cantidad_planeada: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    proyecto: {
        type: DataTypes.ENUM('KIA', 'TOYOTA'),
        allowNull: false
    },

    estatus: {
        type: DataTypes.ENUM('Planeada', 'En Proceso', 'Pausada', 'Finalizada'),
        defaultValue: 'Planeada'
    },
    fecha_inicio: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    fecha_fin: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'ordenes_trabajo',
    timestamps: false
});

// Relación con Piezas (se define después de importar Pieza)
module.exports = OrdenTrabajo;