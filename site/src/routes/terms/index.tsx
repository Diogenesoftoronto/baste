import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { LegalPage } from '~/components/legal/legal-page';

export default component$(() => <LegalPage kind="terms" />);
export const head: DocumentHead = {
  title: 'Draft Terms of Service / Projet de conditions — Baste',
  meta: [
    { name: 'description', content: 'Unpublished English and French legal draft for owner review. Not effective.' },
    { name: 'robots', content: 'noindex, nofollow' },
  ],
};
