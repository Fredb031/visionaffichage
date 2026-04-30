import { z } from 'zod';

export const CONTACT_SUBJECTS = ['product', 'quote', 'tracking', 'other'] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export const contactFormSchema = z.object({
  name: z.string().min(1, 'required'),
  email: z.string().email('email'),
  phone: z.string().optional(),
  subject: z.enum(CONTACT_SUBJECTS),
  message: z.string().min(10, 'messageMin').max(2000, 'messageMax'),
  language: z.enum(['fr', 'en']),
  marketingConsent: z.boolean(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export type StoredContactMessage = {
  ticketId: string;
  createdAt: string;
  name: string;
  email: string;
  phone?: string;
  subject: ContactSubject;
  message: string;
  language: 'fr' | 'en';
  marketingConsent: boolean;
};
