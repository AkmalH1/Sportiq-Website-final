# Test-only TOTP generator for the e2e servers (independent RFC 6238 implementation).
# The e2e servers run as NODE_ENV=production, where two-factor is mandatory (ADMIN_MFA_OPTIONAL is ignored), so they start with
# ADMIN_TOTP_SECRET=E2E_TOTP_SECRET. A code can be used once, so this hands out each (30-second step) at most once and waits for a fresh step when all are used.
import base64, hashlib, hmac, struct, time
E2E_TOTP_SECRET = "KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU"
_used = set()
def _code(step, secret=E2E_TOTP_SECRET):
    h = hmac.new(base64.b32decode(secret), struct.pack(">Q", step), hashlib.sha1).digest(); o = h[-1] & 15
    return str((struct.unpack(">I", h[o:o + 4])[0] & 0x7fffffff) % 10**6).zfill(6)
def totp_code():
    while True:
        now = int(time.time() // 30)
        for s in (now, now - 1, now + 1):
            if s not in _used:
                _used.add(s); return _code(s)
        time.sleep(3)
