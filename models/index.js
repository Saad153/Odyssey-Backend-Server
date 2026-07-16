'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
const sequelizeConfig = {
  ...config,
  logging: false,
};

if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], sequelizeConfig);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, sequelizeConfig);
}

fs.readdirSync(__dirname).filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  }).forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if(db[modelName].associate) {
    db[modelName].associate(db)
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// IMPORTANT: assign module.exports before requiring the association files
// below, and before calling sync(). The association files each do
// require('../../models') themselves (a circular require back into this
// same file) - Node resolves that to whatever module.exports currently is
// at that moment, so it must already be the populated `db` object here,
// not the empty {} this module started with.
module.exports = db;

// Many foreign key columns (SEJobId, ClientId, shipperId, CompanyId, etc.)
// only get attached to a model's attributes as a side effect of these
// association files running (hasMany/belongsTo calls mutate the target
// model's rawAttributes). They must be loaded BEFORE sync() below runs,
// because sync({alter:true}) doesn't just add missing columns - it also
// DROPS columns that exist in the DB but aren't in the model's currently
// known attributes, to force the schema to match. Any process that only
// requires this file without these also being loaded would make sync()
// think those association-only columns shouldn't exist, and delete them.
require('../functions/Associations/jobAssociations/seaExport');
require('../functions/Associations/clientAssociation');
require('../functions/Associations/voucherAssociations');
require('../functions/Associations/incoiceAssociations');
require('../functions/Associations/NotificationAssociation');
require('../functions/Associations/taskAssociation');
require('../functions/Associations/vesselAssociations');

// Sync models with the database to create tables
// Exposed as db.syncPromise so anything requiring this module (scripts,
// one-off tools) can `await` sync finishing instead of racing it - this
// never rejects, so it doesn't change the existing fire-and-forget
// behavior for the main server process.
db.syncPromise = sequelize.sync({ alter: true })  // alter: true will adjust the schema to match the models, without dropping tables
  .then(() => {
    console.log("Database & tables created!");
  })
  .catch((err) => {
    console.error("Error syncing database: ", err);
  });
