const { Op } = require("sequelize");
const routes = require('express').Router();
const { Company } = require("../../models");

routes.get("/getAllCompanies", async(req, res) => {
    try {
      const result = await Company.findAll();
      res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

module.exports = routes;