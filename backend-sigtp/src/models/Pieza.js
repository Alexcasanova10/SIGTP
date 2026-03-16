const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pieza = sequelize.define('piezas', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    serial: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    orden_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ordenes_trabajo',
            key: 'id'
        }
    },
    estacion_actual_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'estaciones',
            key: 'id'
        }
    },
    estatus: {
        type: DataTypes.ENUM('En Proceso SMT', 'En Calidad', 'OK', 'Retrabajo', 'Scrap'),
        defaultValue: 'En Proceso SMT'
    },
    fecha_registro: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'piezas',
    timestamps: false
});

module.exports = Pieza;