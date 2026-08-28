export const demoProduct = {
  name: 'Everyday insulated travel bottle',
  path: '/demo-product',
  authoredClaim: 'Leak resistant.',
  question: 'Does the filled bottle stay leak-free when held upside down for 10 seconds?',
  mission: {
    instruction: 'Fill the bottle, close the lid, and hold it upside down over dry paper.',
    successCriterion: 'Keep the closed lid and dry paper visible for the entire test.',
    minimumSeconds: 10,
    continuousTakeRequired: true,
  },
} as const;
