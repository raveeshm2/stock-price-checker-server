import express from 'express';
import { globalModel, userModel } from '../db/models';
import authenticator from '../middlewares/authenticator';
import { getCookie, getStockPrice, getStockSymbol, NSEcookie } from './utils';
import { timeOut } from '../common/util';
import { isStockMarketOpen } from '../utils';

const router = express.Router();
let cookies: NSEcookie | null = null;

(async function () {
    cookies = await getCookie();
})();

export async function getStockPriceWithErrorHandler(symbol: string): Promise<any> {
    try {
        // First try
        return await getStockPrice(symbol, cookies!);
    } catch (err) {
        // Second try - Most likely cookie got expired so try once more with new cookie
        console.log('Err fetching price', err);
        try {
            const tempCookie = await getCookie(); // Function may return null cookie if cookie fetching is already in progress

            if (tempCookie) {
                cookies = tempCookie;
                return await getStockPrice(symbol, cookies!);
            } else {
                return { error: `Unable to retrieve info for ${symbol}` }
            }

        } catch (err) {
            // Generic Error Catch
            return { error: `Unable to retrieve info for ${symbol}` }
        }
    }
}

router.get('/price', async (req, res, next) => {
    if (!req.query.symbol)
        return next(new Error('Stock symbol not provided'));
    const symbol = (req.query.symbol) as string;
    const info = await getStockPriceWithErrorHandler(symbol);
    if (!info.error) {
        return res.send({ 'info': info });
    } else {
        return next(new Error("Request failed. Please try again later"));
    }
});

router.get('/search', async (req, res, next) => {
    if (!req.query.stockName)
        return next(new Error('Stock Name not provided'));
    const stockName = (req.query.stockName) as string;
    try {
        const symbols = await getStockSymbol(stockName, cookies!);
        const processedData = symbols.map((stock: any) => {
            return { symbol: stock.symbol, name: stock.symbol_info }
        });
        //console.log('process', processedData);
        return res.send(processedData);
    } catch (err) {
        // Most likely cookie got expired so try once more with new cookie
        const tempCookie = await getCookie(); // Function may return null cookie if cookie fetching is already in progress
        try {
            if (tempCookie) {
                cookies = tempCookie;
                const symbols = await getStockSymbol(stockName, cookies!);
                const processedData = symbols.map((stock: any) => {
                    return { symbol: stock.symbol, name: stock.symbol_info }
                });
                return res.send(processedData);
            } else {
                return next(new Error("Request failed. Please try again later"));
            }
        } catch (err) {
            return next(new Error("Request failed. Please try again later"));
        }
    }
});

router.post('/add', authenticator, async (req, res, next) => {
    if (!req.body.symbol) { return next(new Error('Stock Symbol not provided')); }
    if (!req.body.name) { return next(new Error('Stock Name not provided')); }
    const symbol = req.body.symbol;
    const name = req.body.name;
    const user = await userModel.findById(req.session!.userID);
    if (!user) { return next(new Error("User not found")); }
    if (!user.stocks) {
        user.stocks = [{ symbol, name }];
    } else {
        const stocks = [...user.stocks];
        const duplicate = stocks.find(stock => stock.symbol === symbol);
        if (duplicate) { return next(new Error("Stock Already present in your list")); }
        stocks.push({ symbol, name });
        user.stocks = stocks;
    }
    await user.save();
    return res.send({ message: ["Stock added successfully"] });
});

router.post('/delete', authenticator, async (req, res, next) => {
    if (!req.body.symbol) { return next(new Error('Stock Symbol not provided')); }
    const symbol = req.body.symbol;
    const user = await userModel.findById(req.session!.userID);
    if (!user) { return next(new Error("User not found")); }
    if (!user.stocks) {
        return next(new Error("Stock List is empty"));
    }
    const stocks = [...user.stocks];
    const filteredStocks = stocks.filter(stock => stock.symbol !== symbol);
    await timeOut();
    if (filteredStocks.length < stocks.length) {
        user.stocks = filteredStocks;
        await user.save();
        return res.send({ message: ["Stock deleted successfully"] });
    }
    return next(new Error("Stock couldn't be deleted. Please try again later"));
});

router.get('/list', authenticator, async (req, res, next) => {
    const user = await userModel.findById(req.session!.userID);
    if (!user) { return next(new Error("User not found")); }
    const stocks = user.stocks;
    if (!stocks) { return next(new Error("No stocks added")) }
    const promises = stocks.map(stock => getStockPriceWithErrorHandler(stock.symbol));
    const resolved = await Promise.all(promises);
    const mappedInfo = stocks.reduce((acc, stock, index) => {
        (acc as any)[stock.symbol] = { ...resolved[index], name: stock.name }
        return acc;
    }, {});
    const globalConfig = await globalModel.findOne({});
    (mappedInfo as any).isMarketOpen = { open: isStockMarketOpen(), change: globalConfig?.change }; // Hacky approach to use existing attributes for other purpose
    await timeOut();
    return res.send(mappedInfo);
});

export default router;