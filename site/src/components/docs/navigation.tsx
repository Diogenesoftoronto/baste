import { component$, useStyles$ } from '@builder.io/qwik';
import styles from './guide.css?inline';

export const DocsNavigation = component$<{ active: 'studio' | 'developers'; french?: boolean }>(({ active, french }) => {
  useStyles$(styles);
  return <nav class="docs-audiences" aria-label={french ? 'Guides Baste' : 'Baste guides'}>
    <a href={french ? '/docs/?lang=fr' : '/docs/'} aria-current={active === 'studio' ? 'page' : undefined}>{french ? 'Guide du Studio' : 'Studio guide'}</a>
    <a href="/docs/developers/" aria-current={active === 'developers' ? 'page' : undefined}>{french ? 'Developer docs (English)' : 'Developer docs'}</a>
  </nav>;
});
