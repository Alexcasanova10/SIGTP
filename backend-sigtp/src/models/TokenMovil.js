const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TokenMovil = sequelize.define('tokens_movil', {
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
    token: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    fecha_creacion: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    fecha_expiracion: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'tokens_movil',
    timestamps: false
});

module.exports = TokenMovil;