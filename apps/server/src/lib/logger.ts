import winston from 'winston';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';

const { combine, timestamp, printf, colorize } = winston.format;

const customFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] : ${message} `;
    if (Object.keys(metadata).length > 0) {
        msg += JSON.stringify(metadata);
    }
    return msg;
});

// Ensure logs directory exists in production
const logsDir = path.resolve(process.cwd(), 'logs');
if (process.env.NODE_ENV === 'production') {
    fs.mkdirSync(logsDir, { recursive: true });
}

const transports: winston.transport[] = [
    new winston.transports.Console({
        format: combine(
            process.env.NODE_ENV !== 'production' ? colorize() : winston.format.uncolorize(),
            customFormat
        ),
    }),
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10,
        })
    );
}

export const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports,
});

// Morgan middleware for HTTP request logging
export const httpLogger = morgan(
    ':method :url :status :res[content-length] - :response-time ms',
    {
        stream: {
            write: (message) => logger.info(message.trim()),
        },
    }
);
