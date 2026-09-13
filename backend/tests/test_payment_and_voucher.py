import pytest
from datetime import datetime, timezone

from server import (
    evaluate_payment_verification,
    normalize_datetime_for_compare,
    normalize_received_amount,
    extract_payment_amount_from_ocr_text,
    parse_amount_token,
)


def test_extract_payment_amount_from_ocr_text_prefers_currency_context_and_ignores_order_total_tokens():
    ocr = "Total 30000 Transfer Rp 12000"
    assert extract_payment_amount_from_ocr_text(ocr) == 12000


def test_extract_payment_amount_from_ocr_text_ignores_bank_account_numbers():
    ocr = "Dibayar: Rp 1.673.204.663"
    assert extract_payment_amount_from_ocr_text(ocr) is None


def test_normalize_received_amount_does_not_default_missing_ocr_to_order_total():
    # Jika bukti gambar tidak bisa dibaca kembali menjadi nominal, sistem harus
    # menganggap pembayaran tidak masuk sama sekali, bukan menganggap nominal = total.
    status, shortage = evaluate_payment_verification(30000, normalize_received_amount(None, None))
    assert status == "Pembayaran Kurang"
    assert shortage == 30000


def test_normalize_datetime_for_compare_turns_naive_into_utc_aware_datetime():
    naive = datetime(2026, 1, 1, 8, 0, 0)
    aware = normalize_datetime_for_compare(naive)
    assert aware is not None
    assert aware.tzinfo is not None
    assert aware.isoformat().endswith("+00:00")


def test_parse_amount_token_normalizes_single_grouped_thousands_and_rejects_multi_grouped_patterns():
    assert parse_amount_token("12.000") == 12000
    assert parse_amount_token("12,000") == 12000
    assert parse_amount_token("12.000,00") == 12000
    assert parse_amount_token("12,000.00") == 12000
    assert parse_amount_token("1.200.000") is None
    assert parse_amount_token("1,200,000") is None


def test_evaluate_payment_verification_accepts_equal_or_over_paid_and_marks_shortage():
    accepted_equal, shortage_equal = evaluate_payment_verification(9900, 9900)
    accepted_over, shortage_over = evaluate_payment_verification(9900, 10000)
    accepted_under, shortage_under = evaluate_payment_verification(9900, 8000)

    assert accepted_equal == "Pembayaran Diterima"
    assert shortage_equal == 0

    assert accepted_over == "Pembayaran Diterima"
    assert shortage_over == 0

    assert accepted_under == "Pembayaran Kurang"
    assert shortage_under == 1900
