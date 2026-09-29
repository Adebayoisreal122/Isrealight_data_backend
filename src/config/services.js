const { z } = require('zod');

// VTpass service IDs we allow (whitelist so users can't hit arbitrary products)
const AIRTIME = ['mtn', 'airtel', 'glo', 'etisalat']; // etisalat = 9mobile
const DATA = ['mtn-data', 'airtel-data', 'glo-data', 'glo-sme-data', 'etisalat-data'];
const CABLE = ['dstv', 'gotv', 'startimes'];
const POWER = [
  'ikeja-electric', 'eko-electric', 'abuja-electric', 'kano-electric', 'portharcourt-electric',
  'jos-electric', 'ibadan-electric', 'kaduna-electric', 'enugu-electric',
];

const phone = z.string().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number');

const purchaseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('airtime'),
    serviceID: z.enum(AIRTIME),
    recipient: phone,
    amount: z.number().int().min(50).max(50000),
  }),
  z.object({
    type: z.literal('data'),
    serviceID: z.enum(DATA),
    recipient: phone,
    variationCode: z.string().min(1),
  }),
  z.object({
    type: z.literal('cable'),
    serviceID: z.enum(CABLE),
    recipient: z.string().regex(/^\d{8,15}$/, 'Invalid smartcard/IUC number'),
    variationCode: z.string().min(1),
    subscriptionType: z.enum(['change', 'renew']).default('change'),
  }),
  z.object({
    type: z.literal('electricity'),
    serviceID: z.enum(POWER),
    recipient: z.string().regex(/^\d{6,20}$/, 'Invalid meter number'),
    variationCode: z.enum(['prepaid', 'postpaid']),
    amount: z.number().int().min(500).max(500000),
  }),
]);

module.exports = { AIRTIME, DATA, CABLE, POWER, phone, purchaseSchema };
