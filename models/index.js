'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};
const { Client } = require('pg')

// const client = "postgres://postgres:'Saad@645'@localhost:5432/odesy";

let sequelize;
// const client = "postgres://postgres:'Saad@645'@localhost:5432/odyssey"
// const client = "postgres://postgres:abc.123@localhost:5432/odyssey";
// const connectionString = "postgresql://abdullah:ckn3lCxxtBsWY-65nwfJGA@expert-flapper-2045.7s5.cockroachlabs.cloud:26257/tech_dc_test?sslmode=verify-full"

const client = "postgresql://neondb_owner:npg_mvk8wdO1UJfG@ep-shy-waterfall-a1fkr8ks-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
// const connectionString = "postgresql://farrukh:6gHni-AaAZZ7LUw7X5bkHg@boreal-coder-5746.7s5.aws-ap-south-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full"

// const connectionString = "postgresql://farrukh:6gHni-AaAZZ7LUw7X5bkHg@boreal-coder-5746.7s5.aws-ap-south-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full"
sequelize = new Sequelize(client, {


// const connectionString = "postgresql://abdullah:ckn3lCxxtBsWY-65nwfJGA@expert-flapper-2045.7s5.cockroachlabs.cloud:26257/tech_dc_test?sslmode=verify-full"

// const connectionString = "postgresql://farrukh:6gHni-AaAZZ7LUw7X5bkHg@boreal-coder-5746.7s5.aws-ap-south-1.cockroachlabs.cloud:26257/dev-server?sslmode=verify-full"
// const connectionString = "postgresql://farrukh:6gHni-AaAZZ7LUw7X5bkHg@boreal-coder-5746.7s5.aws-ap-south-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full"
// sequelize = new Sequelize(connectionString, {
  dialectOptions: {
    application_name: "docs_simplecrud_node-sequelize"
  },
  logging:false
});

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

// Sync models with the database to create tables
sequelize.sync({ alter: true })  // alter: true will adjust the schema to match the models, without dropping tables
  .then(() => {
    console.log("Database & tables created!");
  })
  .catch((err) => {
    console.error("Error syncing database: ", err);
  });


db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
