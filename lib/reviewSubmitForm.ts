import { z } from 'zod';

export const reviewSubmitSchema = z.object({
  name: z.string().min(1, 'required').max(100),
  email: z.string().email('email'),
  company: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  productId: z.string().optional(),
  rating: z.number().int().min(1, 'rating').max(5, 'rating'),
  title: z.string().min(1, 'required').max(80, 'titleMax'),
  body: z.string().min(30, 'bodyMin').max(1000, 'bodyMax'),
  consentPublish: z.literal(true, { message: 'consentRequired' }),
  emailMarketing: z.boolean(),
});

export type ReviewSubmitValues = z.infer<typeof reviewSubmitSchema>;

export type StoredReview = {
  ref: string;
  createdAt: string;
  name: string;
  email: string;
  company?: string;
  role?: string;
  productId?: string;
  rating: number;
  title: string;
  body: string;
  consentPublish: true;
  emailMarketing: boolean;
};
