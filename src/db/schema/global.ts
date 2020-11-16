import { Typegoose, prop } from "@hasezoey/typegoose";

export class global extends Typegoose {

    @prop({ required: true })
    change!: number
}