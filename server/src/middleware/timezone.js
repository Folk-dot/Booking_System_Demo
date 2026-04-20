// All date math in controllers should use Bangkok timezone.
// This middleware attaches a helper to req for consistency.

const TIMEZONE = 'Asia/Bangkok';

function timezoneMiddleware(req, _res, next) {
  req.timezone = TIMEZONE;

  // Helper: convert a UTC Date to Bangkok ISO string for display
  req.toBangkok = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  };

  next();
}

export { timezoneMiddleware, TIMEZONE };
