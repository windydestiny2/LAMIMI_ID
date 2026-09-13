export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidWhatsAppPhone(value: string) {
  const s = value.trim();
  if (!s) return false;

  // Accept Indonesia-style numbers like 08... or +62..., and reject obvious garbage.
  const normalized = s.replace(/\s|-/g, '');
  const inbound = /^\+?62\d{8,14}$/.test(normalized);
  const local = /^08\d{8,13}$/.test(normalized);
  return inbound || local;
}

export function validateCheckoutContact(form: { email: string; phone: string; isPhysical: boolean }) {
  if (!form.phone.trim() || !isValidWhatsAppPhone(form.phone)) {
    return 'Nomor WhatsApp harus berupa nomor WhatsApp yang benar.';
  }

  if (!form.isPhysical && !form.email.trim()) {
    return 'Isi email untuk pengiriman ebook ya.';
  }

  if (!form.isPhysical && !isValidEmail(form.email)) {
    return 'Email harus benar agar ebook bisa dikirim.';
  }

  return '';
}
