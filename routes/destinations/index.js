const { Op } = require("sequelize");
const routes = require('express').Router();
const { Destinations } = require("../../models/");
const { createHistory } = require('../../functions/history');

routes.post("/createDestination", async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.json({ status: "error", result: "Name is required" })
        }
        const result = await Destinations.create({ name });
        createHistory(req.body.employeeId, 'Destinations', 'Create', result.name);
        return res.json({ status: "success", result: result })
    } catch (error) {
        console.log(error);
        res.json({ status: "error", result: error })
    }
})

routes.get("/viewDestinations", async (req, res) => {
    try {
        const result = await Destinations.findAll();
        return res.json({ status: "success", result: result })
    } catch (error) {
        return res.json({ status: "error", result: error })
    }
});

routes.get("/get", async (req, res) => {
    try {
        const { page = 1, limit = 50, search = "" } = req.query;

        const offset = (Number(page) - 1) * Number(limit);
        const where = search
            ? { name: { [Op.iLike]: `%${search}%` } }
            : {};

        const { count, rows } = await Destinations.findAndCountAll({
            where,
            order: [["name", "ASC"]],
            limit: Number(limit),
            offset,
        });

        res.json({
            status: "success",
            result: rows,
            pagination: {
                currentPage: Number(page),
                pageSize: Number(limit),
                totalRecords: count,
                totalPages: Math.ceil(count / Number(limit)),
            },
        });
    } catch (error) {
        console.error(error);
        res.json({ status: "error", result: error });
    }
});

routes.post("/updateDestination", async (req, res) => {
    try {
        const { id, name } = req.body.data || req.body;
        if (!id || !name) {
            return res.json({ status: "error", result: "Name is required" })
        }
        await Destinations.update({ name }, { where: { id } });
        const result = await Destinations.findOne({ where: { id } });
        createHistory(req.body.employeeId, 'Destinations', 'Edit', result.name);
        return res.json({ status: "success", result: result })
    } catch (error) {
        console.log(error);
        res.json({ status: "error", result: error })
    }
})

routes.post("/deleteDestination", async (req, res) => {
    try {
        const { id } = req.body;
        const record = await Destinations.findOne({ where: { id } });
        await Destinations.destroy({ where: { id } });
        createHistory(req.body.employeeId, 'Destinations', 'Delete', record?.name);
        return res.json({ status: "success", result: id })
    } catch (error) {
        console.log(error);
        res.json({ status: "error", result: error })
    }
})

module.exports = routes;
