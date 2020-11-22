import "reflect-metadata";
import express, { NextFunction, Request, Response } from 'express';
import * as bodyParser from "body-parser";
import cors from "cors";
import StockRouter from "./routes/stock";
import * as path from 'path';
import session from "./middlewares/session";
import authenticator from "./middlewares/authenticator";
import UserRouter from "./routes/user";
import SubscriptionRouter from "./routes/subscription";
import TriggerRouter from "./routes/trigger";
import { setUpVapidDetails } from "./utils";
import { HandleCRONJob } from "./routes/utils";
import { checkForEnvironmentVariables } from "./common/util";


// Checks for environment variables before booting applications and throw error
// if any of the required variable is missing
checkForEnvironmentVariables();

const app = express();

//if (process.env.NODE_ENV !== "production") {
app.use(cors({ credentials: true, origin: 'http://localhost:3000' })); // -> DEV server for hot reloading
// app.use(cors({ credentials: true, origin: 'http://localhost:5000' })); // -> Build for SW
//}

setUpVapidDetails();

app.use(bodyParser.json());

app.use(session);

app.use('/user', UserRouter);

app.use('/stock', authenticator, StockRouter);

app.use('/subscription', SubscriptionRouter);

app.use('/trigger', authenticator, TriggerRouter);

HandleCRONJob();

app.use(function (err: Error, req: Request, res: Response, next: NextFunction) {
    res.status(500).send({ errors: [err.message] });
});

// Serve React APP on the same URL if in production
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, '..', 'build-client')));
    app.get('/*', function (req, res) {
        res.sendFile(path.join(__dirname, '..', 'build-client', 'index.html'));
    });
}

app.listen(process.env.PORT || 6500, () => {
    console.log(`Server running on port ${process.env.PORT || '6500'}`);
}).setTimeout(60 * 7 * 1000); // 7 mins default timeout