const timeZone = "Asia/Kuala_Lumpur";

const longDate = new Intl.DateTimeFormat("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone });
const shortDate = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone });
const dateTime = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone });
const malayDay = new Intl.DateTimeFormat("ms-MY", { weekday: "long", day: "numeric", month: "long", timeZone });

export const formatLongDate = (value: string | Date) => longDate.format(new Date(value));
export const formatDate = (value: string | null | undefined) => (value ? shortDate.format(new Date(value)) : "");
export const formatDateTime = (value: string | null | undefined) => (value ? dateTime.format(new Date(value)) : "");
/** "Rabu, 25 November" for the masthead. */
export const formatMalayDay = (value: Date) => malayDay.format(value);
