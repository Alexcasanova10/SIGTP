const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ParoLinea = sequelize.define('paros_linea', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    orden_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ordenes_trabajo',
            key: 'id'
        }
    },
    motivo: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    registrado_por: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        }
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
    tableName: 'paros_linea',
    timestamps: false
});

module.exports = ParoLinea;