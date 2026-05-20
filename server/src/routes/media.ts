import { Router, Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// POST /media/sign — get Cloudinary signed upload params
router.post('/sign', async (req: Request, res: Response): Promise<void> => {
  const { folder } = req.body as { folder?: string };

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    res.status(500).json({ error: 'server_error', message: 'Cloudinary not configured' });
    return;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const uploadFolder = folder ?? 'squaad_uploads';

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: uploadFolder },
    apiSecret
  );

  res.json({
    signature,
    timestamp,
    cloudName,
    apiKey,
    folder: uploadFolder,
  });
});

export default router;
