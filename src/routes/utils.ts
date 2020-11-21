import Axios from "axios";
import cron from 'node-cron';
import { userModel } from "../db/models";
import { SubScriptionModel } from "../db/schema/user";
import { getStockPriceWithErrorHandler } from "./../routes/stock";
import webPush, { isStockMarketOpen } from "../utils";
import moment from "moment";
import https from "https";
import cookie from "cookie";
import axiosCookieJarSupport from 'axios-cookiejar-support';
import tough from 'tough-cookie';

axiosCookieJarSupport(Axios);

const cookieJar = new tough.CookieJar();

// At request level
const agent = new https.Agent({
    rejectUnauthorized: false
});

export type NSEcookie = {
    nsit: string,
    nseappid: string
}

const userHeaders = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:82.0) Gecko/20100101 Firefox/82.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.75 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:82.0) Gecko/20100101 Firefox/82.0',
    'Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.193 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:81.0) Gecko/20100101 Firefox/81.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:82.0) Gecko/20100101 Firefox/82.0'
]

const commonHeaders = {
    'Accept': '*/*',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,*',
    'Connection': 'Keep-Alive',
    'Referer': 'https://www.google.co.in',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.183 Safari/537.36'
}

let randomHeader: null | string = null;

let cronGlobal: cron.ScheduledTask | null = null;

// GLobal variable to stop fetching multiple cookies at the same time
let lastFetched: Date | null = null;

function getRandomHeader() {
    return userHeaders[Math.floor(Math.random() * Math.floor(userHeaders.length))];
}

async function getCookieUsingProxy(): Promise<any> {
    let response: any;
    randomHeader = getRandomHeader();
    try {
        response = await Axios.get(`http://api.scrapestack.com/scrape?access_key=${process.env.API_SCRAPER_KEY}&url=https://www.nseindia.com/market-data/live-equity-market&keep_headers=1`, {
            headers: {
                ...commonHeaders,
                'User-Agent': randomHeader
            },
            withCredentials: true,
            httpsAgent: agent
        });
        console.log('Received response', response);
        const cookies: string[] = response.headers['set-cookie'];
        console.log('Coooooooookie', cookies);
    } catch (err) {
        console.log('RFequest failed', err);
    }
}

export const getCookie: () => Promise<NSEcookie | null> = async () => {
    console.log('Getting new set of Cookies 2');
    const current = new Date();
    if (lastFetched && ((current as any) - (lastFetched as any) < 30 * 1000)) { // Retry new cookie every half nminute
        console.log('Cookie fetch already in progress');
        return null;
    }
    await getCookieUsingProxy();
    lastFetched = new Date();
    let response: any;
    randomHeader = getRandomHeader();
    console.log('Header chosen', randomHeader);
    try {
        // response = await fetch('https://www.nseindia.com', {
        //     headers: { ...commonHeaders, credentials: 'include' },
        //     method: 'GET',
        // });

        // Axios Request
        response = await Axios.get('https://www.nseindia.com', {
            headers: {
                ...commonHeaders,
                'User-Agent': randomHeader
            },
            withCredentials: true,
            httpsAgent: agent,
            jar: cookieJar
        });
    } catch (err) {
        //      console.log('Error fetching cookie ', new Date().toLocaleTimeString());
        //      console.log('err', err);
        return null;
    }

    //Axios parsing
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

    // console.log('headers', response.headers);
    // const testCookie = response.headers.get('set-cookie');
    // const nsit = testCookie.split('nsit=')[1].split(';')[0];
    // const nseappid = testCookie.split('nseappid=')[1].split(';')[0];
    // console.log('Cookie received nsit', nsit);
    // console.log('Cookie received nseappid', nseappid);
    // return {
    //     nsit,
    //     nseappid
    // }

}

export const getStockPrice: (symbol: string, cookies: NSEcookie) => Promise<string> = async (symbol: string, cookies: NSEcookie) => {
    const stock = await Axios.get(`https://www.nseindia.com/api/quote-equity?symbol=${symbol}`, {
        headers: {
            ...commonHeaders,
            'User-Agent': randomHeader,
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
            'User-Agent': randomHeader,
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
        // Get UTC day, hours and time to schedule a cron job. Convert to Indian Time
        const localMoment = moment().utcOffset("+05:30");
        console.log("Running Cron Job at", localMoment.toISOString());

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