const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FallaTecnica = sequelize.define('fallas_tecnicas', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    pieza_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'piezas',
            key: 'id'
        }
    },
    orden_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ordenes_trabajo',
            key: 'id'
        }
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    prioridad: {
        type: DataTypes.ENUM('Baja', 'Media', 'Alta', 'Critica'),
        defaultValue: 'Media'
    },
    registrado_por: {
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
    tableName: 'fallas_tecnicas',
    timestamps: false
});

module.exports = FallaTecnica;