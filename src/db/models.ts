import mongoose from './mongoose'
import { user } from "./schema/user";
import { global } from "./schema/global";

export const userModel = new user().getModelForClass(user, {
    existingMongoose: mongoose
});

export const globalModel = new global().getModelForClass(global, {
    existingMongoose: mongoose
});