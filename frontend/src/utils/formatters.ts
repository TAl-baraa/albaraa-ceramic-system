import type { Currency } from "../types/customer";

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const NON_WESTERN_DIGIT_PATTERN = /[٠-٩۰-۹]/g;
const NUMBER_LOCALE = "en-IQ-u-nu-latn";
const DATE_LOCALE = "ar-IQ-u-nu-latn";

export function normalizeWesternDigits(value: string) {
    return value.replace(NON_WESTERN_DIGIT_PATTERN, (digit) => {
        const arabicIndex = ARABIC_INDIC_DIGITS.indexOf(digit);
        if (arabicIndex >= 0) return String(arabicIndex);
        return String(PERSIAN_DIGITS.indexOf(digit));
    });
}

export function formatNumber(
    value: number,
    options: Intl.NumberFormatOptions = {},
) {
    if (!Number.isFinite(value)) return "0";
    return new Intl.NumberFormat(NUMBER_LOCALE, {
        numberingSystem: "latn",
        ...options,
    }).format(value);
}

export function formatQuantity(value: number) {
    return formatNumber(value, {
        maximumFractionDigits: 6,
    });
}

export function formatCurrency(
    value: number,
    currency: Currency,
) {
    if (currency === "USD") {
        return `USD ${formatNumber(value, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    return `${formatNumber(value, {
        maximumFractionDigits: 0,
    })} د.ع`;
}

export function formatDate(
    value: string | number | Date,
    options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    },
) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return new Intl.DateTimeFormat(DATE_LOCALE, {
        numberingSystem: "latn",
        ...options,
    }).format(date);
}

export function formatDateTime(value: string | number | Date) {
    return formatDate(value, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

export function formatPhoneNumber(value: string) {
    return normalizeWesternDigits(value);
}
