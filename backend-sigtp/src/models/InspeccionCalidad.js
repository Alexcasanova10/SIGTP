const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InspeccionCalidad = sequelize.define('inspecciones_calidad', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    pieza_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'piezas',
            key: 'id'
        }
    },
    resultado: {
        type: DataTypes.ENUM('OK', 'Retrabajo', 'Scrap'),
        allowNull: false
    },
    descripcion_falla: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    revisado_por: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    },
    fecha: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'inspecciones_calidad',
    timestamps: false
});

module.exports = InspeccionCalidad;