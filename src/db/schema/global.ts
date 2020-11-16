import { Typegoose, prop } from "@hasezoey/typegoose";

export class global extends Typegoose {

    @prop({ required: true })
    change!: number

    @prop()
    nsit?: string

    @prop()
    nseappid?: string
}