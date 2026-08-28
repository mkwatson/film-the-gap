import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DemoProductPage } from './page';

describe('rights-clean demo product page', () => {
  it('states the marketing claim and the exact evidence gap without a purchase flow', () => {
    render(<DemoProductPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Everyday insulated travel bottle' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: '“Leak resistant.”' })).toBeTruthy();
    expect(screen.getByText('Claim only · not verified evidence')).toBeTruthy();
    expect(screen.getByText('The claim shows no continuous inverted test.')).toBeTruthy();
    expect(
      screen.getByText('The listing copy provides no reviewed video or timestamp.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Ask someone to film the missing proof →' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /buy|purchase|add to cart/i })).toBeNull();
    expect(
      screen.getByRole('link', { name: '← Product evidence network' }).getAttribute('href'),
    ).toBe('/');
  });
});
