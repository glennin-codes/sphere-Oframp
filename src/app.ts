import express from 'express';
import paymentRouter from './routes/payment.routes';
import webhookRouter from './routes/webhook.routes';

const app = express();

app.use(express.json());
app.use('/api/v1/', paymentRouter);
app.use('/api/v1', webhookRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
