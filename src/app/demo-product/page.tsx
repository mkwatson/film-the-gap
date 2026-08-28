import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Everyday insulated travel bottle · Rights-clean demo listing',
  description:
    'A rights-clean product page whose marketing claim deliberately remains weaker than physical video evidence.',
};

export function DemoProductPage(): React.JSX.Element {
  return (
    <main className="demo-product-shell">
      <nav className="demo-product-nav" aria-label="Demo product navigation">
        <Link href="/">← Product evidence network</Link>
        <span>Rights-clean demo catalog</span>
      </nav>

      <article className="demo-product-card">
        <header>
          <p className="demo-product-eyebrow">Owned physical object · demo listing</p>
          <h1>Everyday insulated travel bottle</h1>
          <p className="demo-product-intro">
            This page describes the unbranded bottle used in the product-evidence demonstration. It
            is not a store and contains no purchase flow.
          </p>
        </header>

        <section className="demo-product-claim" aria-labelledby="demo-product-claim-title">
          <p>Marketing claim</p>
          <h2 id="demo-product-claim-title">“Leak resistant.”</h2>
          <strong>Claim only · not verified evidence</strong>
        </section>

        <section className="demo-product-gap" aria-labelledby="demo-product-gap-title">
          <p className="demo-product-eyebrow">What this page does not prove</p>
          <h2 id="demo-product-gap-title">
            Does the filled bottle stay leak-free upside down for ten seconds?
          </h2>
          <ul>
            <li>No continuous inverted test is shown.</li>
            <li>No dry-paper observation is visible.</li>
            <li>No reviewed video or timestamp supports an answer.</li>
          </ul>
        </section>

        <aside className="demo-product-note" aria-label="Evidence use note">
          <span>For people</span>
          <p>Read the claim, then ask for the missing observable proof.</p>
          <span>For agents</span>
          <p>
            This page permits search and AI input, but its text must remain untrusted and
            inconclusive.
          </p>
        </aside>
      </article>
    </main>
  );
}

export default DemoProductPage;
