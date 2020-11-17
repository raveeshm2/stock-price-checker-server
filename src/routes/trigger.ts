import express from 'express';
import { isValidObjectId } from 'mongoose';
import { timeOut } from '../common/util';
import { userModel } from '../db/models';
import mongoose from '../db/mongoose';

const router = express.Router();

router.post('/add', async (req, res, next) => {
    if (!req.body.symbol) { return next(new Error('Stock Symbol not provided')); }
    if (!req.body.price) { return next(new Error('Trigger Price not provided')); }
    if (!req.body.type) { return next(new Error('Type not provided')); }
    if (req.body.type !== 'lte' && req.body.type !== 'gte') { return next(new Error('Invalid trigger type provided')) }
    const symbol = req.body.symbol;
    const price = req.body.price;
    const type = req.body.type;

    const user = await userModel.findById(req.session!.userID);
    if (!user) { return next(new Error("User not found")); }
    if (!user.trigger) {
        user.trigger = [{ id: mongoose.Types.ObjectId(), symbol, type, price, isTriggered: false, triggeredAt: null }];
    } else {
        const triggers = [...user.trigger];
        const duplicate = triggers.find(trigger => trigger.symbol === symbol && trigger.type === type && trigger.price === price && trigger.isTriggered === true);
        if (duplicate) { return next(new Error("Stock Trigger already active.")); }
        triggers.push({ id: mongoose.Types.ObjectId(), symbol, type, price, isTriggered: false, triggeredAt: null });
        user.trigger = triggers;
    }
    await user.save();
    await timeOut();
    return res.send({ message: ["Stock trigger added successfully"] });
});

router.get('/list', async (req, res, next) => {
    const user = await userModel.findById(req.session!.userID);
    if (!user) { return next(new Error("User not found")); }
    await timeOut();
    const triggers = user.trigger ? user.trigger : [];
    res.send(triggers);
});

router.delete('/delete', async (req, res, next) => {
    if (!req.body.id) {
        return next(new Error('Symbol ID not provided'));
    }
    if (!isValidObjectId(req.body.id)) {
        return next(new Error('Invalid Symbol ID provided'));
    }
    const user = await userModel.findById(req.session!.userID);
    if (!user) { return next(new Error("User not found")); }
    const id = req.body.id;
    const triggers = user.trigger ? [...user.trigger] : [];
    const updatedTriggers = triggers.filter(trigger => trigger.id.toString() !== id);
    console.log('updatedTriggers', updatedTriggers);
    if (updatedTriggers.length === triggers.length - 1) {
        user.trigger = updatedTriggers;
        await user.save();
        await timeOut();
        return res.send({ message: ["Alert deleted successfully"] });
    }
    next(new Error("Error deleting alert. Please try again later"));
});

router.put('/update', async (req, res, next) => {
    if (!req.body.id) {
        return next(new Error('Symbol ID not provided'));
    }
    if (!isValidObjectId(req.body.id)) {
        return next(new Error('Invalid Symbol ID provided'));
    }
    if (!req.body.price) { return next(new Error('Trigger Price not provided')); }
    if (!req.body.type) { return next(new Error('Type not provided')); }
    const id = req.body.id;
    const price = req.body.price;
    const type = req.body.type;
    const user = await userModel.findById(req.session!.userID);
    if (!user) { return next(new Error("User not found")); }
    const triggers = user.trigger ? [...user.trigger] : [];
    const index = triggers.findIndex(trigger => trigger.id.toString() === id);
    if (index >= 0) {
        triggers[index] = { ...triggers[index], price, type };
        user.trigger = triggers;
        await user.save();
        await timeOut();
        return res.send({ message: ["Alert updated successfully"] });
    }
    next(new Error("Error updating alert. Please try again later"));
})

export default router;