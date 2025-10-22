const routes = require('express').Router();
const {Ports} = require("../../models/");
const fs = require('fs');

routes.post("/createPort", async (req, res) => {
    try {
        const { portId, portName, portCountry,operation } = req.body;
        if (!portId || !portName || !portCountry || !operation) {
            return res.json({ status: "error", result: "All fields are required" })
        }
        let nameWithCode = `${portName} (${portId})`
        const result = await Ports.create({
            portId,
            portName:nameWithCode,
            portCountry,
            operation
        })
        return res.json({ status: "success", result: result })

    } catch (error) {
        console.log(error);
        res.json({ status: "error", result: error })
    }
})

routes.get("/viewPorts", async (req, res) => {
    try {
        const result = await Ports.findAll();
        return res.json({ status: "success", result: result })
    } catch (error) {
        return res.json({ status: "error", result: error })
    }
});

module.exports = routes;