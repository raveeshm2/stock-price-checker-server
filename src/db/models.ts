import mongoose from './mongoose'
import { stock } from "./schema/stock"
import { user } from "./schema/user";
import { global } from "./schema/global";

export const productModel = new stock().getModelForClass(stock, {
    existingMongoose: mongoose
});

export const userModel = new user().getModelForClass(user, {
    existingMongoose: mongoose
});

export const globalModel = new global().getModelForClass(global, {
    existingMongoose: mongoose
});