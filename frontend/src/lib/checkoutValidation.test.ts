import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidWhatsAppPhone } from './checkoutValidation';
import { filterAdminBookRowsByType } from './adminBookFilters';
import type { Book } from './types';

describe('checkout contact validation', () => {
  it('accepts a basic valid email and rejects a bad one', () => {
    expect(isValidEmail('customer@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });

  it('accepts Indonesian WhatsApp numbers and rejects nonsense input', () => {
    expect(isValidWhatsAppPhone('081234567890')).toBe(true);
    expect(isValidWhatsAppPhone('+6281234567890')).toBe(true);
    expect(isValidWhatsAppPhone('hello')).toBe(false);
    expect(isValidWhatsAppPhone('123')).toBe(false);
  });
});

describe('admin book type filter helper', () => {
  it('filters admin book rows by ebook or fisik type', () => {
    const rows = [
      { id: '1', type: 'digital', title: 'Ebook sample', categories: [], price: 100, variants: [], variant_groups: [], stock: -1, cover_url: '', created_at: '2026-01-01T00:00:00.000Z', author: '', language: 'mandarin', description: '', badge: '', featured: false, shopee_url: '', tokopedia_url: '', tiktok_url: '' },
      { id: '2', type: 'fisik', title: 'Fisik sample', categories: [], price: 100, variants: [], variant_groups: [], stock: -1, cover_url: '', created_at: '2026-01-01T00:00:00.000Z', author: '', language: 'mandarin', description: '', badge: '', featured: false, shopee_url: '', tokopedia_url: '', tiktok_url: '' },
    ] as Book[];

    expect(filterAdminBookRowsByType(rows, 'digital')).toHaveLength(1);
    expect(filterAdminBookRowsByType(rows, 'fisik')).toHaveLength(1);
    expect(filterAdminBookRowsByType(rows, 'semua')).toHaveLength(2);
  });
});
