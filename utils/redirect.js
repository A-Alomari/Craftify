function isSafeRelativePath(pathname) {
  return (
    typeof pathname === 'string' &&
    pathname.startsWith('/') &&
    !pathname.startsWith('//') &&
    !pathname.includes('\r') &&
    !pathname.includes('\n')
  );
}

function getSafeRedirect(req, fallback = '/') {
  const referrer = req.get('Referrer');

  if (!referrer) {
    return fallback;
  }

  if (isSafeRelativePath(referrer)) {
    return referrer;
  }

  try {
    const parsed = new URL(referrer);
    const host = req.get('host');

    if (parsed.host !== host) {
      return fallback;
    }

    const candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return isSafeRelativePath(candidate) ? candidate : fallback;
  } catch (err) {
    return fallback;
  }
}

module.exports = {
  getSafeRedirect,
  isSafeRelativePath
};
