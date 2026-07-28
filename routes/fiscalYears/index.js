const routes = require('express').Router();
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { FiscalYears } = require('../../functions/Associations/fiscalYearAssociations');
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

// Any logged-in user can see which fiscal years are open, to populate their
// own "which fiscal year am I working in" picker - no designation gate.
routes.get('/getSelectable', async (req, res) => {
    try {
        const result = await FiscalYears.findAll({
            where: { isLocked: false },
            order: [['startDate', 'DESC']],
            attributes: ['id', 'label', 'suffix', 'startDate', 'endDate'],
        });
        res.json({ status: 'success', result });
    } catch (error) {
        console.error(error);
        res.json({ status: 'error', result: error.message });
    }
});

// Full list including locked ones. Open to any logged-in user - the Fiscal
// Years page itself is visible to everyone (any user selects their own
// working fiscal year there), it's only the create/edit/lock/unlock
// actions that stay restricted to CEO/CFO/admin.
routes.get('/getAll', async (req, res) => {
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
        const { label, suffix, startDate, endDate } = req.body;
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

        const result = await FiscalYears.create({
            label, suffix, startDate, endDate,
            createdBy: req.user.id,
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
        const { id, label, suffix, startDate, endDate } = req.body;
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

        await FiscalYears.update({ label, suffix, startDate, endDate }, { where: { id } });

        createHistory(req.user.id, 'FiscalYear', 'Edit', label || fy.label);
        res.json({ status: 'success' });
    } catch (error) {
        console.error(error);
        res.json({ status: 'error', result: error.message });
    }
});

routes.post('/lock', CEO_CFO, async (req, res) => {
    try {
        const fy = await FiscalYears.findOne({ where: { id: req.body.id } });
        if (!fy) return res.json({ status: 'error', result: 'Fiscal year not found.' });

        await FiscalYears.update({ isLocked: true }, { where: { id: req.body.id } });

        createHistory(req.user.id, 'FiscalYear', 'Lock', fy.label);
        res.json({ status: 'success' });
    } catch (error) {
        console.error(error);
        res.json({ status: 'error', result: error.message });
    }
});

routes.post('/unlock', CEO_CFO, async (req, res) => {
    try {
        const fy = await FiscalYears.findOne({ where: { id: req.body.id } });
        if (!fy) return res.json({ status: 'error', result: 'Fiscal year not found.' });

        await FiscalYears.update({ isLocked: false }, { where: { id: req.body.id } });

        createHistory(req.user.id, 'FiscalYear', 'Unlock', fy.label);
        res.json({ status: 'success' });
    } catch (error) {
        console.error(error);
        res.json({ status: 'error', result: error.message });
    }
});

// Fiscal years are permanent records once created (accounting periods should
// never disappear from history) - intentionally no /delete route. They can
// only be created, edited, locked, and unlocked.

module.exports = routes;
