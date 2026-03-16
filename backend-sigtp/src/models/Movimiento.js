const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Movimiento = sequelize.define('movimientos', {
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
    estatus_anterior: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    estatus_nuevo: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    cambiado_por: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
    tableName: 'movimientos',
    timestamps: false
});

module.exports = Movimiento;