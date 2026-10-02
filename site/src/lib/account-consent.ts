export interface AccountPolicy {
  product: string; minimumAge: number; status: string; version: string; contentSha256: string;
  effectiveAt: string | null; termsUrl: string; privacyUrl: string; canAccept: boolean; mode: 'adopted' | 'preview' | null;
}
export interface AccountReceipt {
  version: string; acceptedAt: string; locale: 'en' | 'fr'; contractLanguage: 'en' | 'fr'; mode: 'adopted' | 'preview';
}
export interface AccountConsentStatus extends AccountPolicy { required: boolean; receipt: AccountReceipt | null }
export interface LegalCopy { title: string; intro: string; sections: { id: string; title: string; paragraphs: string[] }[] }
export interface AccountPolicyCopies {
  policy: AccountPolicy; copies: { terms: { en: LegalCopy; fr: LegalCopy }; privacy: { en: LegalCopy; fr: LegalCopy } };
}
