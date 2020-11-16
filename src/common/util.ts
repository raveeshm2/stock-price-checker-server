export function generateErrorMessage(variable: string) {
    return `Please set ${variable} environment variable before starting the application`;
}

// Checks for required environment variables while booting up right in the beginning
export const checkForEnvironmentVariables = () => {
    if (!process.env.MONGO_URI) {
        throw new Error(generateErrorMessage('MONGO_URI'));
    }
    // Required for setting cookies
    if (!process.env.SECRET_KEY) {
        throw new Error(generateErrorMessage('SECRET_KEY'));
    }
    if (!process.env.VAPID_PUBLIC_KEY) {
        throw new Error(generateErrorMessage('VAPID_PUBLIC_KEY'));
    }
    if (!process.env.VAPID_PRIVATE_KEY) {
        throw new Error(generateErrorMessage('VAPID_PRIVATE_KEY'));
    }
}

export const timeOut = () => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, process.env.NODE_ENV !== "production" ? 3000 : 0);
    })
}