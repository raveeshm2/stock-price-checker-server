import { Typegoose, prop } from "@hasezoey/typegoose";
import mongoose from 'mongoose';

export interface SubScriptionModel {
    endpoint: string,
    keys: {
        auth: string,
        p256dh: string
    }
}

export interface TriggerModal {
    id: mongoose.Types.ObjectId
    symbol: string,
    type: 'gte' | 'lte',
    price: number,
    isTriggered: boolean,
    triggeredAt: string | null
}

export interface HoldingModel {
    symbol: string,
    avgPrice: number,
    quantity: number,
    totalInvested: number
}

export class user extends Typegoose {

    @prop({ required: true })
    email!: string

    @prop({ required: true })
    password!: string

    @prop()
    stocks?: {
        name: string,
        symbol: string
    }[]

    @prop()
    trigger?: TriggerModal[]

    @prop()
    subscription?: SubScriptionModel[]

    @prop()
    holdings?: HoldingModel[]
}