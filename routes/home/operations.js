const { Charge_Head } = require("../../functions/Associations/incoiceAssociations");
const { SE_Job, SE_Equipments } = require("../../functions/Associations/jobAssociations/seaExport");
const { Invoice } = require("../../models");
const routes = require('express').Router();
const Sequelize = require('sequelize');
const moment = require("moment");
const Op = Sequelize.Op;
const Cookies = 'js-cookie';

routes.get("/operatrions/get", async(req, res) => {
  let accessList = [];
  try {
    await res.json({status: 'success', result: 'operatrions'});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

module.exports = routes;