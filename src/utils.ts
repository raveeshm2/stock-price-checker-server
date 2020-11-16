import webPush from "web-push";
import { globalModel } from "./db/models";
import moment from "moment";

export function setUpVapidDetails() {
    console.log('setting up vapid details');
    webPush.setVapidDetails('mailto:stockpriceChecker@checker.com',
        process.env.VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!);
}

// Check for existence of Default Email and Default Password before calling it
export async function init() {
    await globalModel.deleteMany({});
    await globalModel.create({
        change: 5000
    });
}

export function isStockMarketOpen(): boolean {
    // Get UTC day, hours and time to schedule a cron job. Convert to Indian Time
    const localMoment = moment().utcOffset("+05:30");

    const currentDay = localMoment.day()
    const currentHour = localMoment.hour();
    const currentMinutes = localMoment.minute();

    if (currentDay >= 1 && currentDay <= 5 && currentHour >= 9 && currentHour <= 18) {
        return true;
    }
    return false;
}

export default webPush;