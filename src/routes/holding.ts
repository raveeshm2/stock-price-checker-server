import express from 'express';
import { globalModel, userModel } from '../db/models';
import { timeOut } from '../common/util';
import { isStockMarketOpen, roundOff2Places } from '../utils';
import { getStockPriceWithErrorHandler } from './stock';

const router = express.Router();

export interface HoldingListModel {
    symbol: string,
    quantity: number,
    totalInvested: number,
    avgPrice: number,
    currentPrice: number,
    change: number,
    pChange: number,
    profit: number,
    profitChange: number,
}

router.post('/add', async (req, res, next) => {
    if (!req.body.symbol) { return next(new Error('Stock Symbol not provided')); }
    if (!req.body.price) { return next(new Error('Price not provided')); }
    if (!req.body.quantity) { return next(new Error('Quantity not provided')); }
    const user = await userModel.findById(req.session!.userID);
    if (!user) { return next(new Error("User not found")); }

    const symbol = req.body.symbol;
    const quantity = req.body.quantity;
    const price = req.body.price;

    // Search if the stock already exists with user
    const holdings = user.holdings ? [...user.holdings] : [];
    const index = holdings.findIndex(stock => stock.symbol === symbol);
    if (index >= 0) {
        const totalInvested = roundOff2Places(holdings[index].totalInvested + (quantity * price));
        const totalQuantity = holdings[index].quantity + quantity;
        const avgPrice = roundOff2Places(totalInvested / totalQuantity);
        holdings[index] = { ...holdings[index], quantity: totalQuantity, avgPrice, totalInvested }
    } else {
        holdings.push({
            symbol,
            quantity,
            avgPrice: roundOff2Places(price),
            totalInvested: quantity * price
        });
    }
    user.holdings = holdings;
    await user.save();
    await timeOut();
    return res.send({ message: ["Stock Holding added successfully"] });
});

router.post('/delete', async (req, res, next) => {
    if (!req.body.symbol) { return next(new Error('Stock Symbol not provided')); }
    if (!req.body.quantity) { return next(new Error('Quantity not provided')); }

    const user = await userModel.findById(req.session!.userID);
    if (!user) { return next(new Error("User not found")); }

    const symbol = req.body.symbol;
    const quantity = req.body.quantity;
    const holdings = user.holdings ? [...user.holdings] : [];
    const index = holdings.findIndex(stock => stock.symbol === symbol);
    if (index >= 0) {
        const updatedQuantity = holdings[index].quantity - quantity;
        if (updatedQuantity <= 0) {
            // Delete the stock from portfolio
            const updatedHoldings = holdings.filter(stock => stock.symbol !== symbol);
            user.holdings = updatedHoldings;
            await user.save();
            return res.send({ message: ["Stock Holding updated successfully"] });
        }
        const updatedInvested = holdings[index].totalInvested - (quantity * holdings[index].avgPrice);
        holdings[index] = { ...holdings[index], quantity: updatedQuantity, totalInvested: updatedInvested };
        user.holdings = holdings;
        await user.save();
    } else {
        return next(new Error('Stock not present in your portfolio'));
    }
    await timeOut();
    return res.send({ message: ["Stock Holding updated successfully"] });
})

router.get('/list', async (req, res, next) => {
    const user = await userModel.findById(req.session!.userID);
    if (!user) { return next(new Error("User not found")); }

    const holdings = user.holdings;
    if (!holdings) { return next(new Error("No holdings present")) }
    const promises = holdings.map(stock => getStockPriceWithErrorHandler(stock.symbol));
    const resolved = await Promise.all(promises);
    const mappedInfo: { [key: string]: HoldingListModel } = holdings.reduce((acc, stock, index) => {
        const quantity = stock.quantity;
        const totalInvested = stock.totalInvested;

        const basePrice = resolved[index].basePrice;
        const currentPrice: number = resolved[index].close || resolved[index].lastPrice;

        const change = roundOff2Places(currentPrice - basePrice);
        const pChange = roundOff2Places((change / basePrice) * 100);
        const profit = roundOff2Places((currentPrice * quantity) - totalInvested);
        const profitChange = roundOff2Places((profit / totalInvested) * 100);

        (acc as any)[stock.symbol] = {
            symbol: stock.symbol,
            quantity,
            totalInvested,
            avgPrice: stock.avgPrice,
            currentPrice,
            change,
            pChange,
            profit,
            profitChange
        }
        return acc;
    }, {});
    const totalInvested = roundOff2Places(holdings.reduce((acc, stock) => acc + stock.totalInvested, 0));
    const totalCurrentValue = roundOff2Places(Object.values(mappedInfo).reduce((acc, stock) => acc + (stock.currentPrice * stock.quantity), 0));
    const totalProfit = roundOff2Places(totalCurrentValue - totalInvested);
    const totalProfitChange = roundOff2Places((totalProfit / totalInvested) * 100);

    const todayProfit = roundOff2Places(Object.values(mappedInfo).reduce((acc, stock) => acc + (stock.change * stock.quantity), 0));
    const todayProfitChange = roundOff2Places((todayProfit / totalInvested) * 100);

    const globalConfig = await globalModel.findOne({});
    (mappedInfo as any).total = { totalInvested, totalCurrentValue, totalProfit, totalProfitChange };
    (mappedInfo as any).today = { todayProfit, todayProfitChange };
    (mappedInfo as any).isMarketOpen = { open: isStockMarketOpen(), change: globalConfig?.change };
    const ordered = {};
    Object.keys(mappedInfo).sort().forEach(key => {
        (ordered as any)[key] = mappedInfo[key];
    });
    await timeOut();
    return res.send(ordered);
});

export default router;