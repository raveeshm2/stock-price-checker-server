import express from 'express';
import { userModel } from '../db/models';
import { timeOut } from '../common/util';
import authenticator from '../middlewares/authenticator';

const router = express.Router();

router.post('/add', authenticator, async (req, res, next) => {
    const endpoint = req.body.endpoint;
    const auth = req.body.keys?.auth;
    const p256dh = req.body.keys?.p256dh;
    if (!endpoint || !auth || !p256dh) {
        return next(new Error("Incomplete subscription details provided"));
    }
    const user = await userModel.findById(req.session!.userID);
    if (user) {
        if (!user.subscription) {
            user.subscription = [{ endpoint, keys: { auth, p256dh } }];
        } else {
            const subscriptions = [...user.subscription];
            subscriptions.push({ endpoint, keys: { auth, p256dh } });
            user.subscription = subscriptions;
        }
        await user.save();
    } else {
        return next(new Error("User not found"));
    }
    await timeOut();
    return res.status(200).send({ message: ["You have successfully subscribed to receive alerts"] });
});

export default router;