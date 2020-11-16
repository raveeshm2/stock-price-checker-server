import { Typegoose, prop } from "@hasezoey/typegoose";

export class stock extends Typegoose {

    @prop({ required: true })
    symbol!: string
}