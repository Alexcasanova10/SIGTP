const sequelize = require('../config/database');

const Rol = require('./Rol');
const Usuario = require('./Usuario');
const TokenMovil = require('./TokenMovil');
const Estacion = require('./Estacion');
const OrdenTrabajo = require('./OrdenTrabajo');
const Pieza = require('./Pieza');
const InspeccionCalidad = require('./InspeccionCalidad');
const ParoLinea = require('./ParoLinea');
const Movimiento = require('./Movimiento');
const FallaTecnica = require('./FallaTecnica');
const Evidencia = require('./Evidencia');
const Notificacion = require('./Notificacion');

// Definir relaciones

// Rol - Usuario (1:N)
Rol.hasMany(Usuario, { foreignKey: 'rol_id' });
Usuario.belongsTo(Rol, { foreignKey: 'rol_id' });

// Usuario - TokenMovil (1:N)
Usuario.hasMany(TokenMovil, { foreignKey: 'usuario_id' });
TokenMovil.belongsTo(Usuario, { foreignKey: 'usuario_id' });

// Usuario - InspeccionCalidad (1:N)
Usuario.hasMany(InspeccionCalidad, { foreignKey: 'revisado_por' });
InspeccionCalidad.belongsTo(Usuario, { foreignKey: 'revisado_por' });

// Usuario - ParoLinea (1:N)
Usuario.hasMany(ParoLinea, { foreignKey: 'registrado_por' });
ParoLinea.belongsTo(Usuario, { foreignKey: 'registrado_por' });

// Usuario - Movimiento (1:N)
Usuario.hasMany(Movimiento, { foreignKey: 'cambiado_por' });
Movimiento.belongsTo(Usuario, { foreignKey: 'cambiado_por' });

// Usuario - FallaTecnica (1:N)
Usuario.hasMany(FallaTecnica, { foreignKey: 'registrado_por' });
FallaTecnica.belongsTo(Usuario, { foreignKey: 'registrado_por' });

// Usuario - Notificacion (1:N)
Usuario.hasMany(Notificacion, { foreignKey: 'usuario_id' });
Notificacion.belongsTo(Usuario, { foreignKey: 'usuario_id' });

// OrdenTrabajo - Pieza (1:N)
OrdenTrabajo.hasMany(Pieza, { foreignKey: 'orden_id' });
Pieza.belongsTo(OrdenTrabajo, { foreignKey: 'orden_id' });

// OrdenTrabajo - ParoLinea (1:N)
OrdenTrabajo.hasMany(ParoLinea, { foreignKey: 'orden_id' });
ParoLinea.belongsTo(OrdenTrabajo, { foreignKey: 'orden_id' });

// OrdenTrabajo - FallaTecnica (1:N)
OrdenTrabajo.hasMany(FallaTecnica, { foreignKey: 'orden_id' });
FallaTecnica.belongsTo(OrdenTrabajo, { foreignKey: 'orden_id' });

// Estacion - Pieza (1:N)
Estacion.hasMany(Pieza, { foreignKey: 'estacion_actual_id' });
Pieza.belongsTo(Estacion, { foreignKey: 'estacion_actual_id' });

// Pieza - InspeccionCalidad (1:N)
Pieza.hasMany(InspeccionCalidad, { foreignKey: 'pieza_id' });
InspeccionCalidad.belongsTo(Pieza, { foreignKey: 'pieza_id' });

// Pieza - Movimiento (1:N)
Pieza.hasMany(Movimiento, { foreignKey: 'pieza_id' });
Movimiento.belongsTo(Pieza, { foreignKey: 'pieza_id' });

// Pieza - FallaTecnica (1:N)
Pieza.hasMany(FallaTecnica, { foreignKey: 'pieza_id' });
FallaTecnica.belongsTo(Pieza, { foreignKey: 'pieza_id' });

// FallaTecnica - Evidencia (1:N)
FallaTecnica.hasMany(Evidencia, { foreignKey: 'falla_id' });
Evidencia.belongsTo(FallaTecnica, { foreignKey: 'falla_id' });

// Exportar modelos y conexión
module.exports = {
    sequelize,
    Rol,
    Usuario,
    TokenMovil,
    Estacion,
    OrdenTrabajo,
    Pieza,
    InspeccionCalidad,
    ParoLinea,
    Movimiento,
    FallaTecnica,
    Evidencia,
    Notificacion
};