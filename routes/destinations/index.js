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

/*
 * Type-ahead source for the Final Destination picker on air jobs. Same reasoning
 * as /ports/search: /viewDestinations returns all 140,848 rows (~5.9 MB) and the
 * job screen was fetching it on every open.
 *
 * Destinations are keyed by name - that is what the job stores - so `id` here is
 * the name itself.
 */
routes.get("/search", async (req, res) => {
    try {
        const { search = "", id = "" } = req.query;
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);

        if (id) {
            const row = await Destinations.findOne({ where: { name: id } });
            return res.json({ status: "success", result: row ? [row] : [] });
        }

        const term = String(search).trim();
        // Below 2 characters a trigram index cannot help, so refuse rather than
        // sequentially scan 140k rows.
        if (term.length < 2) {
            return res.json({ status: "success", result: [] });
        }

        const rows = await Destinations.findAll({
            where: { name: { [Op.iLike]: `%${term}%` } },
            order: [["name", "ASC"]],
            limit,
        });
        return res.json({ status: "success", result: rows });
    } catch (error) {
        console.error(error);
        return res.json({ status: "error", result: error.message || String(error) });
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
