const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Evidencia = sequelize.define('evidencias', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    falla_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'fallas_tecnicas',
            key: 'id'
        }
    },
    url_imagen: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fecha: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'evidencias',
    timestamps: false
});

module.exports = Evidencia;