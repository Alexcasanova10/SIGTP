const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notificacion = sequelize.define('notificaciones', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    },
    titulo: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    mensaje: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    leida: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    fecha: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'notificaciones',
    timestamps: false
});

module.exports = Notificacion;