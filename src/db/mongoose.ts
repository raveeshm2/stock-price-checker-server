import mongoose from 'mongoose';
import { init } from '../utils';

console.log('Connecting to mongo db');
mongoose.connect(process.env.MONGO_URI!, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
    .then(() => {
        console.log('MongoDB Connected');
        if (process.env.init === 'Y') {
            if (!process.env.INTERVAL) {
                throw new Error("INTERVAL environment variable not found");
            }
            console.log('Initializing DB');
            init();
            console.log('DB initialized');
        }
    }).catch(err => console.log("errorErrorError ", err));

export default mongoose;