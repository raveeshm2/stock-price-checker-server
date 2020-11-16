import Axios from "axios";
import cookie from "cookie";
import cron from 'node-cron';
import { userModel } from "../db/models";
import { SubScriptionModel } from "../db/schema/user";
import { getStockPriceWithErrorHandler } from "./../routes/stock";
import webPush, { isStockMarketOpen } from "../utils";
import moment from "moment";

export type NSEcookie = {
    nsit: string,
    nseappid: string
}

const commonHeaders = {
    'accept': '*/*',
    'X-Requested-With': 'XMLHttpRequest',
    'accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36'
}

let cronGlobal: cron.ScheduledTask | null = null;

export const getCookie: () => Promise<NSEcookie> = async () => {
    console.log('Getting new set of Cookies');
    let response: any;
    try {
        response = await Axios.get('https://www.nseindia.com', {
            headers: {
                ...commonHeaders
            },
            withCredentials: true
        });
    } catch (err) {
        console.log('Error fetching cookie ', new Date().toLocaleTimeString());
        console.log('err', err);
    }

    const cookies: string[] = response.headers['set-cookie'];
    const parsed: any = cookies.reduce((acc, cook) => {
        return {
            ...acc,
            ...cookie.parse(cook)
        }
    }, {});
    console.log('Cookies received', parsed);
    return {
        nsit: parsed.nsit,
        nseappid: parsed.nseappid
    }
}

export const getStockPrice: (symbol: string, cookies: NSEcookie) => Promise<string> = async (symbol: string, cookies: NSEcookie) => {
    const stock = await Axios.get(`https://www.nseindia.com/api/quote-equity?symbol=${symbol}`, {
        headers: {
            ...commonHeaders,
            cookie: `nsit=${cookies!.nsit}; nseappid=${cookies!.nseappid}`
        },
        withCredentials: true
    });
    return stock.data.priceInfo;
    return stock.data.priceInfo.lastPrice;
}

export const getStockSymbol: (stockName: string, cookies: NSEcookie) => Promise<any> = async (stockName: string, cookies: NSEcookie) => {
    const stock = await Axios.get(`https://www.nseindia.com/api/search/autocomplete?q=${stockName}`, {
        headers: {
            ...commonHeaders,
            cookie: `nsit=${cookies!.nsit}; nseappid=${cookies!.nseappid}`
        },
        withCredentials: true
    });
    return stock.data.symbols;
}

export async function sendNotification(subscription: SubScriptionModel, title: string, content: string): Promise<boolean> {
    try {
        console.log('Sending out a notification');
        await webPush.sendNotification(subscription, JSON.stringify({ title, content }));
        return true;
    } catch (err) {
        console.log('Error sending notification');
    }
    return false;
}

export function HandleCRONJob() {
    // Run CRON job only during market timings
    const isMarketOpen = isStockMarketOpen();
    if (isMarketOpen) {
        if (!cronGlobal) {
            console.log('Starting CRON Job');
            cronGlobal = enableCronJob('*/15 * * * * *'); // Run CRON job every 15 seconds
        }
    } else {
        if (cronGlobal) {
            console.log('Stopping CRON job');
            // If cron job is running, stop it
            cronGlobal.destroy();
            cronGlobal = null;
        }
    }
}

export function enableCronJob(format: string) {
    return cron.schedule(format, async () => {
        console.log("Running Cron Job at", new Date().toLocaleTimeString());

        // Get all users and trigger notifications for successful target hit
        const users = await userModel.find({});
        users.forEach(user => {
            const triggers = user.trigger ? [...user.trigger] : [];
            const subscriptions = user.subscription;

            // Proceed only if atleast one trigger and one subscription is set
            if (triggers && triggers.length > 0 && subscriptions && subscriptions.length > 0) {
                triggers.forEach(async (trigger, index) => {
                    if (!trigger.isTriggered) {
                        const symbol = trigger.symbol;
                        const type = trigger.type;
                        const price = trigger.price;
                        const response = await getStockPriceWithErrorHandler(symbol);
                        const currentPrice = parseFloat(response && response.lastPrice ? response.lastPrice : "-1");
                        if (currentPrice === -1) {
                            // Gracefully return in case of an error fetching current price
                            return;
                        }

                        if ((type === 'lte' && currentPrice <= price) || (type === 'gte' && currentPrice >= price)) {
                            subscriptions.forEach(async subscription => {
                                const success = await sendNotification(subscription, `Target hit for ${symbol}`, `${symbol} is available at ${currentPrice}`);
                                if (success) {
                                    // Update Trigger
                                    triggers[index] = {
                                        ...trigger,
                                        isTriggered: true,
                                        triggeredAt: moment().utcOffset("+05:30").toString()
                                    }
                                    const currentUser = await userModel.findById(user._id);
                                    currentUser!.trigger = triggers;
                                    await currentUser!.save();
                                }
                            });
                        }
                    }
                });
            }
        });

        // Function will stop the CRON job after market is closed
        HandleCRONJob();
    });
}