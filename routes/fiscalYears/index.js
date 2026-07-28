const routes = require('express').Router();
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { FiscalYears } = require('../../functions/Associations/fiscalYearAssociations');
const { sequelize } = require('../../models');
const requireDesignation = require('../../functions/requireDesignation');
const { createHistory } = require('../../functions/history');

const CEO_CFO = requireDesignation(['CEO', 'CFO', 'admin']);

const overlapsExisting = async (startDate, endDate, excludeId) => {
    return FiscalYears.findOne({
        where: {
            ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
            [Op.and]: [
                { startDate: { [Op.lte]: endDate } },
                { endDate: { [Op.gte]: startDate } },
            ],
        },
    });
};

routes.get('/getAll', CEO_CFO, async (req, res) => {
    try {
        const result = await FiscalYears.findAll({ order: [['startDate', 'DESC']] });
        res.json({ status: 'success', result });
    } catch (error) {
        console.error(error);
        res.json({ status: 'error', result: error.message });
    }
});

routes.post('/create', CEO_CFO, async (req, res) => {
    try {
        const { label, suffix, startDate, endDate, isActive } = req.body;
        if (!label || !suffix || !startDate || !endDate) {
            return res.json({ status: 'error', result: 'label, suffix, startDate and endDate are required.' });
        }
        if (new Date(startDate) >= new Date(endDate)) {
            return res.json({ status: 'error', result: 'startDate must be before endDate.' });
        }
        const overlap = await overlapsExisting(startDate, endDate);
        if (overlap) {
            return res.json({ status: 'error', result: `Overlaps existing fiscal year "${overlap.label}" (${overlap.startDate} to ${overlap.endDate}).` });
        }

        const result = await sequelize.transaction(async (t) => {
            if (isActive) {
                await FiscalYears.update({ isActive: false }, { where: { isActive: true }, transaction: t });
            }
            return FiscalYears.create({
                label, suffix, startDate, endDate,
                isActive: !!isActive,
                createdBy: req.user.id,
            }, { transaction: t });
        });

        createHistory(req.user.id, 'FiscalYear', 'Create', result.label);
        res.json({ status: 'success', result });
    } catch (error) {
        console.error(error);
        res.json({ status: 'error', result: error.message });
    }
});

routes.post('/edit', CEO_CFO, async (req, res) => {
    try {
        const { id, label, suffix, startDate, endDate, isActive } = req.body;
        const fy = await FiscalYears.findOne({ where: { id } });
        if (!fy) return res.json({ status: 'error', result: 'Fiscal year not found.' });

        if (startDate && endDate) {
            if (new Date(startDate) >= new Date(endDate)) {
                return res.json({ status: 'error', result: 'startDate must be before endDate.' });
            }
            const overlap = await overlapsExisting(startDate, endDate, id);
            if (overlap) {
                return res.json({ status: 'error', result: `Overlaps existing fiscal year "${overlap.label}" (${overlap.startDate} to ${overlap.endDate}).` });
            }
        }

        await sequelize.transaction(async (t) => {
            if (isActive) {
                await FiscalYears.update({ isActive: false }, { where: { isActive: true, id: { [Op.ne]: id } }, transaction: t });
            }
            await FiscalYears.update({ label, suffix, startDate, endDate, isActive }, { where: { id }, transaction: t });
        });

        createHistory(req.user.id, 'FiscalYear', 'Edit', label || fy.label);
        res.json({ status: 'success' });
    } catch (error) {
        console.error(error);
        res.json({ status: 'error', result: error.message });
    }
});

routes.post('/activate', CEO_CFO, async (req, res) => {
    try {
        const fy = await FiscalYears.findOne({ where: { id: req.body.id } });
        if (!fy) return res.json({ status: 'error', result: 'Fiscal year not found.' });

        await sequelize.transaction(async (t) => {
            await FiscalYears.update({ isActive: false }, { where: { isActive: true }, transaction: t });
            await FiscalYears.update({ isActive: true }, { where: { id: req.body.id }, transaction: t });
        });

        createHistory(req.user.id, 'FiscalYear', 'Activate', fy.label);
        res.json({ status: 'success' });
    } catch (error) {
        console.error(error);
        res.json({ status: 'error', result: error.message });
    }
});

// Fiscal years are permanent records once created (accounting periods should
// never disappear from history) - intentionally no /delete route. They can
// only be created, edited, and activated.

module.exports = routes;
